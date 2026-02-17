/**
 * Skill provisioner — maps connections to skills and provisions them in agent workspaces.
 * When a connection is assigned to an agent, the corresponding skill directory
 * is copied into the agent's workspace/skills/ and a .env file is written with credentials.
 */

import fs from 'fs';
import path from 'path';
import { getConnection, getConnectionSecrets } from './admin-db';

const WORKSPACES_BASE = path.resolve(process.cwd(), '../../workspaces');
const SKILLS_SOURCE = path.resolve(process.cwd(), '../../packages/engine/skills');

/**
 * Connection type → skill directory mapping.
 */
const SKILL_MAP: Record<string, string> = {
  'database': 'buildai-database',
  'procore': 'buildai-procore',
  'documents': 'buildai-documents',
  'p6': 'buildai-p6',
  'unifier': 'buildai-unifier',
};

/**
 * Connection type → env var mapping.
 * Maps connection config keys to the env vars the skill expects.
 */
const ENV_MAP: Record<string, Record<string, string>> = {
  'database': {
    'host': 'DB_HOST',
    'port': 'DB_PORT',
    'dbName': 'DB_NAME',
    'DB_HOST': 'DB_HOST',
    'DB_PORT': 'DB_PORT',
    'DB_NAME': 'DB_NAME',
  },
  'procore': {
    'companyId': 'PROCORE_COMPANY_ID',
    'PROCORE_COMPANY_ID': 'PROCORE_COMPANY_ID',
  },
};

/**
 * Secret key → env var mapping.
 */
const SECRET_ENV_MAP: Record<string, Record<string, string>> = {
  'database': {
    'username': 'DB_USER',
    'password': 'DB_PASSWORD',
    'DB_USER': 'DB_USER',
    'DB_PASSWORD': 'DB_PASSWORD',
  },
  'procore': {
    'clientId': 'PROCORE_CLIENT_ID',
    'clientSecret': 'PROCORE_CLIENT_SECRET',
    'PROCORE_CLIENT_ID': 'PROCORE_CLIENT_ID',
    'PROCORE_CLIENT_SECRET': 'PROCORE_CLIENT_SECRET',
  },
};

/**
 * Provision skills for an agent based on assigned connections.
 * Clears existing skills and re-provisions from scratch.
 */
export async function provisionSkills(agentId: string, connectionIds: string[]): Promise<void> {
  const skillsDir = path.join(WORKSPACES_BASE, agentId, 'skills');

  // Clear existing skills
  if (fs.existsSync(skillsDir)) {
    fs.rmSync(skillsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(skillsDir, { recursive: true });

  for (const connId of connectionIds) {
    const conn = getConnection(connId);
    if (!conn) {
      console.warn(`[skill-provisioner] Connection ${connId} not found, skipping`);
      continue;
    }

    const skillName = SKILL_MAP[conn.type];
    if (!skillName) {
      console.warn(`[skill-provisioner] No skill mapping for connection type "${conn.type}", skipping`);
      continue;
    }

    const sourceSkillDir = path.join(SKILLS_SOURCE, skillName);
    if (!fs.existsSync(sourceSkillDir)) {
      console.warn(`[skill-provisioner] Skill source not found: ${sourceSkillDir}, skipping`);
      continue;
    }

    // Copy skill directory
    const destSkillDir = path.join(skillsDir, skillName);
    copyDirSync(sourceSkillDir, destSkillDir);

    // Build .env file from connection config + secrets
    const envLines: string[] = [];
    const config = JSON.parse(conn.config);
    const envMap = ENV_MAP[conn.type] || {};
    const secretEnvMap = SECRET_ENV_MAP[conn.type] || {};

    // Map config values to env vars
    for (const [configKey, value] of Object.entries(config)) {
      const envVar = envMap[configKey];
      if (envVar) {
        envLines.push(`${envVar}=${String(value)}`);
      }
    }

    // Map secrets to env vars
    const secrets = getConnectionSecrets(connId);
    if (secrets) {
      for (const [secretKey, value] of Object.entries(secrets)) {
        const envVar = secretEnvMap[secretKey];
        if (envVar) {
          envLines.push(`${envVar}=${value}`);
        }
      }
    }

    if (envLines.length > 0) {
      fs.writeFileSync(path.join(destSkillDir, '.env'), envLines.join('\n') + '\n');
    }

    console.log(`[skill-provisioner] Provisioned ${skillName} for agent ${agentId} (${envLines.length} env vars)`);
  }
}

/**
 * Recursively copy a directory.
 */
function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

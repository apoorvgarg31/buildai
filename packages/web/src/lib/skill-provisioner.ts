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
 *
 * Multiple connections of the same type get separate skill instances:
 *   - First database connection → buildai-database
 *   - Second database connection → buildai-database-<slug>
 * Each instance gets its own .env and a customized SKILL.md with the connection name.
 */
export async function provisionSkills(agentId: string, connectionIds: string[]): Promise<void> {
  const skillsDir = path.join(WORKSPACES_BASE, agentId, 'skills');

  // Clear existing skills
  if (fs.existsSync(skillsDir)) {
    fs.rmSync(skillsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(skillsDir, { recursive: true });

  // Track how many of each type we've provisioned (for unique naming)
  const typeCount: Record<string, number> = {};

  for (const connId of connectionIds) {
    const conn = getConnection(connId);
    if (!conn) {
      console.warn(`[skill-provisioner] Connection ${connId} not found, skipping`);
      continue;
    }

    const baseSkillName = SKILL_MAP[conn.type];
    if (!baseSkillName) {
      console.warn(`[skill-provisioner] No skill mapping for connection type "${conn.type}", skipping`);
      continue;
    }

    const sourceSkillDir = path.join(SKILLS_SOURCE, baseSkillName);
    if (!fs.existsSync(sourceSkillDir)) {
      console.warn(`[skill-provisioner] Skill source not found: ${sourceSkillDir}, skipping`);
      continue;
    }

    // Generate unique skill instance name for multiple connections of same type
    const count = typeCount[conn.type] || 0;
    typeCount[conn.type] = count + 1;

    let instanceName: string;
    if (count === 0) {
      instanceName = baseSkillName;
    } else {
      // Slug the connection name for the folder
      const slug = conn.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      instanceName = `${baseSkillName}-${slug}`;
    }

    // Copy skill directory
    const destSkillDir = path.join(skillsDir, instanceName);
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

    // Customize SKILL.md with connection name so agent knows which DB is which
    if (count > 0 || typeCount[conn.type]! > 1) {
      customizeSkillMd(destSkillDir, instanceName, conn.name, conn.type, config);
    }

    console.log(`[skill-provisioner] Provisioned ${instanceName} for agent ${agentId} (${envLines.length} env vars, connection: "${conn.name}")`);
  }

  // If any type had multiple connections, also customize the first instance's SKILL.md
  // (We need a second pass since we didn't know there'd be duplicates on the first one)
  for (const connId of connectionIds) {
    const conn = getConnection(connId);
    if (!conn) continue;
    const total = typeCount[conn.type] || 0;
    if (total <= 1) continue;

    const baseSkillName = SKILL_MAP[conn.type];
    if (!baseSkillName) continue;

    const destSkillDir = path.join(skillsDir, baseSkillName);
    if (!fs.existsSync(destSkillDir)) continue;

    // Only customize the first instance (it kept the base name)
    const config = JSON.parse(conn.config);
    customizeSkillMd(destSkillDir, baseSkillName, conn.name, conn.type, config);
    break; // Only the first of this type
  }
}

/**
 * Customize a skill's SKILL.md to include the connection name and details.
 * This helps the agent distinguish between multiple connections of the same type.
 */
function customizeSkillMd(
  skillDir: string,
  instanceName: string,
  connectionName: string,
  connectionType: string,
  config: Record<string, unknown>
): void {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) return;

  let content = fs.readFileSync(skillMdPath, 'utf-8');

  // Add connection identity block after the first heading
  const connInfo = [`\n> **Connection:** ${connectionName}`];
  if (connectionType === 'database') {
    if (config.dbName || config.DB_NAME) connInfo.push(`> **Database:** ${config.dbName || config.DB_NAME}`);
    if (config.host || config.DB_HOST) connInfo.push(`> **Host:** ${config.host || config.DB_HOST}`);
  }
  connInfo.push(`> **Skill Instance:** ${instanceName}\n`);

  // Update the skill name in frontmatter if present
  content = content.replace(
    /^name:\s*.*$/m,
    `name: ${instanceName}`
  );

  // Update description to include connection name
  content = content.replace(
    /^description:\s*.*$/m,
    (match) => `${match} (Connection: ${connectionName})`
  );

  // Insert connection info after first heading
  const firstHeadingMatch = content.match(/^#\s+.+$/m);
  if (firstHeadingMatch && firstHeadingMatch.index !== undefined) {
    const insertAt = firstHeadingMatch.index + firstHeadingMatch[0].length;
    content = content.slice(0, insertAt) + '\n' + connInfo.join('\n') + content.slice(insertAt);
  }

  // Update script paths to use the instance name
  content = content.replace(
    new RegExp(`skills/${instanceName.split('-').slice(0, 2).join('-')}-?[a-z]*/`, 'g'),
    `skills/${instanceName}/`
  );

  fs.writeFileSync(skillMdPath, content, 'utf-8');
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

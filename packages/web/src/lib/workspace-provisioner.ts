/**
 * Workspace provisioner — creates and manages agent workspaces.
 * Each agent gets its own directory with SOUL.md, ACTIVE.md, MEMORY.md, etc.
 */

import fs from 'fs';
import path from 'path';

const WORKSPACES_BASE = path.resolve(process.cwd(), '../../workspaces');
const TEMPLATES_DIR = path.join(WORKSPACES_BASE, 'templates');

/**
 * Create a new agent workspace from templates.
 * Returns the relative workspace path (for engine config).
 */
export async function provisionWorkspace(agentId: string): Promise<string> {
  const workspaceDir = path.join(WORKSPACES_BASE, agentId);

  if (fs.existsSync(workspaceDir)) {
    throw new Error(`Workspace already exists: ${agentId}`);
  }

  // Create workspace directory structure
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.mkdirSync(path.join(workspaceDir, 'memory'), { recursive: true });
  fs.mkdirSync(path.join(workspaceDir, 'sessions'), { recursive: true });
  fs.mkdirSync(path.join(workspaceDir, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(workspaceDir, 'files'), { recursive: true });

  // Copy template files
  const templateFiles = ['SOUL.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md', 'USER.md', 'IDENTITY.md'];
  for (const file of templateFiles) {
    const src = path.join(TEMPLATES_DIR, file);
    const dest = path.join(workspaceDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }

  // Create fresh state files
  fs.writeFileSync(path.join(workspaceDir, 'ACTIVE.md'), `# ACTIVE.md\n\nAgent: ${agentId}\nStatus: Ready\nCreated: ${new Date().toISOString()}\n`);
  fs.writeFileSync(path.join(workspaceDir, 'MEMORY.md'), `# MEMORY.md\n\nLong-term memory for agent ${agentId}.\n`);

  // Return relative path for engine config
  return `../../workspaces/${agentId}`;
}

/**
 * Delete an agent workspace.
 */
export async function removeWorkspace(agentId: string): Promise<void> {
  const workspaceDir = path.join(WORKSPACES_BASE, agentId);
  if (fs.existsSync(workspaceDir)) {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
}

/**
 * Check if a workspace exists.
 */
export function workspaceExists(agentId: string): boolean {
  return fs.existsSync(path.join(WORKSPACES_BASE, agentId));
}

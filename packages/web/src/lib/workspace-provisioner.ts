/**
 * Workspace provisioner — creates and manages agent workspaces.
 * Each agent gets its own directory with SOUL.md, ACTIVE.md, MEMORY.md, etc.
 */

import fs from 'fs';
import path from 'path';

const WORKSPACES_BASE = path.resolve(process.cwd(), '../../workspaces');
const TEMPLATES_DIR = path.join(WORKSPACES_BASE, 'templates');

export type WorkspaceUserProfile = {
  userId: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  title?: string;
  timezone?: string;
  preferredSalutation?: string;
};

function escapeMd(value: string | undefined): string {
  return (value || '').replace(/\r/g, '').trim();
}

function buildUserMd(profile: WorkspaceUserProfile): string {
  const roleLabel = profile.role === 'admin' ? 'Administrator' : 'User';
  return `# User Profile

## Status
active

## Identity
- Name: ${escapeMd(profile.name)}
- Preferred salutation: ${escapeMd(profile.preferredSalutation) || escapeMd(profile.name)}
- Role: ${escapeMd(profile.title) || roleLabel}
- Email: ${escapeMd(profile.email)}
- Timezone: ${escapeMd(profile.timezone) || 'Unknown'}

## Work Context
- Company: Mira
- Primary projects:
- Primary systems: (Procore / Unifier / Aconex / e-Builder / Enablon / Kahua / P6 / OPC)

## Top Pain Points
-
-
-

## Communication Preferences
- Style: brief
- Tone: direct
- Proactivity: proactive
- Update cadence: digest+alerts

## Success Criteria
- What “great help” looks like for this user: know who they are, retain context across turns, and answer directly.

## Notes
- User id: ${escapeMd(profile.userId)}
- This workspace must answer natural profile questions from these files without asking the user to repeat themselves.
`;
}

function buildMemoryMd(profile: WorkspaceUserProfile): string {
  return `# MEMORY.md — Long-term Memory

## User Profile
- Name: ${escapeMd(profile.name)}
- Email: ${escapeMd(profile.email)}
- Role: ${escapeMd(profile.title) || (profile.role === 'admin' ? 'Administrator' : 'User')}
- Timezone: ${escapeMd(profile.timezone) || 'Unknown'}
- Preferred salutation: ${escapeMd(profile.preferredSalutation) || escapeMd(profile.name)}

## Projects
*(Populated from PMIS connections)*

## Preferences
- Response style: brief
- Tone: direct
- Proactivity: proactive

## Contacts & Subcontractors
*(Built from project data and conversations)*
`;
}

export function syncWorkspaceProfile(agentId: string, profile: WorkspaceUserProfile): void {
  const workspaceDir = getWorkspaceDir(agentId);
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.mkdirSync(path.join(workspaceDir, 'memory'), { recursive: true });
  fs.writeFileSync(path.join(workspaceDir, 'USER.md'), buildUserMd(profile));
  fs.writeFileSync(path.join(workspaceDir, 'MEMORY.md'), buildMemoryMd(profile));

  const activePath = path.join(workspaceDir, 'ACTIVE.md');
  const currentActive = fs.existsSync(activePath) ? fs.readFileSync(activePath, 'utf8') : '# ACTIVE.md\n\n';
  const nextStatus = `\n## Profile Sync\n- Name: ${escapeMd(profile.name)}\n- Email: ${escapeMd(profile.email)}\n- Role: ${escapeMd(profile.title) || (profile.role === 'admin' ? 'Administrator' : 'User')}\n- Synced: ${new Date().toISOString()}\n`;
  const stripped = currentActive.replace(/\n## Profile Sync[\s\S]*$/m, '').trimEnd();
  fs.writeFileSync(activePath, `${stripped}${nextStatus}\n`);
}

export function getWorkspaceDir(agentId: string): string {
  return path.join(WORKSPACES_BASE, agentId);
}

/**
 * Create a new agent workspace from templates.
 * Returns the relative workspace path (for engine config).
 */
export async function provisionWorkspace(agentId: string, profile?: WorkspaceUserProfile): Promise<string> {
  const workspaceDir = getWorkspaceDir(agentId);

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
  fs.writeFileSync(path.join(workspaceDir, 'ACTIVE.md'), `# ACTIVE.md\n\nAgent: ${agentId}\nStatus: ${profile ? 'Profile loaded' : 'Onboarding pending'}\nCreated: ${new Date().toISOString()}\n\n## Onboarding\n- Status: ${profile ? 'complete' : 'pending'}\n- Next step: ${profile ? 'Answer using workspace profile and memory files.' : 'Ask user onboarding questions on first message'}\n`);
  fs.writeFileSync(
    path.join(workspaceDir, 'MEMORY.md'),
    profile ? buildMemoryMd(profile) : `# MEMORY.md\n\nLong-term memory for agent ${agentId}.\n`
  );
  if (profile) {
    fs.writeFileSync(path.join(workspaceDir, 'USER.md'), buildUserMd(profile));
  }

  // Return absolute path so the engine resolves it correctly regardless of its cwd.
  return workspaceDir;
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
  return fs.existsSync(getWorkspaceDir(agentId));
}

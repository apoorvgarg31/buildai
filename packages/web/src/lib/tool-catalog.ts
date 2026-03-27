export type AdminToolRisk = 'standard' | 'sensitive' | 'power';

export interface AdminToolCatalogEntry {
  name: string;
  label: string;
  description: string;
  category: string;
  risk: AdminToolRisk;
  defaultEnabled: boolean;
}

export const ADMIN_TOOL_CATALOG: AdminToolCatalogEntry[] = [
  { name: 'read', label: 'Read', description: 'Inspect workspace files and artifacts safely.', category: 'Workspace', risk: 'standard', defaultEnabled: true },
  { name: 'write', label: 'Write', description: 'Create files directly inside the workspace.', category: 'Workspace', risk: 'power', defaultEnabled: true },
  { name: 'edit', label: 'Edit', description: 'Patch existing workspace files without a full rewrite.', category: 'Workspace', risk: 'power', defaultEnabled: true },
  { name: 'apply_patch', label: 'Apply patch', description: 'Use structured patch editing for deterministic file changes.', category: 'Workspace', risk: 'power', defaultEnabled: true },
  { name: 'exec', label: 'Exec', description: 'Run shell commands in the agent workspace.', category: 'Runtime', risk: 'power', defaultEnabled: true },
  { name: 'process', label: 'Process', description: 'Track long-running commands and process state.', category: 'Runtime', risk: 'power', defaultEnabled: true },
  { name: 'web_fetch', label: 'Web fetch', description: 'Read external pages without opening the browser runtime.', category: 'Research', risk: 'standard', defaultEnabled: true },
  { name: 'web_search', label: 'Web search', description: 'Search the web for external facts and references.', category: 'Research', risk: 'standard', defaultEnabled: true },
  { name: 'sessions_list', label: 'Sessions list', description: 'Discover active sessions and peer agents.', category: 'Coordination', risk: 'standard', defaultEnabled: true },
  { name: 'sessions_history', label: 'Sessions history', description: 'Read transcript history from other sessions.', category: 'Coordination', risk: 'sensitive', defaultEnabled: true },
  { name: 'sessions_send', label: 'Sessions send', description: 'Send work to another active agent session.', category: 'Coordination', risk: 'standard', defaultEnabled: true },
  { name: 'sessions_spawn', label: 'Sessions spawn', description: 'Launch a new sub-agent to handle isolated work.', category: 'Coordination', risk: 'power', defaultEnabled: true },
  { name: 'session_status', label: 'Session status', description: 'Inspect the current session health, budget, and compaction state.', category: 'Coordination', risk: 'standard', defaultEnabled: true },
  { name: 'browser', label: 'Browser', description: 'Control the dedicated browser for screenshots, clicks, and forms.', category: 'Interactive', risk: 'sensitive', defaultEnabled: false },
  { name: 'canvas', label: 'Canvas', description: 'Drive visual canvas surfaces and previews.', category: 'Interactive', risk: 'sensitive', defaultEnabled: false },
  { name: 'nodes', label: 'Nodes', description: 'Access paired device features such as camera, screen, and notifications.', category: 'Devices', risk: 'sensitive', defaultEnabled: false },
  { name: 'cron', label: 'Cron', description: 'Schedule recurring jobs and wakeups.', category: 'Automation', risk: 'power', defaultEnabled: false },
  { name: 'message', label: 'Message', description: 'Send and manage outbound channel messages.', category: 'Channels', risk: 'sensitive', defaultEnabled: false },
  { name: 'tts', label: 'Text to speech', description: 'Generate spoken audio responses.', category: 'Media', risk: 'standard', defaultEnabled: false },
  { name: 'gateway', label: 'Gateway', description: 'Inspect and control OpenClaw gateway operations.', category: 'Platform', risk: 'power', defaultEnabled: false },
  { name: 'agents_list', label: 'Agents list', description: 'Inspect available routed agents from the runtime.', category: 'Platform', risk: 'standard', defaultEnabled: false },
  { name: 'image', label: 'Image', description: 'Generate or manipulate images through the runtime image path.', category: 'Media', risk: 'standard', defaultEnabled: false },
];

export function getAdminToolCatalogEntry(name: string): AdminToolCatalogEntry | undefined {
  return ADMIN_TOOL_CATALOG.find((entry) => entry.name === name);
}

export function isSupportedAdminTool(name: string): boolean {
  return ADMIN_TOOL_CATALOG.some((entry) => entry.name === name);
}

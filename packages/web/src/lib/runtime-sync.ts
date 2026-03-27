import fs from 'fs';
import path from 'path';
import type { Agent, McpServerRecord, ToolPolicy } from './admin-db';
import { listAgents, listMcpServers, listToolPolicies } from './admin-db';
import { reloadEngine } from './engine-config';

const CONFIG_PATH = path.resolve(
  process.env.BUILDAI_ENGINE_CONFIG || path.join(process.cwd(), '../../packages/engine/buildai.config.json5')
);

interface RuntimeConfig {
  tools?: {
    allow?: string[];
    deny?: string[];
    [key: string]: unknown;
  };
  skills?: {
    allowBundled?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface RuntimeManifestEntry {
  id: string;
  key: string;
  name: string;
  serverKind: McpServerRecord['server_kind'];
  transport: McpServerRecord['transport'];
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  connectionId: string | null;
  connectionName: string | null;
  connectionType: string | null;
  status: string;
  enabled: boolean;
  notes: string | null;
}

export function buildManagedToolPolicy(policies: ToolPolicy[]): { allow: string[]; deny: string[] } {
  return {
    allow: policies.filter((policy) => policy.enabled).map((policy) => policy.name),
    deny: policies.filter((policy) => !policy.enabled).map((policy) => policy.name),
  };
}

function isRunnableMcpServer(server: McpServerRecord): boolean {
  if (!server.enabled) return false;
  if (server.transport === 'stdio') {
    return typeof server.command === 'string' && server.command.trim().length > 0;
  }
  return typeof server.url === 'string' && server.url.trim().length > 0;
}

export function shouldEnableMcporterSkill(servers: McpServerRecord[]): boolean {
  return servers.some(isRunnableMcpServer);
}

export function selectRuntimeMcpServersForAgent(agent: Agent, servers: McpServerRecord[]): McpServerRecord[] {
  return servers.filter((server) => {
    if (!isRunnableMcpServer(server)) return false;
    if (server.server_kind === 'standalone') return true;
    if (!server.connection_id) return false;
    return agent.connection_ids.includes(server.connection_id);
  });
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'mcp';
}

function buildServerKey(server: McpServerRecord): string {
  return `${slugify(server.name)}_${slugify(server.id)}`;
}

function buildServerEnv(agent: Agent, server: McpServerRecord): Record<string, string> {
  return {
    ...server.env,
    BUILDAI_AGENT_ID: agent.id,
    ...(server.connection_id ? { BUILDAI_CONNECTION_ID: server.connection_id } : {}),
    ...(server.connection_type ? { BUILDAI_CONNECTION_TYPE: server.connection_type } : {}),
    ...(server.connection_name ? { BUILDAI_CONNECTION_NAME: server.connection_name } : {}),
  };
}

function buildRuntimeManifestEntries(agent: Agent, servers: McpServerRecord[]): RuntimeManifestEntry[] {
  return selectRuntimeMcpServersForAgent(agent, servers).map((server) => ({
    id: server.id,
    key: buildServerKey(server),
    name: server.name,
    serverKind: server.server_kind,
    transport: server.transport,
    command: server.command,
    args: server.args,
    env: buildServerEnv(agent, server),
    url: server.url,
    connectionId: server.connection_id,
    connectionName: server.connection_name,
    connectionType: server.connection_type,
    status: server.status,
    enabled: server.enabled,
    notes: server.notes,
  }));
}

export function buildWorkspaceMcpRuntimeFiles(agent: Agent, servers: McpServerRecord[]): Record<string, string> {
  const entries = buildRuntimeManifestEntries(agent, servers);
  if (entries.length === 0) return {};

  const buildaiManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    agentId: agent.id,
    servers: entries,
  };

  const mcporterServers = Object.fromEntries(entries.map((entry) => [
    entry.key,
    {
      transport: entry.transport,
      ...(entry.command ? { command: entry.command } : {}),
      ...(entry.args.length > 0 ? { args: entry.args } : {}),
      ...(Object.keys(entry.env).length > 0 ? { env: entry.env } : {}),
      ...(entry.url ? { url: entry.url } : {}),
      metadata: {
        buildaiAgentId: agent.id,
        connectionId: entry.connectionId,
        connectionType: entry.connectionType,
      },
    },
  ]));

  const mcporterManifest = {
    version: 1,
    generatedAt: buildaiManifest.generatedAt,
    servers: mcporterServers,
    mcpServers: mcporterServers,
  };

  return {
    'config/buildai-mcp.json': JSON.stringify(buildaiManifest, null, 2) + '\n',
    'config/mcporter.json': JSON.stringify(mcporterManifest, null, 2) + '\n',
  };
}

function readRuntimeConfig(): RuntimeConfig {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  try {
    return JSON.parse(raw) as RuntimeConfig;
  } catch {
    const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(cleaned) as RuntimeConfig;
  }
}

function writeRuntimeConfig(config: RuntimeConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function syncWorkspaceRuntimeFiles(agentId: string, files: Record<string, string>): void {
  const workspaceDir = path.resolve(process.cwd(), `../../workspaces/${agentId}`);
  const configDir = path.join(workspaceDir, 'config');
  const managedFiles = ['buildai-mcp.json', 'mcporter.json'];

  if (Object.keys(files).length === 0) {
    for (const fileName of managedFiles) {
      const filePath = path.join(configDir, fileName);
      if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
    }
    if (fs.existsSync(configDir) && fs.readdirSync(configDir).length === 0) {
      fs.rmdirSync(configDir);
    }
    return;
  }

  fs.mkdirSync(configDir, { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(workspaceDir, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

export async function syncRuntimeFromAdminState(): Promise<void> {
  const policies = listToolPolicies();
  const agents = listAgents();
  const servers = listMcpServers();

  const config = readRuntimeConfig();
  const managedTools = buildManagedToolPolicy(policies);
  const shouldAllowMcporter = shouldEnableMcporterSkill(servers);

  config.tools = {
    ...(config.tools || {}),
    allow: managedTools.allow,
    deny: managedTools.deny,
  };

  const existingAllowBundled = Array.isArray(config.skills?.allowBundled)
    ? config.skills?.allowBundled || []
    : [];
  const withoutMcporter = existingAllowBundled.filter((skill) => skill !== 'mcporter');
  config.skills = {
    ...(config.skills || {}),
    allowBundled: shouldAllowMcporter ? [...withoutMcporter, 'mcporter'] : withoutMcporter,
  };

  writeRuntimeConfig(config);

  for (const agent of agents) {
    syncWorkspaceRuntimeFiles(agent.id, buildWorkspaceMcpRuntimeFiles(agent, servers));
  }

  await reloadEngine();
}

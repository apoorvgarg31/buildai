import { describe, expect, it } from 'vitest';
import type { Agent, McpServerRecord, ToolPolicy } from '../src/lib/admin-db';
import {
  buildManagedRuntimeDefaults,
  buildManagedToolPolicy,
  buildWorkspaceMcpRuntimeFiles,
  selectRuntimeMcpServersForAgent,
  shouldEnableMcporterSkill,
} from '../src/lib/runtime-sync';

function tool(name: string, enabled: boolean): ToolPolicy {
  return {
    name,
    label: name,
    description: `${name} tool`,
    category: 'Runtime',
    risk: 'standard',
    defaultEnabled: enabled,
    enabled,
  };
}

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    name: 'Agent One',
    user_id: null,
    model: 'google/gemini-2.0-flash',
    api_key: null,
    workspace_dir: '../../workspaces/agent-1',
    status: 'active',
    connection_ids: [],
    created_at: '2026-03-27T00:00:00.000Z',
    updated_at: '2026-03-27T00:00:00.000Z',
    ...overrides,
  };
}

function server(overrides: Partial<McpServerRecord> = {}): McpServerRecord {
  return {
    id: 'mcp-1',
    name: 'Linear MCP',
    server_kind: 'connector_linked',
    connection_id: 'conn-linear',
    connection_name: 'Linear',
    connection_type: 'linear',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@example/linear-mcp'],
    env: { LOG_LEVEL: 'debug' },
    url: null,
    status: 'active',
    enabled: true,
    notes: null,
    created_at: '2026-03-27T00:00:00.000Z',
    updated_at: '2026-03-27T00:00:00.000Z',
    ...overrides,
  };
}

describe('runtime-sync', () => {
  it('builds an explicit allow/deny tool policy from admin state', () => {
    const policy = buildManagedToolPolicy([
      tool('read', true),
      tool('write', true),
      tool('browser', false),
    ]);

    expect(policy.allow).toEqual(['read', 'write']);
    expect(policy.deny).toEqual(['browser']);
  });

  it('builds hardened runtime defaults for per-agent sandbox isolation', () => {
    const defaults = buildManagedRuntimeDefaults('anthropic/claude-sonnet-4-20250514');

    expect(defaults.agents.defaults.model).toEqual({ primary: 'anthropic/claude-sonnet-4-20250514' });
    expect(defaults.agents.defaults.sandbox).toEqual({
      mode: 'all',
      scope: 'agent',
      workspaceAccess: 'rw',
    });
    expect(defaults.tools.elevated).toEqual({ enabled: false });
  });

  it('selects only runnable standalone servers and assigned connector-linked servers for an agent', () => {
    const selected = selectRuntimeMcpServersForAgent(
      agent({ connection_ids: ['conn-linear'] }),
      [
        server({ id: 'linked-ok' }),
        server({ id: 'linked-wrong-agent', connection_id: 'conn-github', connection_name: 'GitHub', connection_type: 'github' }),
        server({ id: 'standalone-ok', server_kind: 'standalone', connection_id: null, connection_name: null, connection_type: null }),
        server({ id: 'disabled', enabled: false }),
        server({ id: 'missing-command', command: null }),
      ],
    );

    expect(selected.map((entry) => entry.id)).toEqual(['linked-ok', 'standalone-ok']);
  });

  it('enables mcporter only when at least one runnable MCP server exists', () => {
    expect(shouldEnableMcporterSkill([server()])).toBe(true);
    expect(shouldEnableMcporterSkill([server({ enabled: false })])).toBe(false);
    expect(shouldEnableMcporterSkill([server({ transport: 'http', command: null, url: null })])).toBe(false);
  });

  it('writes both BuildAI and mcporter manifests with BuildAI metadata for connector-linked servers', () => {
    const files = buildWorkspaceMcpRuntimeFiles(
      agent({ id: 'agent-linear', connection_ids: ['conn-linear'] }),
      [
        server({
          id: 'linear-main',
          name: 'Linear MCP',
          connection_id: 'conn-linear',
          connection_name: 'Linear Workspace',
          connection_type: 'linear',
          env: { LOG_LEVEL: 'debug' },
        }),
        server({
          id: 'browser-fetch',
          name: 'Fetch MCP',
          server_kind: 'standalone',
          connection_id: null,
          connection_name: null,
          connection_type: null,
          command: 'uvx',
          args: ['mcp-fetch'],
        }),
      ],
    );

    const buildaiManifest = JSON.parse(files['config/buildai-mcp.json'] || '{}');
    const mcporterManifest = JSON.parse(files['config/mcporter.json'] || '{}');

    expect(buildaiManifest.agentId).toBe('agent-linear');
    expect(buildaiManifest.servers).toHaveLength(2);
    expect(buildaiManifest.servers[0]).toMatchObject({
      id: 'linear-main',
      connectionId: 'conn-linear',
      connectionType: 'linear',
    });

    expect(mcporterManifest.servers.linear_mcp_linear_main).toMatchObject({
      command: 'npx',
      args: ['-y', '@example/linear-mcp'],
    });
    expect(mcporterManifest.servers.linear_mcp_linear_main.env).toMatchObject({
      LOG_LEVEL: 'debug',
      BUILDAI_AGENT_ID: 'agent-linear',
      BUILDAI_CONNECTION_ID: 'conn-linear',
      BUILDAI_CONNECTION_TYPE: 'linear',
      BUILDAI_CONNECTION_NAME: 'Linear Workspace',
    });
    expect(mcporterManifest.mcpServers.fetch_mcp_browser_fetch.command).toBe('uvx');
  });

  it('returns no runtime files when an agent has no active MCP servers', () => {
    const files = buildWorkspaceMcpRuntimeFiles(agent(), [server({ enabled: false })]);
    expect(files).toEqual({});
  });
});

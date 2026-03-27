import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listToolPolicies: vi.fn(),
  listAgents: vi.fn(),
  listMcpServers: vi.fn(),
  getAdminSettings: vi.fn(),
  writeAgentAuthProfile: vi.fn(),
  reloadEngine: vi.fn(async () => undefined),
}));

vi.mock('../src/lib/admin-db', () => ({
  listToolPolicies: mocks.listToolPolicies,
  listAgents: mocks.listAgents,
  listMcpServers: mocks.listMcpServers,
}));

vi.mock('../src/lib/admin-settings', () => ({
  getAdminSettings: mocks.getAdminSettings,
}));

vi.mock('../src/lib/engine-config', () => ({
  writeAgentAuthProfile: mocks.writeAgentAuthProfile,
  reloadEngine: mocks.reloadEngine,
}));

const originalConfigPath = process.env.BUILDAI_ENGINE_CONFIG;
const originalCwd = process.cwd();

let tmpRoot: string;
let configPath: string;

describe('runtime-sync integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'buildai-runtime-sync-'));
    configPath = path.join(tmpRoot, 'packages', 'engine', 'buildai.config.json5');

    fs.mkdirSync(path.join(tmpRoot, 'packages', 'engine'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'packages', 'web'), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({
      agents: {
        defaults: {
          workspace: '../../workspaces/buildai-agent',
        },
        list: [
          {
            id: 'agent-1',
            workspace: '../../workspaces/agent-1',
            model: { primary: 'google/gemini-2.0-flash' },
          },
        ],
      },
      tools: {},
      skills: { allowBundled: ['buildai-marketplace'] },
    }, null, 2));

    process.env.BUILDAI_ENGINE_CONFIG = configPath;
    process.chdir(path.join(tmpRoot, 'packages', 'web'));

    mocks.listToolPolicies.mockReturnValue([
      { name: 'read', label: 'Read', description: '', category: 'Workspace', risk: 'standard', defaultEnabled: true, enabled: true },
      { name: 'browser', label: 'Browser', description: '', category: 'Interactive', risk: 'sensitive', defaultEnabled: false, enabled: false },
    ]);
    mocks.listAgents.mockReturnValue([
      {
        id: 'agent-1',
        name: 'Agent One',
        user_id: 'user-1',
        model: 'anthropic/claude-sonnet-4-20250514',
        api_key: null,
        workspace_dir: '../../workspaces/agent-1',
        status: 'active',
        connection_ids: ['conn-linear'],
        created_at: '2026-03-27T00:00:00.000Z',
        updated_at: '2026-03-27T00:00:00.000Z',
      },
    ]);
    mocks.listMcpServers.mockReturnValue([
      {
        id: 'mcp-linear',
        name: 'Linear MCP',
        server_kind: 'connector_linked',
        connection_id: 'conn-linear',
        connection_name: 'Linear',
        connection_type: 'linear',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@example/linear-mcp'],
        env: {},
        url: null,
        status: 'active',
        enabled: true,
        notes: null,
        created_at: '2026-03-27T00:00:00.000Z',
        updated_at: '2026-03-27T00:00:00.000Z',
      },
    ]);
    mocks.getAdminSettings.mockReturnValue({
      companyName: 'Mira',
      defaultModel: 'anthropic/claude-sonnet-4-20250514',
      responseStyle: 'professional',
      maxQueriesPerDay: 500,
      maxAgents: 10,
      dataRetentionDays: 90,
      hasSharedApiKey: true,
      sharedApiKey: 'shared-admin-key',
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalConfigPath === undefined) {
      delete process.env.BUILDAI_ENGINE_CONFIG;
    } else {
      process.env.BUILDAI_ENGINE_CONFIG = originalConfigPath;
    }
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('syncs config hardening and writes agent runtime manifests', async () => {
    const { syncRuntimeFromAdminState } = await import('../src/lib/runtime-sync');

    await syncRuntimeFromAdminState();

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.agents.defaults.model).toEqual({ primary: 'anthropic/claude-sonnet-4-20250514' });
    expect(config.agents.defaults.sandbox).toEqual({ mode: 'all', scope: 'agent', workspaceAccess: 'rw' });
    expect(config.tools.allow).toEqual(['read']);
    expect(config.tools.deny).toEqual(['browser']);
    expect(config.tools.elevated).toEqual({ enabled: false });

    const manifestPath = path.join(tmpRoot, 'workspaces', 'agent-1', 'config', 'buildai-mcp.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    expect(mocks.writeAgentAuthProfile).toHaveBeenCalledWith(
      'agent-1',
      'anthropic/claude-sonnet-4-20250514',
      'shared-admin-key',
    );
    expect(mocks.reloadEngine).toHaveBeenCalledTimes(1);
  });
});

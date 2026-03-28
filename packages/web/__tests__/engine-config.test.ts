import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execSyncMock = vi.hoisted(() => vi.fn(() => ''));

vi.mock('child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    default: actual,
    execSync: execSyncMock,
  };
});

const originalConfigPath = process.env.BUILDAI_ENGINE_CONFIG;

let tmpRoot: string;
let configPath: string;

beforeEach(() => {
  vi.resetModules();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'buildai-engine-config-'));
  configPath = path.join(tmpRoot, 'packages', 'engine', 'buildai.config.json5');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ agents: { defaults: {}, list: [] } }, null, 2));
  process.env.BUILDAI_ENGINE_CONFIG = configPath;
});

afterEach(() => {
  execSyncMock.mockReset();
  if (originalConfigPath === undefined) {
    delete process.env.BUILDAI_ENGINE_CONFIG;
  } else {
    process.env.BUILDAI_ENGINE_CONFIG = originalConfigPath;
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('engine-config', () => {
  it.each([
    { provider: 'google', model: 'google/gemini-2.0-flash', envVar: 'GEMINI_API_KEY', profile: 'google:default' },
    { provider: 'anthropic', model: 'anthropic/claude-sonnet-4-20250514', envVar: 'ANTHROPIC_API_KEY', profile: 'anthropic:default' },
    { provider: 'openai', model: 'openai/gpt-4o', envVar: 'OPENAI_API_KEY', profile: 'openai:default' },
  ])('writes provider-specific auth profiles for $provider runtime use', async ({ model, envVar, profile, provider }) => {
    const { writeAgentAuthProfile } = await import('../src/lib/engine-config');

    writeAgentAuthProfile(`agent-${provider}`, model, 'shared-key');

    const envPath = path.join(tmpRoot, 'data', 'agent-env', `agent-${provider}.env`);
    const authPath = path.join(tmpRoot, 'packages', 'engine', '.clawdbot-state', 'agents', `agent-${provider}`, 'agent', 'auth-profiles.json');

    expect(fs.readFileSync(envPath, 'utf-8')).toContain(`${envVar}=shared-key`);

    const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
    expect(auth.profiles[profile]).toMatchObject({
      type: 'token',
      provider,
      token: 'shared-key',
    });
  });

  it('adds and removes agents from the managed engine config', async () => {
    const { addAgentToConfig, removeAgentFromConfig } = await import('../src/lib/engine-config');

    await addAgentToConfig('agent-1', {
      name: 'Agent One',
      workspace: '../../workspaces/agent-1',
      model: 'anthropic/claude-sonnet-4-20250514',
      apiKey: 'anthropic-key',
    });

    let config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.agents.list).toHaveLength(1);
    expect(config.agents.list[0]).toMatchObject({
      id: 'agent-1',
      workspace: '../../workspaces/agent-1',
      model: { primary: 'anthropic/claude-sonnet-4-20250514' },
    });

    await removeAgentFromConfig('agent-1');

    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.agents.list).toEqual([]);
  });

  it('removes persisted auth material when an agent is deleted', async () => {
    const { writeAgentAuthProfile, removeAgentFromConfig } = await import('../src/lib/engine-config');

    writeAgentAuthProfile('agent-1', 'anthropic/claude-sonnet-4-20250514', 'shared-key');

    const envPath = path.join(tmpRoot, 'data', 'agent-env', 'agent-1.env');
    const authDir = path.join(tmpRoot, 'packages', 'engine', '.clawdbot-state', 'agents', 'agent-1');
    expect(fs.existsSync(envPath)).toBe(true);
    expect(fs.existsSync(authDir)).toBe(true);

    await removeAgentFromConfig('agent-1');

    expect(fs.existsSync(envPath)).toBe(false);
    expect(fs.existsSync(authDir)).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const originalConfigPath = process.env.CLAWDBOT_CONFIG_PATH;


async function createRuntimeTools(options: any) {
  const { createClawdbotCodingTools } = await import('../dist/agents/pi-tools.js');
  return createClawdbotCodingTools(options);
}

function makeConfig(workspaceDir: string, overrides: Record<string, unknown> = {}) {
  return {
    tools: {
      allow: ['read'],
      deny: ['browser', 'write', 'edit', 'apply_patch', 'exec', 'process'],
    },
    agents: {
      list: [
        {
          id: 'agent-1',
          workspace: workspaceDir,
        },
      ],
    },
    ...overrides,
  };
}

describe('runtime tool loop policy execution', () => {
  const cleanup: string[] = [];

  beforeEach(() => {
    const tmpConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildai-tool-config-'));
    cleanup.push(tmpConfigDir);
    const configPath = path.join(tmpConfigDir, 'clawdbot.json');
    fs.writeFileSync(configPath, '{}\n', 'utf-8');
    process.env.CLAWDBOT_CONFIG_PATH = configPath;
  });

  afterEach(() => {
    if (originalConfigPath === undefined) {
      delete process.env.CLAWDBOT_CONFIG_PATH;
    } else {
      process.env.CLAWDBOT_CONFIG_PATH = originalConfigPath;
    }
    while (cleanup.length > 0) {
      const target = cleanup.pop();
      if (target) fs.rmSync(target, { recursive: true, force: true });
    }
  });

  it('executes an allowed tool while keeping denied runtime tools unavailable', async () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildai-tool-loop-'));
    cleanup.push(workspaceDir);
    fs.writeFileSync(path.join(workspaceDir, 'notes.txt'), 'hello runtime\n', 'utf-8');

    const tools = await createRuntimeTools({
      config: makeConfig(workspaceDir),
      sessionKey: 'agent:agent-1:main',
      workspaceDir,
      modelProvider: 'google',
      modelId: 'gemini-2.0-flash',
    });

    const names = tools.map((tool) => tool.name);
    expect(names).toContain('read');
    expect(names).not.toContain('browser');
    expect(names).not.toContain('exec');
    expect(names).not.toContain('write');

    const readTool = tools.find((tool) => tool.name === 'read');
    expect(readTool).toBeTruthy();

    const result = await readTool!.execute?.('tool-call-1', { path: 'notes.txt' });
    expect(JSON.stringify(result)).toContain('hello runtime');
  }, 15000);

  it('applies agent-specific tool policy overrides at runtime', async () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildai-tool-agent-'));
    cleanup.push(workspaceDir);

    const tools = await createRuntimeTools({
      config: makeConfig(workspaceDir, {
        tools: {
          allow: ['read', 'browser'],
        },
        agents: {
          list: [
            {
              id: 'agent-1',
              workspace: workspaceDir,
              tools: {
                allow: ['browser'],
                deny: ['read'],
              },
            },
          ],
        },
      }),
      sessionKey: 'agent:agent-1:main',
      workspaceDir,
      modelProvider: 'google',
      modelId: 'gemini-2.0-flash',
    });

    const names = tools.map((tool) => tool.name);
    expect(names).toContain('browser');
    expect(names).not.toContain('read');
  });

  it('blocks sandboxed read attempts outside the agent workspace', async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildai-tool-sandbox-'));
    const workspaceDir = path.join(rootDir, 'workspace');
    const outsidePath = path.join(rootDir, 'outside.txt');
    cleanup.push(rootDir);

    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, 'inside.txt'), 'inside\n', 'utf-8');
    fs.writeFileSync(outsidePath, 'outside\n', 'utf-8');

    const tools = await createRuntimeTools({
      config: makeConfig(workspaceDir),
      sessionKey: 'agent:agent-1:main',
      workspaceDir,
      modelProvider: 'google',
      modelId: 'gemini-2.0-flash',
      sandbox: {
        enabled: true,
        workspaceDir,
        workspaceAccess: 'rw',
        containerName: 'sandbox-agent-1',
        containerWorkdir: workspaceDir,
        docker: { env: {} },
        tools: { allow: ['read'] },
        browserAllowHostControl: false,
      },
    });

    const readTool = tools.find((tool) => tool.name === 'read');
    expect(readTool).toBeTruthy();

    await expect(readTool!.execute?.('tool-call-2', { path: '../outside.txt' })).rejects.toThrow(/outside|sandbox|workspace/i);
    const insideResult = await readTool!.execute?.('tool-call-3', { path: 'inside.txt' });
    expect(JSON.stringify(insideResult)).toContain('inside');
  });
});

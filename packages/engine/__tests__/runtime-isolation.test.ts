import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { updateSessionStore, loadSessionStore, clearSessionStoreCacheForTest } from '../dist/config/sessions/store.js';
import { resolveStorePath } from '../dist/config/sessions/paths.js';
import { toAgentStoreSessionKey } from '../dist/routing/session-key.js';
import { resolveSandboxScopeKey, resolveSandboxWorkspaceDir } from '../dist/agents/sandbox/shared.js';

describe('runtime isolation primitives', () => {
  const cleanup: string[] = [];

  afterEach(() => {
    clearSessionStoreCacheForTest();
    while (cleanup.length > 0) {
      const target = cleanup.pop();
      if (target) fs.rmSync(target, { recursive: true, force: true });
    }
  });

  it('keeps distinct agents on separate session-store paths and isolated concurrent writes', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'buildai-runtime-iso-'));
    cleanup.push(tmpRoot);

    const template = path.join(tmpRoot, '{agentId}', 'sessions.json');
    const storePathA = resolveStorePath(template, { agentId: 'agent-a' });
    const storePathB = resolveStorePath(template, { agentId: 'agent-b' });

    expect(storePathA).not.toBe(storePathB);

    await Promise.all([
      updateSessionStore(storePathA, (store) => {
        store['agent:agent-a:main'] = { sessionId: 'sess-a', updatedAt: 1 };
      }),
      updateSessionStore(storePathB, (store) => {
        store['agent:agent-b:main'] = { sessionId: 'sess-b', updatedAt: 2 };
      }),
    ]);

    expect(loadSessionStore(storePathA)).toEqual({
      'agent:agent-a:main': expect.objectContaining({ sessionId: 'sess-a' }),
    });
    expect(loadSessionStore(storePathB)).toEqual({
      'agent:agent-b:main': expect.objectContaining({ sessionId: 'sess-b' }),
    });
  });

  it('serializes concurrent writes to the same agent store without clobbering entries', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'buildai-runtime-lock-'));
    cleanup.push(tmpRoot);

    const storePath = path.join(tmpRoot, 'agent-a', 'sessions.json');
    const writes = Array.from({ length: 6 }, (_, index) =>
      updateSessionStore(storePath, (store) => {
        store[`agent:agent-a:thread:${index}`] = {
          sessionId: `sess-${index}`,
          updatedAt: index + 1,
        };
      }),
    );

    await Promise.all(writes);

    const store = loadSessionStore(storePath, { skipCache: true });
    expect(Object.keys(store).sort()).toEqual([
      'agent:agent-a:thread:0',
      'agent:agent-a:thread:1',
      'agent:agent-a:thread:2',
      'agent:agent-a:thread:3',
      'agent:agent-a:thread:4',
      'agent:agent-a:thread:5',
    ]);
  });

  it('derives distinct sandbox scope keys and workspace roots per agent', () => {
    const root = '/virtual/sandboxes';

    const agentAScope = resolveSandboxScopeKey('agent', 'agent:agent-a:main');
    const agentBScope = resolveSandboxScopeKey('agent', 'agent:agent-b:main');
    const agentAThreadScope = resolveSandboxScopeKey('agent', 'agent:agent-a:webchat:user-1:default');

    expect(agentAScope).toBe('agent:agent-a');
    expect(agentBScope).toBe('agent:agent-b');
    expect(agentAThreadScope).toBe('agent:agent-a');
    expect(resolveSandboxWorkspaceDir(root, agentAScope)).not.toBe(resolveSandboxWorkspaceDir(root, agentBScope));
    expect(resolveSandboxWorkspaceDir(root, agentAScope)).toBe(resolveSandboxWorkspaceDir(root, agentAThreadScope));
  });

  it('keeps agent request session keys distinct even when the request key matches', () => {
    const agentAMain = toAgentStoreSessionKey({ agentId: 'agent-a', requestKey: 'main', mainKey: 'main' });
    const agentBMain = toAgentStoreSessionKey({ agentId: 'agent-b', requestKey: 'main', mainKey: 'main' });
    const agentAThread = toAgentStoreSessionKey({ agentId: 'agent-a', requestKey: 'thread:abc', mainKey: 'main' });

    expect(agentAMain).toBe('agent:agent-a:main');
    expect(agentBMain).toBe('agent:agent-b:main');
    expect(agentAThread).toBe('agent:agent-a:thread:abc');
    expect(agentAMain).not.toBe(agentBMain);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { updateSessionStore, clearSessionStoreCacheForTest } from '../dist/config/sessions/store.js';
import { appendAssistantMessageToSessionTranscript } from '../dist/config/sessions/transcript.js';

function transcriptMessages(filePath: string): string[] {
  const raw = fs.readFileSync(filePath, 'utf-8').trim().split(/\r?\n/).filter(Boolean);
  return raw.slice(1).map((line) => JSON.parse(line).message?.content?.[0]?.text).filter(Boolean);
}

describe('runtime transcript concurrency isolation', () => {
  const cleanup: string[] = [];

  afterEach(() => {
    clearSessionStoreCacheForTest();
    while (cleanup.length > 0) {
      const target = cleanup.pop();
      if (target) fs.rmSync(target, { recursive: true, force: true });
    }
  });

  it('keeps concurrent transcript writes isolated per agent workspace', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'buildai-runtime-concurrency-'));
    cleanup.push(tmpRoot);

    const storePathA = path.join(tmpRoot, 'agent-a', 'sessions.json');
    const storePathB = path.join(tmpRoot, 'agent-b', 'sessions.json');
    const transcriptA = path.join(tmpRoot, 'agent-a', 'session-a.jsonl');
    const transcriptB = path.join(tmpRoot, 'agent-b', 'session-b.jsonl');

    await updateSessionStore(storePathA, (store) => {
      store['agent:agent-a:main'] = { sessionId: 'session-a', sessionFile: transcriptA, updatedAt: 1 };
    });
    await updateSessionStore(storePathB, (store) => {
      store['agent:agent-b:main'] = { sessionId: 'session-b', sessionFile: transcriptB, updatedAt: 1 };
    });

    await Promise.all([
      ...Array.from({ length: 10 }, (_, index) => appendAssistantMessageToSessionTranscript({
        agentId: 'agent-a',
        sessionKey: 'agent:agent-a:main',
        storePath: storePathA,
        text: `agent-a-${index}`,
      })),
      ...Array.from({ length: 10 }, (_, index) => appendAssistantMessageToSessionTranscript({
        agentId: 'agent-b',
        sessionKey: 'agent:agent-b:main',
        storePath: storePathB,
        text: `agent-b-${index}`,
      })),
    ]);

    const messagesA = transcriptMessages(transcriptA);
    const messagesB = transcriptMessages(transcriptB);

    expect(messagesA).toHaveLength(10);
    expect(messagesB).toHaveLength(10);
    expect(messagesA.every((text) => text.startsWith('agent-a-'))).toBe(true);
    expect(messagesB.every((text) => text.startsWith('agent-b-'))).toBe(true);
  });

  it('preserves all concurrent writes to the same session transcript without duplicate headers', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'buildai-runtime-session-'));
    cleanup.push(tmpRoot);

    const storePath = path.join(tmpRoot, 'agent-a', 'sessions.json');
    const transcriptPath = path.join(tmpRoot, 'agent-a', 'shared-session.jsonl');

    await updateSessionStore(storePath, (store) => {
      store['agent:agent-a:main'] = { sessionId: 'shared-session', sessionFile: transcriptPath, updatedAt: 1 };
    });

    await Promise.all(
      Array.from({ length: 12 }, (_, index) => appendAssistantMessageToSessionTranscript({
        agentId: 'agent-a',
        sessionKey: 'agent:agent-a:main',
        storePath,
        text: `same-session-${index}`,
      })),
    );

    const lines = fs.readFileSync(transcriptPath, 'utf-8').trim().split(/\r?\n/).filter(Boolean);
    const headers = lines.filter((line) => JSON.parse(line).type === 'session');
    const messages = lines.filter((line) => JSON.parse(line).type === 'message').map((line) => JSON.parse(line).message.content[0].text);

    expect(headers).toHaveLength(1);
    expect(messages).toHaveLength(12);
    expect(new Set(messages)).toEqual(new Set(Array.from({ length: 12 }, (_, index) => `same-session-${index}`)));
  });
});

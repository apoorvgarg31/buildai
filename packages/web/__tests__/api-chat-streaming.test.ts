import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mockChatSendStream = vi.hoisted(() => vi.fn());

vi.mock('../src/lib/api-guard', () => ({
  requireSignedIn: vi.fn(async () => ({
    userId: 'user-1',
    role: 'user',
    agentId: 'agent-1',
    email: 'u@example.com',
  })),
  assertCanAccessAgent: vi.fn(() => undefined),
}));

vi.mock('../src/lib/admin-db', () => ({
  writeAuditEvent: vi.fn(),
}));

const mockClient = {
  isConnected: true,
  connect: vi.fn(async () => undefined),
  chatSendStream: mockChatSendStream,
  chatSend: vi.fn(async () => ({ response: 'ok', sessionKey: 'webchat:test' })),
};

vi.mock('../src/lib/gateway-client', () => ({
  getGatewayClient: vi.fn(() => mockClient),
}));

import { POST } from '../src/app/api/chat/route';

function createRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

type StreamEvent = Record<string, unknown>;

async function readSseEvents(response: Response): Promise<StreamEvent[]> {
  const reader = response.body?.getReader();
  expect(reader).toBeDefined();

  const decoder = new TextDecoder();
  let buffer = '';
  const events: StreamEvent[] = [];

  while (true) {
    const read = await reader!.read();
    if (read.done) break;

    buffer += decoder.decode(read.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      events.push(JSON.parse(line.slice(6)) as StreamEvent);
    }
  }

  return events;
}

describe('/api/chat streaming behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns SSE with user-facing event types (thinking/tool/delta/done)', async () => {
    mockChatSendStream.mockImplementationOnce(async (_sessionKey, _message, onDelta, onSideEvent) => {
      onSideEvent?.({ type: 'thinking', text: 'Checking project records...' });
      onSideEvent?.({ type: 'tool', name: 'database_query' });
      onDelta('Found 3 open RFIs');
      return { response: 'Found 3 open RFIs', sessionKey: 'webchat:test' };
    });

    const res = await POST(createRequest({ message: 'Show open RFIs' }) as unknown as NextRequest);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const events = await readSseEvents(res);
    const types = events.map((e) => e.type);

    expect(types).toContain('thinking');
    expect(types).toContain('tool');
    expect(types).toContain('delta');
    expect(types).toContain('done');
  });

  it('does not expose raw tool input/output blobs in SSE events', async () => {
    mockChatSendStream.mockImplementationOnce(async (_sessionKey, _message, onDelta, onSideEvent) => {
      onSideEvent?.({ type: 'tool', name: 'database_query' });
      onDelta('Working on your request...');
      return { response: 'Done', sessionKey: 'webchat:test' };
    });

    const res = await POST(createRequest({ message: 'Check status' }) as unknown as NextRequest);
    const events = await readSseEvents(res);

    for (const event of events) {
      expect(event).not.toHaveProperty('input');
      expect(event).not.toHaveProperty('output');
      expect(event).not.toHaveProperty('rawToolOutput');
      expect(event).not.toHaveProperty('toolInput');
    }
  });

  it('always emits final delta + done for stable non-technical UX', async () => {
    mockChatSendStream.mockImplementationOnce(async (_sessionKey, _message, _onDelta, onSideEvent) => {
      onSideEvent?.({ type: 'thinking', text: 'Drafting response...' });
      return { response: 'Final answer from agent', sessionKey: 'webchat:test' };
    });

    const res = await POST(createRequest({ message: 'Summarize progress' }) as unknown as NextRequest);
    const events = await readSseEvents(res);

    const deltaEvents = events.filter((e) => e.type === 'delta');
    const doneEvents = events.filter((e) => e.type === 'done');

    expect(deltaEvents.length).toBeGreaterThan(0);
    expect(deltaEvents[deltaEvents.length - 1]?.text).toBe('Final answer from agent');
    expect(doneEvents.length).toBe(1);
  });

  it('emits stream error event instead of crashing the connection', async () => {
    mockChatSendStream.mockRejectedValueOnce(new Error('Gateway timeout'));

    const res = await POST(createRequest({ message: 'Hello' }) as unknown as NextRequest);
    const events = await readSseEvents(res);

    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(String(errorEvent?.message || '')).toContain('Gateway timeout');
  });

  it('returns 400 for invalid user message before starting stream', async () => {
    const res = await POST(createRequest({ message: '   ' }) as unknown as NextRequest);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('empty');
    expect(mockChatSendStream).not.toHaveBeenCalled();
  });
});

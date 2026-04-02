import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const requireSignedInMock = vi.hoisted(() => vi.fn());
const assertCanAccessAgentMock = vi.hoisted(() => vi.fn());
const writeAuditEventMock = vi.hoisted(() => vi.fn());
const chatHistoryMock = vi.hoisted(() => vi.fn());

vi.mock('../src/lib/api-guard', () => ({
  requireSignedIn: requireSignedInMock,
  assertCanAccessAgent: assertCanAccessAgentMock,
}));

vi.mock('../src/lib/admin-db', () => ({
  writeAuditEvent: writeAuditEventMock,
}));

const connectMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../src/lib/gateway-client', () => ({
  getGatewayClient: vi.fn(() => ({
    connect: connectMock,
    chatHistory: chatHistoryMock,
  })),
}));

import { GET } from '../src/app/api/chat/history/route';

describe('/api/chat/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSignedInMock.mockResolvedValue({
      userId: 'user-1',
      role: 'user',
      agentId: 'agent-1',
      email: 'u@example.com',
    });
    assertCanAccessAgentMock.mockReturnValue(undefined);
  });

  it('loads and normalizes chat history for the current user session', async () => {
    chatHistoryMock.mockResolvedValue({
      messages: [
        { role: 'user', content: 'Show me open RFIs', timestamp: 1_700_000_000_000 },
        { role: 'assistant', content: [{ type: 'text', text: 'Found 4 open RFIs\n[message_id:abc123]' }], timestamp: 1_700_000_100_000 },
        { role: 'system', content: 'ignore-me', timestamp: 1_700_000_200_000 },
      ],
    });

    const req = { nextUrl: new URL('http://localhost/api/chat/history?sessionId=default-chat') } as NextRequest;
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(chatHistoryMock).toHaveBeenCalledWith('webchat:user-1:default-chat', 100);
    expect(data.messages).toHaveLength(2);
    expect(data.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Found 4 open RFIs',
    });
    expect(data.sessionKey).toBe('webchat:user-1:default-chat');
  });

  it('normalizes shared-agent history requests into a per-user namespace', async () => {
    chatHistoryMock.mockResolvedValue({
      messages: [
        { role: 'assistant', content: 'Your private thread', timestamp: 1_700_000_100_000 },
      ],
    });

    const req = { nextUrl: new URL('http://localhost/api/chat/history?sessionId=agent:agent-1:webchat:default') } as NextRequest;
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(assertCanAccessAgentMock).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }), 'agent-1');
    expect(chatHistoryMock).toHaveBeenCalledWith('agent:agent-1:webchat:user-1:default', 100);
    expect(data.sessionKey).toBe('agent:agent-1:webchat:user-1:default');
    expect(data.messages[0]).toMatchObject({ content: 'Your private thread' });
  });

  it("rewrites another user's shared-agent session key before loading history", async () => {
    chatHistoryMock.mockResolvedValue({ messages: [] });

    const req = { nextUrl: new URL('http://localhost/api/chat/history?sessionId=agent:agent-1:webchat:other-user:default') } as NextRequest;
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(chatHistoryMock).toHaveBeenCalledWith('agent:agent-1:webchat:user-1:default', 100);
    expect(data.sessionKey).toBe('agent:agent-1:webchat:user-1:default');
  });

  it('rejects requests without a session id', async () => {
    const req = { nextUrl: new URL('http://localhost/api/chat/history') } as NextRequest;
    const res = await GET(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('validation_error');
  });

  it('blocks agent-scoped sessions the actor cannot access', async () => {
    assertCanAccessAgentMock.mockImplementationOnce(() => {
      throw new Error('FORBIDDEN');
    });

    const req = { nextUrl: new URL('http://localhost/api/chat/history?sessionId=agent:agent-9:webchat:default') } as NextRequest;
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe('forbidden_session');
    expect(writeAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      action: 'chat.history.denied',
      entityId: 'agent:agent-9:webchat:user-1:default',
    }));
  });

  it('returns 401 when the actor is not signed in', async () => {
    requireSignedInMock.mockRejectedValueOnce(new Error('UNAUTHENTICATED'));

    const req = { nextUrl: new URL('http://localhost/api/chat/history?sessionId=default-chat') } as NextRequest;
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe('unauthenticated');
  });

  it('returns 502 when the gateway history call fails', async () => {
    chatHistoryMock.mockRejectedValueOnce(new Error('gateway offline'));

    const req = { nextUrl: new URL('http://localhost/api/chat/history?sessionId=default-chat') } as NextRequest;
    const res = await GET(req);

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.code).toBe('chat_history_error');
  });
});

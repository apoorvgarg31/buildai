import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireSignedIn: vi.fn(),
  assertCanAccessAgent: vi.fn(),
  writeAuditEvent: vi.fn(),
  chatSend: vi.fn(),
  chatSendStream: vi.fn(),
  chatHistory: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('@/lib/api-guard', () => ({
  requireSignedIn: mocks.requireSignedIn,
  assertCanAccessAgent: mocks.assertCanAccessAgent,
}));

vi.mock('@/lib/gateway-client', () => ({
  getGatewayClient: vi.fn(() => ({
    isConnected: true,
    connect: mocks.connect,
    chatSend: mocks.chatSend,
    chatSendStream: mocks.chatSendStream,
    chatHistory: mocks.chatHistory,
  })),
}));

vi.mock('@/lib/admin-db', () => ({
  writeAuditEvent: mocks.writeAuditEvent,
}));

import { POST as chatPOST } from '../src/app/api/chat/route';
import { GET as historyGET } from '../src/app/api/chat/history/route';

function request(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('OA-3/5 chat auth + org isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSignedIn.mockResolvedValue({
      userId: 'u1',
      role: 'user',
      agentId: 'agent-a',
      orgId: 'org-a',
      email: 'u1@example.com',
    });
    mocks.chatSend.mockResolvedValue({ response: 'ok' });
    mocks.chatSendStream.mockResolvedValue({ response: 'ok', sessionKey: 'agent:agent-a:session' });
    mocks.chatHistory.mockResolvedValue({ messages: [] });
  });

  it('AC-OA3-09 blocks unauthenticated /api/chat calls with standard auth error contract', async () => {
    mocks.requireSignedIn.mockRejectedValueOnce(new Error('UNAUTHENTICATED'));

    const res = await chatPOST(request({ message: 'hello', stream: false }) as unknown as NextRequest);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.code).toBe('unauthenticated');
    expect(typeof data.requestId).toBe('string');
    expect(mocks.chatSend).not.toHaveBeenCalled();
  });

  it('AC-OA3-10 enforces org/agent isolation for /api/chat/history session access', async () => {
    mocks.assertCanAccessAgent.mockImplementationOnce(() => {
      throw new Error('FORBIDDEN_ORG_MISMATCH');
    });

    const req = {
      nextUrl: new URL('http://localhost/api/chat/history?sessionId=agent:agent-b:session-1'),
    } as unknown as NextRequest;

    const res = await historyGET(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe('forbidden_session');
  });

  it('AC-OA5-03 chat/history errors conform to API error contract', async () => {
    mocks.requireSignedIn.mockRejectedValueOnce(new Error('UNAUTHENTICATED'));

    const req = {
      nextUrl: new URL('http://localhost/api/chat/history?sessionId=agent:agent-a:session-1'),
    } as unknown as NextRequest;

    const res = await historyGET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(typeof data.code).toBe('string');
    expect(typeof data.message).toBe('string');
    expect(typeof data.requestId).toBe('string');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const requireSignedInMock = vi.hoisted(() => vi.fn());
const assertCanAccessAgentMock = vi.hoisted(() => vi.fn());
const writeAuditEventMock = vi.hoisted(() => vi.fn());
const chatSendMock = vi.hoisted(() => vi.fn());

vi.mock('../src/lib/api-guard', () => ({
  requireSignedIn: requireSignedInMock,
  assertCanAccessAgent: assertCanAccessAgentMock,
}));

vi.mock('../src/lib/admin-db', () => ({
  writeAuditEvent: writeAuditEventMock,
}));

vi.mock('../src/lib/gateway-client', () => ({
  getGatewayClient: vi.fn(() => ({
    chatSend: chatSendMock,
    chatSendStream: vi.fn(),
    connect: vi.fn(),
    isConnected: true,
  })),
}));

import { POST } from '../src/app/api/chat/route';

function req(body: unknown): NextRequest {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('/api/chat ownership guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSignedInMock.mockResolvedValue({
      userId: 'user-1',
      role: 'user',
      agentId: 'agent-own',
      email: 'u@example.com',
    });
    assertCanAccessAgentMock.mockImplementation(() => undefined);
    chatSendMock.mockResolvedValue({ response: 'ok' });
  });

  it('denies cross-user webchat session ids', async () => {
    const res = await POST(req({ message: 'hello', stream: false, sessionId: 'webchat:other-user:abc' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessionId).toBe('webchat:user-1:abc');
  });

  it('denies inaccessible agent sessions and emits audit event', async () => {
    assertCanAccessAgentMock.mockImplementationOnce(() => {
      throw new Error('FORBIDDEN');
    });

    const res = await POST(req({ message: 'hello', stream: false, sessionId: 'agent:agent-other:webchat:default' }));
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.code).toBe('forbidden_session');
    expect(writeAuditEventMock).toHaveBeenCalled();
    expect(chatSendMock).not.toHaveBeenCalled();
  });
});

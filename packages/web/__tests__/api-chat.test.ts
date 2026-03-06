/**
 * Test: /api/chat route
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('../src/lib/api-guard', () => ({
  requireSignedIn: vi.fn(async () => ({
    userId: 'user-1',
    role: 'user',
    agentId: 'agent-1',
    email: 'u@example.com',
    isSuperadmin: false,
    orgId: 'org-1',
  })),
  assertCanAccessAgent: vi.fn(() => undefined),
}));

vi.mock('../src/lib/admin-db', () => ({
  writeAuditEvent: vi.fn(),
}));

vi.mock('../src/lib/gateway-client', () => {
  const mockClient = {
    isConnected: true,
    connect: vi.fn(async () => undefined),
    chatSend: vi.fn(async (sessionKey: string, message: string) => {
      void sessionKey;
      void message;
      return { response: 'Mocked assistant response' };
    }),
    chatSendStream: vi.fn(async (sessionKey: string, message: string, onDelta: (t: string) => void) => {
      void sessionKey;
      void message;
      onDelta('Mocked ');
      onDelta('Mocked assistant response');
      return { response: 'Mocked assistant response' };
    }),
  };

  return {
    getGatewayClient: vi.fn(() => mockClient),
  };
});

import { GET, POST } from '../src/app/api/chat/route';

function createRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost:3000/api/chat', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method !== 'GET' ? JSON.stringify(body) : undefined,
  });
}

describe('/api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET (health check)', () => {
    it('should return status ok/engine_unavailable shape', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(['ok', 'engine_unavailable']).toContain(data.status);
    });
  });

  describe('POST (non-streaming)', () => {
    it('should return a response for valid message', async () => {
      const req = createRequest({ message: 'Hello', stream: false });
      const response = await POST(req as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.response).toBe('string');
      expect(data.response.length).toBeGreaterThan(0);
    });

    it('should return a session ID and timestamp', async () => {
      const req = createRequest({ message: 'Hello', stream: false, sessionId: 'test-session-123' });
      const response = await POST(req as unknown as NextRequest);
      const data = await response.json();

      expect(data.sessionId).toBe('webchat:user-1:test-session-123');
      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });
  });

  describe('POST (error handling)', () => {
    it('should return 400 for missing message', async () => {
      const req = createRequest({});
      const response = await POST(req as unknown as NextRequest);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should return 400 for empty message', async () => {
      const req = createRequest({ message: '   ' });
      const response = await POST(req as unknown as NextRequest);

      expect(response.status).toBe(400);
    });

    it('should return 400 for non-string message', async () => {
      const req = createRequest({ message: 123 });
      const response = await POST(req as unknown as NextRequest);

      expect(response.status).toBe(400);
    });

    it('should return 400 for message exceeding max length', async () => {
      const req = createRequest({ message: 'x'.repeat(10001) });
      const response = await POST(req as unknown as NextRequest);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('too long');
    });

    it('should return 502 for invalid JSON body', async () => {
      const req = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{{{',
      });
      const response = await POST(req as unknown as NextRequest);

      expect(response.status).toBe(502);
    });
  });
});

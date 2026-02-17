/**
 * Test: /api/chat route
 * 
 * Tests the chat API route handler directly using Next.js request/response objects.
 */

import { describe, it, expect } from 'vitest';

// Import the route handlers
import { POST, GET } from '../src/app/api/chat/route';

function createRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost:3000/api/chat', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method !== 'GET' ? JSON.stringify(body) : undefined,
  });
}

describe('/api/chat', () => {

  describe('GET (health check)', () => {
    it('should return status ok', async () => {
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.engine).toBeDefined();
    });

    it('should report mock mode by default', async () => {
      const response = await GET();
      const data = await response.json();
      
      expect(data.engine).toBe('mock');
    });
  });

  describe('POST (send message)', () => {
    it('should return a response for valid message', async () => {
      const req = createRequest({ message: 'Hello' });
      const response = await POST(req as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.response).toBeDefined();
      expect(typeof data.response).toBe('string');
      expect(data.response.length).toBeGreaterThan(0);
    });

    it('should return a session ID', async () => {
      const req = createRequest({ message: 'Hello' });
      const response = await POST(req as any);
      const data = await response.json();

      expect(data.sessionId).toBeDefined();
      expect(typeof data.sessionId).toBe('string');
      expect(data.sessionId).toMatch(/^session-/);
    });

    it('should return a timestamp', async () => {
      const req = createRequest({ message: 'Hello' });
      const response = await POST(req as any);
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      // Should be a valid ISO timestamp
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });

    it('should return source as mock', async () => {
      const req = createRequest({ message: 'Hello' });
      const response = await POST(req as any);
      const data = await response.json();

      expect(data.source).toBe('mock');
    });

    it('should use provided session ID', async () => {
      const req = createRequest({ message: 'Hello', sessionId: 'test-session-123' });
      const response = await POST(req as any);
      const data = await response.json();

      expect(data.sessionId).toBe('test-session-123');
    });

    it('should return RFI-related response for RFI query', async () => {
      const req = createRequest({ message: 'Show me open RFIs' });
      const response = await POST(req as any);
      const data = await response.json();

      expect(data.response.toLowerCase()).toContain('rfi');
    });

    it('should return budget-related response for budget query', async () => {
      const req = createRequest({ message: 'What is the budget status?' });
      const response = await POST(req as any);
      const data = await response.json();

      expect(data.response.toLowerCase()).toMatch(/budget|cost/);
    });

    it('should return schedule-related response for schedule query', async () => {
      const req = createRequest({ message: 'Any schedule delays?' });
      const response = await POST(req as any);
      const data = await response.json();

      expect(data.response.toLowerCase()).toMatch(/schedule|milestone|delay/);
    });
  });

  describe('POST (error handling)', () => {
    it('should return 400 for missing message', async () => {
      const req = createRequest({});
      const response = await POST(req as any);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should return 400 for empty message', async () => {
      const req = createRequest({ message: '   ' });
      const response = await POST(req as any);

      expect(response.status).toBe(400);
    });

    it('should return 400 for non-string message', async () => {
      const req = createRequest({ message: 123 });
      const response = await POST(req as any);

      expect(response.status).toBe(400);
    });

    it('should return 400 for message exceeding max length', async () => {
      const req = createRequest({ message: 'x'.repeat(10001) });
      const response = await POST(req as any);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('too long');
    });

    it('should return 500 for invalid JSON body', async () => {
      const req = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{{{',
      });
      const response = await POST(req as any);

      expect(response.status).toBe(500);
    });
  });
});

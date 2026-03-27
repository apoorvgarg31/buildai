import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import ChatArea from '../src/components/ChatArea';

describe('ChatArea history reload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('loads persisted history for the default agent session on mount', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/api/chat') {
        return { ok: true, json: async () => ({ status: 'ok' }) } as Response;
      }
      if (input === '/api/artifacts?agentId=agent-1') {
        return { ok: true, json: async () => [] } as Response;
      }
      if (input === '/api/chat/history?sessionId=agent%3Aagent-1%3Awebchat%3Adefault') {
        return {
          ok: true,
          json: async () => ({
            messages: [
              { id: 'msg-1', role: 'user', content: 'Show me today\'s RFIs', timestamp: '2026-03-27T10:00:00.000Z' },
              { id: 'msg-2', role: 'assistant', content: 'Here are your open RFIs.', timestamp: '2026-03-27T10:00:05.000Z' },
            ],
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as typeof fetch);

    render(<ChatArea agentId="agent-1" />);

    await waitFor(() => {
      expect(screen.getByText("Show me today's RFIs")).toBeDefined();
      expect(screen.getByText('Here are your open RFIs.')).toBeDefined();
    });
  });

  it('shows the compaction hint when a long session history is reloaded', async () => {
    const longHistory = Array.from({ length: 95 }, (_, index) => ({
      id: `msg-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${index}`,
      timestamp: '2026-03-27T10:00:00.000Z',
    }));

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/api/chat') {
        return { ok: true, json: async () => ({ status: 'ok' }) } as Response;
      }
      if (input === '/api/artifacts?agentId=agent-1') {
        return { ok: true, json: async () => [] } as Response;
      }
      if (input === '/api/chat/history?sessionId=agent%3Aagent-1%3Awebchat%3Adefault') {
        return {
          ok: true,
          json: async () => ({ messages: longHistory }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as typeof fetch);

    render(<ChatArea agentId="agent-1" />);

    await waitFor(() => {
      expect(screen.getByText('Older context may be compacted by the engine to keep chat fast.')).toBeDefined();
    });
  });
});

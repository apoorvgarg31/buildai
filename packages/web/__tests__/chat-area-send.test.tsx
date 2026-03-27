import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChatArea from '../src/components/ChatArea';

function createSseResponse(events: Array<Record<string, unknown>>): Response {
  const encoder = new TextEncoder();
  const chunks = events.map((event) => encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
  } as Response;
}

describe('ChatArea send and session continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('accumulates streaming deltas into a single assistant reply', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (input === '/api/chat' && !init?.method) {
          return { ok: true, json: async () => ({ status: 'ok' }) } as Response;
        }
        if (input === '/api/artifacts?agentId=agent-1') {
          return { ok: true, json: async () => [] } as Response;
        }
        if (input === '/api/chat/history?sessionId=agent%3Aagent-1%3Awebchat%3Adefault') {
          return { ok: true, json: async () => ({ messages: [] }) } as Response;
        }
        if (input === '/api/chat' && init?.method === 'POST') {
          return createSseResponse([
            { type: 'delta', text: 'Hello' },
            { type: 'delta', text: ' world' },
            { type: 'done', sessionId: 'agent:agent-1:webchat:default' },
          ]);
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }) as typeof fetch,
    );

    render(<ChatArea agentId="agent-1" />);

    const textarea = screen.getByPlaceholderText('Ask Mira anything about your project');
    fireEvent.change(textarea, { target: { value: 'Status update' } });

    const sendButton = screen.getByTitle('Send message') as HTMLButtonElement;
    await waitFor(() => {
      expect(sendButton.disabled).toBe(false);
    });

    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeDefined();
    });
  });


  it('does not duplicate cumulative or final stream text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (input === '/api/chat' && !init?.method) {
          return { ok: true, json: async () => ({ status: 'ok' }) } as Response;
        }
        if (input === '/api/artifacts?agentId=agent-1') {
          return { ok: true, json: async () => [] } as Response;
        }
        if (input === '/api/chat/history?sessionId=agent%3Aagent-1%3Awebchat%3Adefault') {
          return { ok: true, json: async () => ({ messages: [] }) } as Response;
        }
        if (input === '/api/chat' && init?.method === 'POST') {
          return createSseResponse([
            { type: 'delta', text: 'Mocked ' },
            { type: 'delta', text: 'Mocked assistant response' },
            { type: 'delta', text: 'Mocked assistant response' },
            { type: 'done', sessionId: 'agent:agent-1:webchat:default' },
          ]);
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }) as typeof fetch,
    );

    render(<ChatArea agentId="agent-1" />);

    const textarea = screen.getByPlaceholderText('Ask Mira anything about your project');
    fireEvent.change(textarea, { target: { value: 'Summarize progress' } });

    const sendButton = screen.getByTitle('Send message') as HTMLButtonElement;
    await waitFor(() => {
      expect(sendButton.disabled).toBe(false);
    });

    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Mocked assistant response')).toBeDefined();
    });

    expect(screen.queryAllByText('Mocked assistant response')).toHaveLength(1);
  });

  it('shows a warning if sending fails and keeps the user message visible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (input === '/api/chat' && !init?.method) {
          return { ok: true, json: async () => ({ status: 'ok' }) } as Response;
        }
        if (input === '/api/artifacts?agentId=agent-1') {
          return { ok: true, json: async () => [] } as Response;
        }
        if (input === '/api/chat/history?sessionId=agent%3Aagent-1%3Awebchat%3Adefault') {
          return { ok: true, json: async () => ({ messages: [] }) } as Response;
        }
        if (input === '/api/chat' && init?.method === 'POST') {
          return {
            ok: true,
            body: new ReadableStream({
              start(controller) {
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({ type: 'error', message: 'Gateway timeout' })}\n\n`,
                  ),
                );
                controller.close();
              },
            }),
          } as Response;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }) as typeof fetch,
    );

    render(<ChatArea agentId="agent-1" />);

    const textarea = screen.getByPlaceholderText('Ask Mira anything about your project');
    fireEvent.change(textarea, { target: { value: 'Open issues?' } });

    const sendButton = screen.getByTitle('Send message') as HTMLButtonElement;
    await waitFor(() => {
      expect(sendButton.disabled).toBe(false);
    });

    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Open issues?')).toBeDefined();
      expect(screen.getByText('Warning: Gateway timeout. Please try again.')).toBeDefined();
    });
  });

  it('adopts the scoped history session before sending on a shared agent', async () => {
    const requestBodies: Array<{ message: string; sessionId: string | null }> = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (input === '/api/chat' && !init?.method) {
          return { ok: true, json: async () => ({ status: 'ok' }) } as Response;
        }
        if (input === '/api/artifacts?agentId=agent-1') {
          return { ok: true, json: async () => [] } as Response;
        }
        if (input === '/api/chat/history?sessionId=agent%3Aagent-1%3Awebchat%3Adefault') {
          return {
            ok: true,
            json: async () => ({
              sessionKey: 'agent:agent-1:webchat:user-1:default',
              messages: [],
            }),
          } as Response;
        }
        if (input === '/api/chat' && init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as { message: string; sessionId: string | null };
          requestBodies.push({ message: body.message, sessionId: body.sessionId });

          return createSseResponse([
            { type: 'delta', text: `Reply for ${body.message}` },
            { type: 'done', sessionId: 'agent:agent-1:webchat:user-1:continued' },
          ]);
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }) as typeof fetch,
    );

    render(<ChatArea agentId="agent-1" />);

    const input = screen.getByPlaceholderText('Ask Mira anything about your project');
    const sendButton = screen.getByTitle('Send message') as HTMLButtonElement;

    fireEvent.change(input, { target: { value: 'First message' } });
    await waitFor(() => {
      expect(sendButton.disabled).toBe(false);
    });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Reply for First message')).toBeDefined();
    });

    fireEvent.change(input, { target: { value: 'Second message' } });
    await waitFor(() => {
      expect(sendButton.disabled).toBe(false);
    });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Reply for Second message')).toBeDefined();
    });

    expect(requestBodies).toEqual([
      { message: 'First message', sessionId: 'agent:agent-1:webchat:user-1:default' },
      { message: 'Second message', sessionId: 'agent:agent-1:webchat:user-1:continued' },
    ]);
  });
});

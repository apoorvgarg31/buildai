/**
 * WebSocket Gateway Client for BuildAI Engine.
 *
 * Connects to the Clawdbot-fork engine gateway over WebSocket,
 * performs the hello/hello-ok handshake, sends chat.send requests,
 * and streams back ChatEvent responses.
 *
 * Designed for server-side use in Next.js API routes (Node.js runtime).
 */

import WebSocket from 'ws';

// ── Configuration ───────────────────────────────────────────────
const GATEWAY_URL = process.env.BUILDAI_GATEWAY_URL || 'ws://localhost:18790';
const GATEWAY_TOKEN = process.env.BUILDAI_GATEWAY_TOKEN || '';

// ── Types ───────────────────────────────────────────────────────

export interface ChatEvent {
  runId: string;
  sessionKey: string;
  seq: number;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;
  errorMessage?: string;
  usage?: Record<string, unknown>;
  stopReason?: string;
}

interface HelloOkResponse {
  type: 'hello-ok';
  protocol: number;
  server: { version: string; connId: string };
  features: { methods: string[]; events: string[] };
  snapshot: Record<string, unknown>;
  policy: Record<string, unknown>;
}

interface GatewayResponse {
  type: 'res';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: { code: number; message: string };
}

interface GatewayEvent {
  type: 'event';
  event: string;
  data: ChatEvent;
}

type GatewayFrame = HelloOkResponse | GatewayResponse | GatewayEvent | { type: string; [key: string]: unknown };

// ── Helpers ─────────────────────────────────────────────────────

function generateId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// ── Gateway Client Class ────────────────────────────────────────

export class GatewayClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private handshakeCompleted = false;
  private _connectId: string | null = null;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private eventListeners = new Map<string, Set<(data: ChatEvent) => void>>();
  private connectPromise: Promise<void> | null = null;

  /**
   * Connect to the gateway and complete the handshake.
   * Safe to call multiple times — will reuse existing connection.
   */
  async connect(): Promise<void> {
    if (this.connected && this.handshakeCompleted && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    // If a connection is already in progress, wait for it
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this._doConnect();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async _doConnect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const url = GATEWAY_URL;
      const ws = new WebSocket(url);
      this.ws = ws;

      const connectTimeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Gateway connection timeout (${url})`));
      }, 10_000);

      ws.on('open', () => {
        // Send connect handshake (standard req frame with method 'connect')
        const connectFrame = {
          type: 'req',
          id: 'connect-' + Date.now(),
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: 'webchat',
              version: '1.0.0',
              platform: 'web',
              mode: 'webchat',
            },
            auth: {
              token: GATEWAY_TOKEN,
            },
          },
        };
        this._connectId = connectFrame.id;
        ws.send(JSON.stringify(connectFrame));
      });

      ws.on('message', (rawData: WebSocket.Data) => {
        let frame: GatewayFrame;
        try {
          frame = JSON.parse(rawData.toString()) as GatewayFrame;
        } catch {
          return; // ignore malformed frames
        }

        // Handle connect response (hello-ok is in res.payload)
        if (frame.type === 'res' && (frame as GatewayResponse).id === this._connectId) {
          const res = frame as GatewayResponse;
          clearTimeout(connectTimeout);
          if (res.ok) {
            this.connected = true;
            this.handshakeCompleted = true;
            resolve();
          } else {
            reject(new Error(`Gateway handshake failed: ${res.error?.message || 'unknown'}`));
          }
          return;
        }

        if (frame.type === 'res') {
          const res = frame as GatewayResponse;
          const pending = this.pendingRequests.get(res.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(res.id);
            if (res.ok) {
              pending.resolve(res.result ?? (res as unknown as { payload?: unknown }).payload);
            } else {
              pending.reject(new Error(res.error?.message || 'Gateway request failed'));
            }
          }
          return;
        }

        if (frame.type === 'event') {
          const evt = frame as GatewayEvent;
          // Event data is in 'payload' field, not 'data'
          const eventData = (evt as unknown as { payload?: ChatEvent }).payload || evt.data;
          const listeners = this.eventListeners.get(evt.event);
          if (listeners && eventData) {
            for (const listener of listeners) {
              try {
                listener(eventData);
              } catch {
                // don't let listener errors propagate
              }
            }
          }
          return;
        }
      });

      ws.on('close', () => {
        clearTimeout(connectTimeout);
        this.connected = false;
        this.handshakeCompleted = false;

        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('WebSocket connection closed'));
          this.pendingRequests.delete(id);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(connectTimeout);
        if (!this.handshakeCompleted) {
          reject(new Error(`Gateway connection error: ${err.message}`));
        }
      });
    });
  }

  /**
   * Send a request to the gateway and wait for the response.
   */
  async request(method: string, params: Record<string, unknown>, timeoutMs = 120_000): Promise<unknown> {
    await this.connect();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const id = generateId();
    const frame = { type: 'req', id, method, params };

    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Gateway request timeout: ${method}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.ws!.send(JSON.stringify(frame));
    });
  }

  /**
   * Subscribe to gateway events of a specific type.
   */
  on(event: string, listener: (data: ChatEvent) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(event)?.delete(listener);
    };
  }

  /**
   * Send a chat message and collect the full response.
   * Returns the final assembled message text.
   */
  async chatSend(sessionKey: string, message: string): Promise<{
    response: string;
    sessionKey: string;
    usage?: Record<string, unknown>;
  }> {
    await this.connect();

    const idempotencyKey = generateId();
    let fullMessage = '';

    return new Promise<{ response: string; sessionKey: string; usage?: Record<string, unknown> }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error('Chat response timeout (120s)'));
      }, 120_000);

      // Listen for chat events for this session
      const unsubscribe = this.on('chat', (data: ChatEvent) => {
        if (data.sessionKey !== sessionKey) return;

        if (data.state === 'delta') {
          // Accumulate delta text
          if (data.message && typeof data.message === 'string') {
            fullMessage += data.message;
          } else if (data.message && typeof data.message === 'object') {
            // Message might be structured (like { role, content })
            const msg = data.message as { content?: unknown };
            if (typeof msg.content === 'string') {
              fullMessage += msg.content;
            } else if (Array.isArray(msg.content)) {
              // Handle content blocks
              for (const block of msg.content) {
                if (typeof block === 'string') fullMessage += block;
                else if (block?.text) fullMessage += block.text;
                else if (block?.type === 'text' && block?.text) fullMessage += block.text;
              }
            }
          }
        } else if (data.state === 'final') {
          clearTimeout(timeout);
          unsubscribe();

          // Extract final message text
          let finalText = fullMessage;
          if (data.message) {
            if (typeof data.message === 'string') {
              finalText = data.message;
            } else if (typeof data.message === 'object') {
              const msg = data.message as { content?: unknown; role?: string };
              if (typeof msg.content === 'string') {
                finalText = msg.content;
              } else if (Array.isArray(msg.content)) {
                finalText = msg.content
                  .map((block: unknown) => {
                    if (typeof block === 'string') return block;
                    if ((block as { type?: string; text?: string })?.type === 'text') {
                      return (block as { text: string }).text;
                    }
                    return '';
                  })
                  .join('');
              }
            }
          }

          // If we got no text from the final event but accumulated deltas, use those
          if (!finalText && fullMessage) {
            finalText = fullMessage;
          }

          resolve({
            response: finalText || '(No response)',
            sessionKey,
            usage: data.usage || undefined,
          });
        } else if (data.state === 'error') {
          clearTimeout(timeout);
          unsubscribe();
          reject(new Error(data.errorMessage || 'Chat error from engine'));
        } else if (data.state === 'aborted') {
          clearTimeout(timeout);
          unsubscribe();
          reject(new Error('Chat response was aborted'));
        }
      });

      // Send the chat.send request
      this.request('chat.send', {
        sessionKey,
        message,
        idempotencyKey,
      }).catch((err) => {
        clearTimeout(timeout);
        unsubscribe();
        reject(err);
      });
    });
  }

  /**
   * Get chat history for a session.
   */
  async chatHistory(sessionKey: string, limit = 50): Promise<unknown> {
    return this.request('chat.history', { sessionKey, limit });
  }

  /**
   * Abort an ongoing chat response.
   */
  async chatAbort(sessionKey: string, runId?: string): Promise<unknown> {
    const params: Record<string, unknown> = { sessionKey };
    if (runId) params.runId = runId;
    return this.request('chat.abort', params);
  }

  /**
   * List sessions.
   */
  async sessionsList(): Promise<unknown> {
    return this.request('sessions.list', {});
  }

  /**
   * Close the WebSocket connection.
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.handshakeCompleted = false;
    this.pendingRequests.clear();
    this.eventListeners.clear();
  }

  /**
   * Check if the client is currently connected.
   */
  get isConnected(): boolean {
    return this.connected && this.handshakeCompleted && this.ws?.readyState === WebSocket.OPEN;
  }
}

// ── Singleton for reuse across API route calls ──────────────────

let _client: GatewayClient | null = null;

export function getGatewayClient(): GatewayClient {
  if (!_client) {
    _client = new GatewayClient();
  }
  return _client;
}

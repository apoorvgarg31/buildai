/**
 * WebSocket Gateway Client for BuildAI Engine.
 *
 * Connects to the BuildAI engine gateway over WebSocket,
 * performs the connect handshake, sends chat.send requests,
 * and streams back ChatEvent responses.
 *
 * Designed for server-side use in Next.js API routes (Node.js runtime).
 */

import WebSocket from 'ws';

// ── Configuration ───────────────────────────────────────────────
const GATEWAY_URL = process.env.BUILDAI_GATEWAY_URL || 'ws://localhost:18790';
const GATEWAY_TOKEN = process.env.BUILDAI_GATEWAY_TOKEN || '';

// ── Types ───────────────────────────────────────────────────────

/**
 * Chat event payload as broadcast by the gateway.
 *
 * Delta messages have:
 *   { state: "delta", message: { role: "assistant", content: [{ type: "text", text: "cumulative..." }] } }
 *
 * Final messages have:
 *   { state: "final", message: { role: "assistant", content: [...] } | undefined }
 *
 * Error/aborted have:
 *   { state: "error"|"aborted", errorMessage?: string }
 */
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

interface GatewayResponse {
  type: 'res';
  id: string;
  ok: boolean;
  result?: unknown;
  payload?: unknown;
  error?: { code: number; message: string };
}

interface GatewayEvent {
  type: 'event';
  event: string;
  payload?: unknown;
  data?: unknown;
}

type GatewayFrame = GatewayResponse | GatewayEvent | { type: string; [key: string]: unknown };

// ── Helpers ─────────────────────────────────────────────────────

function generateId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Extract plain text from a gateway chat message payload.
 *
 * The gateway sends messages in Anthropic content-block format:
 *   { role: "assistant", content: [{ type: "text", text: "..." }] }
 *
 * But we also handle plain string messages gracefully.
 */
function extractTextFromMessage(msg: unknown): string {
  if (!msg) return '';

  // Plain string
  if (typeof msg === 'string') return msg;

  if (typeof msg === 'object') {
    const m = msg as Record<string, unknown>;

    // Direct text field (some payloads)
    if (typeof m.text === 'string') return m.text;

    // Content field
    if (typeof m.content === 'string') return m.content;

    if (Array.isArray(m.content)) {
      return m.content
        .map((block: unknown) => {
          if (typeof block === 'string') return block;
          if (block && typeof block === 'object') {
            const b = block as Record<string, unknown>;
            if (typeof b.text === 'string') return b.text;
          }
          return '';
        })
        .join('');
    }
  }

  return '';
}

// ── Reconnection Config ─────────────────────────────────────────
const RECONNECT_INITIAL_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const RECONNECT_BACKOFF = 1.5;

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

  // Reconnection state
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
        // Send connect handshake
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

        // Handle connect response
        if (frame.type === 'res' && (frame as GatewayResponse).id === this._connectId) {
          const res = frame as GatewayResponse;
          clearTimeout(connectTimeout);
          if (res.ok) {
            this.connected = true;
            this.handshakeCompleted = true;
            this.reconnectAttempts = 0; // Reset on successful connect
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
              pending.resolve(res.result ?? res.payload);
            } else {
              pending.reject(new Error(res.error?.message || 'Gateway request failed'));
            }
          }
          return;
        }

        if (frame.type === 'event') {
          const evt = frame as GatewayEvent;
          // Gateway event payload is in the 'payload' field
          const eventData = (evt.payload ?? evt.data) as ChatEvent | undefined;
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

        // Automatic reconnection
        if (this.shouldReconnect) {
          this._scheduleReconnect();
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
   * Schedule a reconnection with exponential backoff.
   */
  private _scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = Math.min(
      RECONNECT_INITIAL_MS * Math.pow(RECONNECT_BACKOFF, this.reconnectAttempts),
      RECONNECT_MAX_MS
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        // connect() failed, the 'close' handler will trigger another reconnect
      }
    }, delay);
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
          // Gateway sends cumulative text in message.content[0].text
          const text = extractTextFromMessage(data.message);
          if (text) {
            fullMessage = text; // Cumulative — replace, don't append
          }
        } else if (data.state === 'final') {
          clearTimeout(timeout);
          unsubscribe();

          // Extract final message text (prefer final message, fall back to accumulated)
          const finalText = extractTextFromMessage(data.message) || fullMessage;

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
   * Send a chat message and stream delta events via a callback.
   * The callback receives cumulative text from the gateway.
   * Returns the final response text.
   */
  async chatSendStream(
    sessionKey: string,
    message: string,
    onDelta: (text: string) => void,
  ): Promise<{ response: string; sessionKey: string }> {
    await this.connect();

    const idempotencyKey = generateId();
    let fullMessage = '';

    return new Promise<{ response: string; sessionKey: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error('Chat response timeout (120s)'));
      }, 120_000);

      const unsubscribe = this.on('chat', (data: ChatEvent) => {
        if (data.sessionKey !== sessionKey) return;

        if (data.state === 'delta' && data.message) {
          const text = extractTextFromMessage(data.message);
          if (text) {
            // Gateway sends cumulative text — track latest
            fullMessage = text;
            onDelta(text);
          }
        } else if (data.state === 'final') {
          clearTimeout(timeout);
          unsubscribe();
          const finalText = extractTextFromMessage(data.message) || fullMessage || '(No response)';
          resolve({ response: finalText, sessionKey });
        } else if (data.state === 'error') {
          clearTimeout(timeout);
          unsubscribe();
          reject(new Error(data.errorMessage || 'Chat error'));
        } else if (data.state === 'aborted') {
          clearTimeout(timeout);
          unsubscribe();
          reject(new Error('Aborted'));
        }
      });

      this.request('chat.send', { sessionKey, message, idempotencyKey }).catch((err) => {
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
   * Disables automatic reconnection.
   */
  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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

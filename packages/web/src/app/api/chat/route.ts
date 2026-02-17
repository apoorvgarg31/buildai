/**
 * POST /api/chat
 *
 * BuildAI chat endpoint — routes messages through the Clawdbot engine gateway.
 *
 * The engine handles:
 *   - LLM orchestration (model selection, prompt engineering)
 *   - Tool dispatch (database queries, Procore API)
 *   - Memory and session management
 *   - Compaction
 *
 * This API route acts as a thin proxy: it forwards messages to the engine
 * gateway via WebSocket and returns the response.
 *
 * Request body:
 *   { message: string, sessionId?: string }
 *
 * Response:
 *   { response: string, sessionId: string, timestamp: string, source: 'engine' | 'fallback' }
 *
 * Falls back to direct Gemini if engine is unavailable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGatewayClient } from '@/lib/gateway-client';

// Lazy import for fallback mode
let fallbackChat: ((sessionId: string, message: string) => Promise<{ response: string; sqlExecuted?: string; rowCount?: number }>) | null = null;

async function getFallbackChat() {
  if (!fallbackChat) {
    try {
      const mod = await import('@/lib/llm');
      fallbackChat = mod.chat;
    } catch {
      fallbackChat = null;
    }
  }
  return fallbackChat;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  timestamp: string;
  source: 'engine' | 'fallback' | 'error';
  sqlExecuted?: string;
  rowCount?: number;
}

/**
 * Resolve a session key for the engine.
 * Engine sessions use the format "webchat:<id>".
 */
function resolveSessionKey(sessionId?: string): string {
  const id = sessionId || `buildai-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  // If it already has the webchat: prefix, use as-is
  if (id.startsWith('webchat:')) return id;
  // Otherwise prefix it for the webchat channel
  return `webchat:${id}`;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ChatResponse | { error: string }>> {
  try {
    const body = (await request.json()) as ChatRequest;

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "message" field' },
        { status: 400 },
      );
    }

    const message = body.message.trim();
    if (message.length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 },
      );
    }

    if (message.length > 10000) {
      return NextResponse.json(
        { error: 'Message too long (max 10000 characters)' },
        { status: 400 },
      );
    }

    const rawSessionId = body.sessionId || `buildai-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const sessionKey = resolveSessionKey(rawSessionId);

    // Try engine gateway first
    const engineAvailable = process.env.BUILDAI_GATEWAY_TOKEN && process.env.BUILDAI_GATEWAY_TOKEN.length > 0;

    if (engineAvailable) {
      try {
        const client = getGatewayClient();
        const result = await client.chatSend(sessionKey, message);

        return NextResponse.json({
          response: result.response,
          sessionId: rawSessionId,
          timestamp: new Date().toISOString(),
          source: 'engine' as const,
        });
      } catch (err) {
        console.error('Engine gateway error, falling back to direct LLM:', err);
        // Fall through to fallback
      }
    }

    // Fallback: direct Gemini (original behavior)
    try {
      const chatFn = await getFallbackChat();
      if (chatFn) {
        const agentResult = await chatFn(rawSessionId, message);
        return NextResponse.json({
          response: agentResult.response,
          sessionId: rawSessionId,
          timestamp: new Date().toISOString(),
          source: 'fallback' as const,
          sqlExecuted: agentResult.sqlExecuted,
          rowCount: agentResult.rowCount,
        });
      }
    } catch (err) {
      console.error('Fallback LLM error:', err);
    }

    // Both engine and fallback failed
    return NextResponse.json({
      response: "I'm having trouble connecting to my AI backend right now. Please try again in a moment.",
      sessionId: rawSessionId,
      timestamp: new Date().toISOString(),
      source: 'error' as const,
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// Health check — reports engine status
export async function GET(): Promise<NextResponse> {
  const engineConfigured = Boolean(process.env.BUILDAI_GATEWAY_TOKEN);
  let engineConnected = false;

  if (engineConfigured) {
    try {
      const client = getGatewayClient();
      engineConnected = client.isConnected;
      if (!engineConnected) {
        // Try to connect
        await client.connect();
        engineConnected = client.isConnected;
      }
    } catch {
      engineConnected = false;
    }
  }

  return NextResponse.json({
    status: 'ok',
    engine: engineConnected ? 'connected' : engineConfigured ? 'configured' : 'fallback',
    database: 'buildai_demo',
  });
}

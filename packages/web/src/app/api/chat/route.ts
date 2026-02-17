/**
 * POST /api/chat
 *
 * Thin proxy to the Clawdbot engine gateway.
 * The engine handles everything: LLM, skills, memory, tools.
 * This route just forwards and returns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGatewayClient } from '@/lib/gateway-client';

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  timestamp: string;
}

function resolveSessionKey(sessionId?: string): string {
  const id = sessionId || `buildai-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  return id.startsWith('webchat:') ? id : `webchat:${id}`;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ChatResponse | { error: string }>> {
  try {
    const body = (await request.json()) as ChatRequest;

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "message" field' }, { status: 400 });
    }

    const message = body.message.trim();
    if (message.length === 0) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }
    if (message.length > 10000) {
      return NextResponse.json({ error: 'Message too long (max 10000 characters)' }, { status: 400 });
    }

    const rawSessionId = body.sessionId || `buildai-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const sessionKey = resolveSessionKey(rawSessionId);

    const client = getGatewayClient();
    const result = await client.chatSend(sessionKey, message);

    return NextResponse.json({
      response: result.response,
      sessionId: rawSessionId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json(
      { error: 'Failed to reach AI engine. Please try again.' },
      { status: 502 },
    );
  }
}

export async function GET(): Promise<NextResponse> {
  let engineConnected = false;
  try {
    const client = getGatewayClient();
    engineConnected = client.isConnected;
    if (!engineConnected) {
      await client.connect();
      engineConnected = client.isConnected;
    }
  } catch {
    engineConnected = false;
  }

  return NextResponse.json({
    status: engineConnected ? 'ok' : 'engine_unavailable',
  });
}

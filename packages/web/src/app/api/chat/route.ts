/**
 * POST /api/chat
 *
 * BuildAI chat endpoint — powered by Gemini 2.0 Flash + PostgreSQL.
 * Takes a user message, routes it through the LLM agent which can
 * query the database, and returns a natural language response.
 *
 * Request body:
 *   { message: string, sessionId?: string }
 *
 * Response:
 *   { response: string, sessionId: string, timestamp: string, source: 'ai' | 'mock', sqlExecuted?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { chat, AgentResponse } from '@/lib/llm';

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  timestamp: string;
  source: 'ai' | 'mock';
  sqlExecuted?: string;
  rowCount?: number;
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

    const sessionId = body.sessionId || generateSessionId();

    // Route through the Gemini + DB agent
    let agentResult: AgentResponse;
    try {
      agentResult = await chat(sessionId, message);
    } catch (err) {
      console.error('LLM agent error:', err);
      // Fallback to a helpful error message
      return NextResponse.json({
        response:
          "I'm having trouble connecting to my AI backend right now. Please try again in a moment.",
        sessionId,
        timestamp: new Date().toISOString(),
        source: 'mock' as const,
      });
    }

    return NextResponse.json({
      response: agentResult.response,
      sessionId,
      timestamp: new Date().toISOString(),
      source: 'ai' as const,
      sqlExecuted: agentResult.sqlExecuted,
      rowCount: agentResult.rowCount,
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// Health check
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    engine: 'gemini-2.0-flash',
    database: 'buildai_demo',
  });
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

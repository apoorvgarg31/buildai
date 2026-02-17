/**
 * POST /api/chat
 * 
 * Proxies chat messages to the OpenClaw gateway webchat.
 * Currently returns mock responses — engine integration comes
 * when the gateway is actually running.
 * 
 * Request body:
 *   { message: string, sessionId?: string }
 * 
 * Response:
 *   { response: string, sessionId: string, timestamp: string }
 */

import { NextRequest, NextResponse } from 'next/server';

// Engine gateway WebSocket URL (configurable via env)
const ENGINE_WS_URL = process.env.ENGINE_WS_URL || 'ws://localhost:18789';
const ENGINE_CONNECTED = process.env.ENGINE_CONNECTED === 'true';

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  timestamp: string;
  source: 'engine' | 'mock';
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse | { error: string }>> {
  try {
    const body = await request.json() as ChatRequest;

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "message" field' },
        { status: 400 }
      );
    }

    const message = body.message.trim();
    if (message.length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    if (message.length > 10000) {
      return NextResponse.json(
        { error: 'Message too long (max 10000 characters)' },
        { status: 400 }
      );
    }

    const sessionId = body.sessionId || generateSessionId();

    // TODO: When ENGINE_CONNECTED=true, proxy to actual gateway via WebSocket
    // For now, return a mock response
    if (ENGINE_CONNECTED) {
      try {
        const engineResponse = await proxyToEngine(message, sessionId);
        return NextResponse.json(engineResponse);
      } catch (err) {
        // Fall back to mock if engine is unreachable
        console.error('Engine proxy failed, falling back to mock:', err);
      }
    }

    // Mock response for development
    const response = generateMockResponse(message);
    
    return NextResponse.json({
      response,
      sessionId,
      timestamp: new Date().toISOString(),
      source: 'mock' as const,
    });

  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    engine: ENGINE_CONNECTED ? 'connected' : 'mock',
    engineUrl: ENGINE_WS_URL,
  });
}

/**
 * Proxy message to the OpenClaw gateway via HTTP.
 * Uses the gateway's webchat HTTP endpoint for simplicity.
 * WebSocket streaming will be added later.
 */
async function proxyToEngine(message: string, sessionId: string): Promise<ChatResponse> {
  // The gateway exposes an HTTP endpoint for webchat messages
  const httpUrl = ENGINE_WS_URL.replace('ws://', 'http://').replace('wss://', 'https://');
  
  const res = await fetch(`${httpUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Engine responded with ${res.status}`);
  }

  const data = await res.json();
  return {
    response: data.response || data.content || 'No response from engine',
    sessionId,
    timestamp: new Date().toISOString(),
    source: 'engine',
  };
}

/**
 * Generate a contextual mock response for development/demo.
 */
function generateMockResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('rfi')) {
    return `📋 **RFI Query**\n\nI'd normally query Procore for your RFI data. Here's what I'll do once connected:\n\n• Search open RFIs across your active projects\n• Filter by status, assignee, or age\n• Flag any overdue items (>7 days)\n\n⚠️ Engine not connected yet — this is a preview response.`;
  }

  if (lower.includes('budget') || lower.includes('cost')) {
    return `💰 **Budget Analysis**\n\nOnce connected to your PMIS, I can:\n\n• Show real-time cost code breakdowns\n• Flag overruns (>5% threshold)\n• Compare committed vs actual costs\n• Track change order impact\n\n⚠️ Engine not connected yet — this is a preview response.`;
  }

  if (lower.includes('schedule') || lower.includes('milestone') || lower.includes('delay')) {
    return `📅 **Schedule Check**\n\nWith P6/Procore access, I'll:\n\n• Show critical path activities\n• Flag upcoming milestones (14-day window)\n• Detect float erosion\n• Track delay impacts\n\n⚠️ Engine not connected yet — this is a preview response.`;
  }

  if (lower.includes('submittal')) {
    return `📑 **Submittal Tracking**\n\nOnce connected, I can:\n\n• List open/late submittals\n• Track review status\n• Flag items past their required date\n• Create new submittal entries\n\n⚠️ Engine not connected yet — this is a preview response.`;
  }

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return `Hey! 👋 I'm your BuildAI assistant — ready to help with your construction projects.\n\nTry asking about:\n• Open RFIs\n• Budget status\n• Schedule milestones\n• Submittal tracking\n\n⚠️ Running in preview mode — engine integration coming soon.`;
  }

  return `I received: "${message}"\n\nI'm your construction PM assistant. Once the engine is connected, I'll be able to:\n\n• Query Procore, Unifier, P6\n• Search project documents\n• Run database queries\n• Generate reports\n\n⚠️ Engine not connected yet — this is a preview response.`;
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

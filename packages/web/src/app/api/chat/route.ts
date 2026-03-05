/**
 * POST /api/chat
 *
 * Thin proxy to the BuildAI engine gateway.
 * Supports two modes:
 *   - stream=true (default): Returns SSE stream with delta events
 *   - stream=false: Returns full JSON response (legacy)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGatewayClient } from '@/lib/gateway-client';
import fs from 'fs';
import path from 'path';

export interface ChatRequest {
  message: string;
  sessionId?: string;
  stream?: boolean;
}

function resolveSessionKey(sessionId?: string): string {
  const id = sessionId || `buildai-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  return id.startsWith('webchat:') || id.startsWith('agent:') ? id : `webchat:${id}`;
}

function parseAgentIdFromSessionKey(sessionKey: string): string | null {
  const m = /^agent:([^:]+):/.exec(sessionKey);
  return m?.[1] || null;
}

function listRecentArtifacts(agentId: string, startMs: number): Array<{ name: string; size: number; createdAt: string }> {
  try {
    const artifactsDir = path.resolve(process.cwd(), `../../workspaces/${agentId}/artifacts`);
    if (!fs.existsSync(artifactsDir)) return [];
    return fs
      .readdirSync(artifactsDir)
      .map((name) => {
        const fp = path.join(artifactsDir, name);
        const st = fs.statSync(fp);
        if (!st.isFile()) return null;
        return { name, size: st.size, createdAt: st.mtime.toISOString(), mtime: st.mtimeMs };
      })
      .filter(Boolean)
      .filter((x) => (x as { mtime: number }).mtime >= startMs - 1000)
      .map((x) => ({
        name: (x as { name: string }).name,
        size: (x as { size: number }).size,
        createdAt: (x as { createdAt: string }).createdAt,
      }));
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest): Promise<Response> {
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
    const useStream = body.stream !== false; // default to streaming

    if (useStream) {
      // SSE streaming response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const startedAtMs = Date.now();
            const client = getGatewayClient();
            const result = await client.chatSendStream(
              sessionKey,
              message,
              (delta) => {
                // Send delta as SSE event (gateway sends cumulative text)
                const data = JSON.stringify({ type: 'delta', text: delta });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              },
              (sideEvent) => {
                if (sideEvent.type === 'thinking') {
                  const data = JSON.stringify({ type: 'thinking', text: sideEvent.text });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
                if (sideEvent.type === 'tool') {
                  const data = JSON.stringify({ type: 'tool', name: sideEvent.name });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              },
            );
            // Always send the final full text as the last delta
            // (gateway throttles deltas to 150ms, so the last delta may be truncated)
            if (result.response) {
              const finalDelta = JSON.stringify({ type: 'delta', text: result.response });
              controller.enqueue(encoder.encode(`data: ${finalDelta}\n\n`));
            }
            // Emit generated artifacts for this turn (if any)
            const agentId = parseAgentIdFromSessionKey(sessionKey);
            if (agentId) {
              const artifacts = listRecentArtifacts(agentId, startedAtMs);
              if (artifacts.length > 0) {
                const artifactEvt = JSON.stringify({ type: 'artifacts', artifacts });
                controller.enqueue(encoder.encode(`data: ${artifactEvt}\n\n`));
              }
            }

            // Send done event
            const done = JSON.stringify({ type: 'done', sessionId: rawSessionId });
            controller.enqueue(encoder.encode(`data: ${done}\n\n`));
            controller.close();
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            const errData = JSON.stringify({ type: 'error', message: errMsg });
            controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming: wait for full response
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

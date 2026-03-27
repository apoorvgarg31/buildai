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
import { assertCanAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { apiError } from '@/lib/api-error';
import { writeAuditEvent } from '@/lib/admin-db';
import fs from 'fs';
import path from 'path';

export interface ChatRequest {
  message: string;
  sessionId?: string;
  stream?: boolean;
}

function randomSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function parseAgentIdFromSessionKey(sessionKey: string): string | null {
  const m = /^agent:([^:]+):/.exec(sessionKey);
  return m?.[1] || null;
}

function resolveAgentScopedWebchatSession(sessionKey: string, userId: string): string {
  const parts = sessionKey.split(':');
  if (parts.length < 3 || parts[0] !== 'agent') return sessionKey;
  if (parts[2] !== 'webchat') return sessionKey;

  const agentId = parts[1];
  const tail = parts.slice(3);
  if (tail.length >= 2) {
    return tail[0] === userId
      ? sessionKey
      : `agent:${agentId}:webchat:${userId}:${tail.slice(1).join(':') || 'default'}`;
  }

  return `agent:${agentId}:webchat:${userId}:${tail.join(':') || 'default'}`;
}

function resolveSessionKey(rawSessionId: string | undefined, userId: string): string {
  const id = (rawSessionId || '').trim();
  if (!id) return `webchat:${userId}:${randomSuffix()}`;

  // Keep explicit engine session keys if provided, but normalize generic webchat ids
  if (id.startsWith('agent:')) return resolveAgentScopedWebchatSession(id, userId);
  if (id.startsWith('webchat:')) {
    const parts = id.split(':');
    // Force webchat sessions into per-user namespace to block cross-user/session abuse
    if (parts.length >= 3) {
      return parts[1] === userId ? id : `webchat:${userId}:${parts.slice(2).join(':')}`;
    }
    return `webchat:${userId}:${parts.slice(1).join(':') || randomSuffix()}`;
  }

  return `webchat:${userId}:${id}`;
}

function canUseSessionKey(sessionKey: string, actor: Awaited<ReturnType<typeof requireSignedIn>>): boolean {
  const agentId = parseAgentIdFromSessionKey(sessionKey);
  if (agentId) {
    if (sessionKey.startsWith(`agent:${agentId}:webchat:`)) {
      const parts = sessionKey.split(':');
      if (parts.length >= 5 && parts[3] !== actor.userId) {
        return false;
      }
    }

    try {
      assertCanAccessAgent(actor, agentId);
      return true;
    } catch {
      return false;
    }
  }

  // webchat sessions are strictly namespaced per user
  return sessionKey.startsWith(`webchat:${actor.userId}:`);
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
  let actor: Awaited<ReturnType<typeof requireSignedIn>> | null = null;
  try {
    actor = await requireSignedIn();
    const body = (await request.json()) as ChatRequest;

    if (!body.message || typeof body.message !== 'string') {
      return apiError('validation_error', 'Missing or invalid "message" field', 400);
    }

    const message = body.message.trim();
    if (message.length === 0) {
      return apiError('validation_error', 'Message cannot be empty', 400);
    }
    if (message.length > 10000) {
      return apiError('validation_error', 'Message too long (max 10000 characters)', 400);
    }

    const sessionKey = resolveSessionKey(body.sessionId, actor.userId);
    if (!canUseSessionKey(sessionKey, actor)) {
      writeAuditEvent({
        actorUserId: actor.userId,
        action: 'chat.send.denied',
        entityType: 'chat_session',
        entityId: sessionKey,
        metadata: { reason: 'SESSION_OWNERSHIP_VIOLATION' },
      });
      return apiError('forbidden_session', 'Forbidden', 403, { reason: 'SESSION_OWNERSHIP_VIOLATION' });
    }

    const useStream = body.stream !== false; // default to streaming

    if (useStream) {
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

            if (result.response) {
              const finalDelta = JSON.stringify({ type: 'delta', text: result.response });
              controller.enqueue(encoder.encode(`data: ${finalDelta}\n\n`));
            }

            const agentId = parseAgentIdFromSessionKey(sessionKey);
            if (agentId) {
              const artifacts = listRecentArtifacts(agentId, startedAtMs);
              if (artifacts.length > 0) {
                const artifactEvt = JSON.stringify({ type: 'artifacts', artifacts });
                controller.enqueue(encoder.encode(`data: ${artifactEvt}\n\n`));
              }
            }

            const done = JSON.stringify({ type: 'done', sessionId: sessionKey });
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
          Connection: 'keep-alive',
        },
      });
    }

    const client = getGatewayClient();
    const result = await client.chatSend(sessionKey, message);

    return NextResponse.json({
      response: result.response,
      sessionId: sessionKey,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return apiError('unauthenticated', 'Not authenticated', 401);
    }

    console.error('Chat API error:', err);
    return apiError('chat_gateway_error', 'Failed to reach AI engine. Please try again.', 502, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    await requireSignedIn();
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return apiError('unauthenticated', 'Not authenticated', 401);
    }
    return apiError('internal_error', 'Failed to validate user', 500);
  }

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

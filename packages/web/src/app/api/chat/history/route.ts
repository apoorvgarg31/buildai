/**
 * GET /api/chat/history?sessionId=xxx
 *
 * Fetch chat history from the engine gateway.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGatewayClient } from '@/lib/gateway-client';
import { assertCanAccessAgent, requireSignedIn } from '@/lib/api-guard';
import { apiError } from '@/lib/api-error';
import { writeAuditEvent } from '@/lib/admin-db';

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

function resolveSessionKey(sessionId: string, userId: string): string {
  const raw = (sessionId || '').trim();
  if (!raw) return '';
  if (raw.startsWith('agent:')) return resolveAgentScopedWebchatSession(raw, userId);
  if (raw.startsWith('webchat:')) {
    const parts = raw.split(':');
    if (parts.length >= 3) {
      return parts[1] === userId ? raw : `webchat:${userId}:${parts.slice(2).join(':')}`;
    }
    return `webchat:${userId}:${parts.slice(1).join(':')}`;
  }
  return `webchat:${userId}:${raw}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireSignedIn();
    const sessionId = request.nextUrl.searchParams.get('sessionId') || '';

    if (!sessionId) {
      return apiError('validation_error', 'Missing sessionId', 400);
    }

    const sessionKey = resolveSessionKey(sessionId, actor.userId);
    const agentId = parseAgentIdFromSessionKey(sessionKey);

    if (agentId) {
      try {
        assertCanAccessAgent(actor, agentId);
      } catch {
        writeAuditEvent({
          actorUserId: actor.userId,
          action: 'chat.history.denied',
          entityType: 'chat_session',
          entityId: sessionKey,
          metadata: { reason: 'SESSION_OWNERSHIP_VIOLATION' },
        });
        return apiError('forbidden_session', 'Forbidden', 403, { reason: 'SESSION_OWNERSHIP_VIOLATION' });
      }
    } else if (!sessionKey.startsWith(`webchat:${actor.userId}:`)) {
      writeAuditEvent({
        actorUserId: actor.userId,
        action: 'chat.history.denied',
        entityType: 'chat_session',
        entityId: sessionKey,
        metadata: { reason: 'SESSION_OWNERSHIP_VIOLATION' },
      });
      return apiError('forbidden_session', 'Forbidden', 403, { reason: 'SESSION_OWNERSHIP_VIOLATION' });
    }

    const client = getGatewayClient();
    await client.connect();
    const result = await client.chatHistory(sessionKey, 100);

    const data = result as {
      sessionKey?: string;
      sessionId?: string;
      messages?: Array<{
        role?: string;
        content?: unknown;
        timestamp?: number;
      }>;
    };

    const rawMessages = data?.messages || (Array.isArray(result) ? result : []);

    const messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }> = [];

    for (const msg of rawMessages) {
      const role = msg.role;
      if (role !== 'user' && role !== 'assistant') continue;

      const content = msg.content;
      let text = '';

      if (typeof content === 'string') {
        text = content;
      } else if (Array.isArray(content)) {
        text = content
          .map((block: unknown) => {
            if (typeof block === 'string') return block;
            if ((block as { type?: string; text?: string })?.type === 'text') {
              return (block as { text: string }).text;
            }
            return '';
          })
          .join('');
      }

      text = text.replace(/\n?\[message_id:.*?\]/g, '').trim();

      if (text) {
        messages.push({
          id: crypto.randomUUID(),
          role: role as 'user' | 'assistant',
          content: text,
          timestamp: msg.timestamp
            ? new Date(msg.timestamp).toISOString()
            : new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ messages, sessionKey });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return apiError('unauthenticated', 'Not authenticated', 401);
    }
    console.error('Chat history error:', err);
    return apiError('chat_history_error', 'Failed to load chat history', 502, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

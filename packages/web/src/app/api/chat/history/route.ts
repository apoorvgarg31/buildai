/**
 * GET /api/chat/history?sessionId=xxx
 *
 * Fetch chat history from the engine gateway.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGatewayClient } from '@/lib/gateway-client';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const sessionKey = sessionId.startsWith('webchat:') || sessionId.startsWith('agent:')
    ? sessionId
    : `webchat:${sessionId}`;

  try {
    const client = getGatewayClient();
    await client.connect();
    const result = await client.chatHistory(sessionKey, 100);

    // The gateway returns messages in the session log format
    // Extract user and assistant messages
    const history = result as Array<{
      type?: string;
      message?: {
        role?: string;
        content?: unknown;
        timestamp?: number;
      };
      timestamp?: string;
    }>;

    const messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }> = [];

    if (Array.isArray(history)) {
      for (const entry of history) {
        const msg = entry.message || entry;
        const role = (msg as { role?: string }).role;
        if (role !== 'user' && role !== 'assistant') continue;

        const content = (msg as { content?: unknown }).content;
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

        // Strip [message_id: ...] tags from user messages
        text = text.replace(/\n?\[message_id:.*?\]/g, '').trim();

        if (text) {
          messages.push({
            id: (entry as { id?: string }).id || crypto.randomUUID(),
            role: role as 'user' | 'assistant',
            content: text,
            timestamp: (entry.timestamp || new Date().toISOString()) as string,
          });
        }
      }
    }

    return NextResponse.json({ messages, sessionKey });
  } catch (err) {
    console.error('Chat history error:', err);
    return NextResponse.json({ messages: [], sessionKey }, { status: 200 });
  }
}

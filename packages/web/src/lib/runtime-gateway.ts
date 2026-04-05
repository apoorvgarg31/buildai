import { callGateway } from '../../../engine/dist/gateway/call.js';
import { getGatewayClient } from '@/lib/gateway-client';

type GatewayParams = Record<string, unknown> | undefined;
export type ChatStreamSideEvent =
  | { type: 'thinking'; text: string }
  | { type: 'tool'; name: string };

function ensureBuildaiGatewayEnv(): void {
  process.env.CLAWDBOT_PROFILE ??= 'buildai';
  process.env.BUILDAI_GATEWAY_URL ??= 'ws://localhost:18790';
  process.env.BUILDAI_GATEWAY_TOKEN ??= 'buildai-dev-token-2026';
}

export async function requestRuntimeGateway(method: string, params?: GatewayParams): Promise<unknown> {
  ensureBuildaiGatewayEnv();

  return callGateway({
    method,
    params,
    url: process.env.BUILDAI_GATEWAY_URL,
    token: process.env.BUILDAI_GATEWAY_TOKEN,
  });
}

export async function requestChatHistory(sessionKey: string, limit = 50): Promise<unknown> {
  const client = getGatewayClient();
  await client.connect();
  return client.chatHistory(sessionKey, limit);
}

export async function sendChatMessage(sessionKey: string, message: string): Promise<{ response: string; sessionKey: string }> {
  const client = getGatewayClient();
  await client.connect();
  const result = await client.chatSend(sessionKey, message);
  return { response: result.response, sessionKey: result.sessionKey };
}

export async function sendChatMessageStream(
  sessionKey: string,
  message: string,
  onDelta: (text: string) => void,
  onSideEvent?: (event: ChatStreamSideEvent) => void,
): Promise<{ response: string; sessionKey: string }> {
  const client = getGatewayClient();
  await client.connect();
  return client.chatSendStream(sessionKey, message, onDelta, onSideEvent);
}

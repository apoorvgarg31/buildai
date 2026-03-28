import { callGateway } from '../../../engine/dist/gateway/call.js';

type GatewayParams = Record<string, unknown> | undefined;

export async function requestRuntimeGateway(method: string, params?: GatewayParams): Promise<unknown> {
  process.env.CLAWDBOT_PROFILE ??= 'buildai';

  return callGateway({
    method,
    params,
    url: process.env.BUILDAI_GATEWAY_URL,
    token: process.env.BUILDAI_GATEWAY_TOKEN,
  });
}

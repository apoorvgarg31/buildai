/**
 * Device identity for OpenClaw gateway WebSocket authentication.
 * Generates an Ed25519 key pair once, stores it to disk, and signs
 * the challenge nonce on each connect.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const IDENTITY_PATH = path.resolve(process.cwd(), '../../data/device-identity.json');

interface DeviceIdentity {
  version: 1;
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64url');
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const key = crypto.createPublicKey(publicKeyPem);
  const spki = key.export({ type: 'spki', format: 'der' });
  // Ed25519 SPKI is 44 bytes: 12-byte prefix + 32-byte raw key
  return spki.subarray(12);
}

function fingerprintPublicKey(publicKeyPem: string): string {
  const raw = derivePublicKeyRaw(publicKeyPem);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateIdentity(): DeviceIdentity {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return {
    version: 1,
    deviceId: fingerprintPublicKey(publicKeyPem),
    publicKeyPem,
    privateKeyPem,
  };
}

export function loadOrCreateDeviceIdentity(): DeviceIdentity {
  try {
    if (fs.existsSync(IDENTITY_PATH)) {
      const raw = fs.readFileSync(IDENTITY_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1 && parsed.deviceId && parsed.publicKeyPem && parsed.privateKeyPem) {
        return parsed as DeviceIdentity;
      }
    }
  } catch {
    // Fall through to generate
  }

  const identity = generateIdentity();
  const dir = path.dirname(IDENTITY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(IDENTITY_PATH, JSON.stringify(identity, null, 2), { mode: 0o600 });
  return identity;
}

export function buildDeviceAuthPayloadV3(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string | null;
  nonce: string;
  platform: string;
  deviceFamily?: string;
}): string {
  const scopes = params.scopes.join(',');
  const token = params.token ?? '';
  const platform = params.platform || '';
  const deviceFamily = params.deviceFamily || '';
  return [
    'v3',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
    platform,
    deviceFamily,
  ].join('|');
}

export function signPayload(privateKeyPem: string, payload: string): string {
  const key = crypto.createPrivateKey(privateKeyPem);
  return base64UrlEncode(crypto.sign(null, Buffer.from(payload, 'utf8'), key));
}

export function publicKeyRawBase64Url(publicKeyPem: string): string {
  return base64UrlEncode(derivePublicKeyRaw(publicKeyPem));
}

/**
 * Build the full device params for the connect handshake.
 */
export function buildDeviceConnectParams(nonce: string, token: string | null) {
  const identity = loadOrCreateDeviceIdentity();
  const signedAtMs = Date.now();
  const role = 'operator';
  const scopes = ['operator.admin'];
  const clientId = 'webchat';
  const clientMode = 'webchat';
  const platform = 'web';

  const payload = buildDeviceAuthPayloadV3({
    deviceId: identity.deviceId,
    clientId,
    clientMode,
    role,
    scopes,
    signedAtMs,
    token,
    nonce,
    platform,
  });

  const signature = signPayload(identity.privateKeyPem, payload);

  return {
    device: {
      id: identity.deviceId,
      publicKey: publicKeyRawBase64Url(identity.publicKeyPem),
      signature,
      signedAt: signedAtMs,
      nonce,
    },
    role,
    scopes,
    clientId,
    clientMode,
    platform,
  };
}

/**
 * Procore API integration utility.
 * Handles token storage, refresh, and API calls to the Procore sandbox.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// ── Config ──────────────────────────────────────────────────────
const PROCORE_CLIENT_ID = process.env.PROCORE_CLIENT_ID!;
const PROCORE_CLIENT_SECRET = process.env.PROCORE_CLIENT_SECRET!;
const PROCORE_REDIRECT_URI =
  process.env.PROCORE_REDIRECT_URI || 'http://localhost:3000/api/procore/callback';
const PROCORE_COMPANY_ID = process.env.PROCORE_COMPANY_ID || '';

const SANDBOX_BASE = 'https://sandbox.procore.com';
const TOKEN_FILE = join(process.cwd(), '.procore-tokens.json');

// ── Types ───────────────────────────────────────────────────────
export interface ProcoreTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  created_at: number; // unix epoch seconds
}

// ── Token persistence ───────────────────────────────────────────
export function saveTokens(tokens: ProcoreTokens): void {
  writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
}

export function loadTokens(): ProcoreTokens | null {
  if (!existsSync(TOKEN_FILE)) return null;
  try {
    const raw = readFileSync(TOKEN_FILE, 'utf-8');
    return JSON.parse(raw) as ProcoreTokens;
  } catch {
    return null;
  }
}

export function isTokenExpired(tokens: ProcoreTokens): boolean {
  const expiresAt = (tokens.created_at + tokens.expires_in) * 1000; // ms
  return Date.now() >= expiresAt - 60_000; // 1-minute buffer
}

export function hasTokens(): boolean {
  return existsSync(TOKEN_FILE);
}

// ── OAuth helpers ───────────────────────────────────────────────
export function getAuthorizationUrl(): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: PROCORE_CLIENT_ID,
    redirect_uri: PROCORE_REDIRECT_URI,
  });
  return `${SANDBOX_BASE}/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<ProcoreTokens> {
  const res = await fetch(`${SANDBOX_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: PROCORE_CLIENT_ID,
      client_secret: PROCORE_CLIENT_SECRET,
      code,
      redirect_uri: PROCORE_REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }

  return (await res.json()) as ProcoreTokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<ProcoreTokens> {
  const res = await fetch(`${SANDBOX_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: PROCORE_CLIENT_ID,
      client_secret: PROCORE_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  return (await res.json()) as ProcoreTokens;
}

// ── Get a valid access token (auto-refresh) ─────────────────────
export async function getValidToken(): Promise<string> {
  let tokens = loadTokens();
  if (!tokens) {
    throw new Error('Not connected to Procore. Please authenticate first.');
  }

  if (isTokenExpired(tokens)) {
    tokens = await refreshAccessToken(tokens.refresh_token);
    saveTokens(tokens);
  }

  return tokens.access_token;
}

// ── Generic API call ────────────────────────────────────────────
export async function procoreApi<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, string> } = {},
): Promise<T> {
  const accessToken = await getValidToken();
  const url = new URL(`${SANDBOX_BASE}${path}`);

  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  if (PROCORE_COMPANY_ID) {
    headers['Procore-Company-Id'] = PROCORE_COMPANY_ID;
  }

  const res = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Procore API ${res.status}: ${body}`);
  }

  return (await res.json()) as T;
}

// ── Endpoint map for the generic data proxy ─────────────────────
export const ENDPOINT_MAP: Record<string, { path: string; needsProject: boolean }> = {
  projects:       { path: '/rest/v1.1/projects',                                   needsProject: false },
  rfis:           { path: '/rest/v1.1/projects/{project_id}/rfis',                 needsProject: true },
  submittals:     { path: '/rest/v1.1/projects/{project_id}/submittals',           needsProject: true },
  budget:         { path: '/rest/v1.1/projects/{project_id}/budget/line_items',    needsProject: true },
  daily_logs:     { path: '/rest/v1.1/projects/{project_id}/daily_logs',           needsProject: true },
  change_orders:  { path: '/rest/v1.1/projects/{project_id}/change_order_packages', needsProject: true },
  punch_items:    { path: '/rest/v1.1/projects/{project_id}/punch_items',          needsProject: true },
  vendors:        { path: '/rest/v1.1/projects/{project_id}/vendors',              needsProject: true },
  schedule:       { path: '/rest/v1.1/projects/{project_id}/schedule/tasks',       needsProject: true },
  documents:      { path: '/rest/v1.1/projects/{project_id}/documents',            needsProject: true },
};

export function resolveEndpointPath(endpoint: string, projectId?: number): string {
  const mapping = ENDPOINT_MAP[endpoint];
  if (!mapping) {
    throw new Error(
      `Unknown endpoint "${endpoint}". Available: ${Object.keys(ENDPOINT_MAP).join(', ')}`,
    );
  }
  if (mapping.needsProject && !projectId) {
    throw new Error(`Endpoint "${endpoint}" requires a projectId.`);
  }
  return mapping.path.replace('{project_id}', String(projectId ?? ''));
}

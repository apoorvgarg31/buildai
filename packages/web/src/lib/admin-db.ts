/**
 * Admin database — SQLite for users, connections, agents, and assignments.
 * This is the source of truth for admin CRUD operations.
 */

import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { ADMIN_TOOL_CATALOG, getAdminToolCatalogEntry, type AdminToolCatalogEntry, type AdminToolRisk } from './tool-catalog';
import type { McpServerKind, McpTransport } from './mcp-server-catalog';

const DB_PATH = path.resolve(process.cwd(), '../../data/buildai-admin.db');

let _db: Database.Database | null = null;

function ensureColumn(db: Database.Database, table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function getDb(): Database.Database {
  if (!_db) {
    // Ensure data dir exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      agent_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      auth_mode TEXT NOT NULL DEFAULT 'shared',
      config TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS connection_secrets (
      connection_id TEXT PRIMARY KEY REFERENCES connections(id) ON DELETE CASCADE,
      encrypted_data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      user_id TEXT,
      model TEXT DEFAULT 'google/gemini-2.0-flash',
      api_key TEXT,
      workspace_dir TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_connections (
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
      PRIMARY KEY (agent_id, connection_id)
    );

    CREATE TABLE IF NOT EXISTS user_tokens (
      user_id TEXT NOT NULL,
      connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT DEFAULT 'Bearer',
      expires_at INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, connection_id)
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS api_idempotency (
      idempotency_key TEXT NOT NULL,
      route TEXT NOT NULL,
      method TEXT NOT NULL,
      response_json TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (idempotency_key, route, method)
    );

    CREATE TABLE IF NOT EXISTS user_skill_installs (
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'public',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS tool_settings (
      tool_name TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_setting_secrets (
      key TEXT PRIMARY KEY,
      encrypted_data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      server_kind TEXT NOT NULL DEFAULT 'standalone',
      connection_id TEXT UNIQUE REFERENCES connections(id) ON DELETE SET NULL,
      transport TEXT NOT NULL DEFAULT 'stdio',
      command TEXT,
      args_json TEXT NOT NULL DEFAULT '[]',
      env_json TEXT NOT NULL DEFAULT '{}',
      url TEXT,
      status TEXT NOT NULL DEFAULT 'configured',
      enabled INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  ensureColumn(db, 'connections', 'auth_mode', "auth_mode TEXT NOT NULL DEFAULT 'shared'");
}

// ── ID generation ──

function genId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

// ── Encryption ──

const ALGO = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const key = process.env.BUILDAI_ENCRYPTION_KEY;
  if (!key) throw new Error('BUILDAI_ENCRYPTION_KEY env var is required');
  // Derive a 32-byte key from whatever string the user provides
  return crypto.createHash('sha256').update(key).digest();
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(stored: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, dataHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}

// ── Users ──

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export function listUsers(): User[] {
  return getDb().prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
}

export function getUser(id: string): User | undefined {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function createUser(data: { email: string; name: string; role?: string }): User {
  const id = genId('user');
  const role = data.role || 'user';
  getDb().prepare(
    'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)'
  ).run(id, data.email, data.name, role);
  return getUser(id)!;
}

export function updateUser(id: string, data: Partial<{ email: string; name: string; role: string; agent_id: string | null }>): User | undefined {
  const user = getUser(id);
  if (!user) return undefined;
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); }
  }
  if (fields.length === 0) return user;
  fields.push("updated_at = datetime('now')");
  values.push(id);
  getDb().prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getUser(id);
}

export function deleteUser(id: string): boolean {
  const result = getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Connections ──

export interface Connection {
  id: string;
  name: string;
  type: string;
  auth_mode: 'shared' | 'oauth_user' | 'token_user';
  config: string; // JSON string
  status: string;
  has_secret: boolean;
  created_at: string;
  updated_at: string;
}

const SENSITIVE_CONNECTION_KEY = /(secret|token|password|api[_-]?key|client_secret|access[_-]?key|private[_-]?key)/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeConnectionConfig(configJson: string): string {
  try {
    const parsed = JSON.parse(configJson);
    if (!isPlainObject(parsed)) return configJson;
    const sanitized = Object.fromEntries(
      Object.entries(parsed).filter(([key]) => !SENSITIVE_CONNECTION_KEY.test(key))
    );
    return JSON.stringify(sanitized);
  } catch {
    return configJson;
  }
}

function normalizeConnectionInput(
  config: Record<string, unknown> | undefined,
  secrets: Record<string, string> | undefined
): { config: Record<string, unknown>; secrets: Record<string, string> | undefined } {
  const nextConfig: Record<string, unknown> = {};
  const nextSecrets: Record<string, string> = { ...(secrets || {}) };

  for (const [key, value] of Object.entries(config || {})) {
    if (SENSITIVE_CONNECTION_KEY.test(key) && typeof value === 'string' && value.length > 0) {
      if (!nextSecrets[key]) nextSecrets[key] = value;
      continue;
    }
    nextConfig[key] = value;
  }

  return {
    config: nextConfig,
    secrets: Object.keys(nextSecrets).length > 0 ? nextSecrets : undefined,
  };
}

function hydrateConnection(row: Record<string, unknown>): Connection {
  return {
    ...row,
    auth_mode: row.auth_mode === 'oauth_user' || row.auth_mode === 'token_user' ? row.auth_mode : 'shared',
    config: sanitizeConnectionConfig(String(row.config || '{}')),
    has_secret: !!row.has_secret,
  } as unknown as Connection;
}

export function listConnections(): Connection[] {
  const db = getDb();
  const query = `
    SELECT c.*, (cs.connection_id IS NOT NULL) as has_secret
    FROM connections c
    LEFT JOIN connection_secrets cs ON cs.connection_id = c.id
    ORDER BY c.created_at DESC
  `;

  const rows = db.prepare(query).all() as Record<string, unknown>[];
  return rows.map(hydrateConnection);
}

export function getConnection(id: string): Connection | undefined {
  const row = getDb().prepare(`
    SELECT c.*, (cs.connection_id IS NOT NULL) as has_secret
    FROM connections c
    LEFT JOIN connection_secrets cs ON cs.connection_id = c.id
    WHERE c.id = ?
  `).get(id) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return hydrateConnection(row);
}

export function createConnection(data: {
  name: string;
  type: string;
  authMode?: 'shared' | 'oauth_user' | 'token_user';
  config: Record<string, unknown>;
  secrets?: Record<string, string>;
}): Connection {
  const id = genId('conn');
  const normalized = normalizeConnectionInput(data.config, data.secrets);
  const configJson = JSON.stringify(normalized.config);

  const db = getDb();
  const txn = db.transaction(() => {
    db.prepare(
      'INSERT INTO connections (id, name, type, auth_mode, config) VALUES (?, ?, ?, ?, ?)'
    ).run(id, data.name, data.type, data.authMode || 'shared', configJson);

    if (normalized.secrets && Object.keys(normalized.secrets).length > 0) {
      const encrypted = encrypt(JSON.stringify(normalized.secrets));
      db.prepare(
        'INSERT INTO connection_secrets (connection_id, encrypted_data) VALUES (?, ?)'
      ).run(id, encrypted);
    }
  });
  txn();
  return getConnection(id)!;
}

export function updateConnection(id: string, data: Partial<{
  name: string;
  type: string;
  authMode: 'shared' | 'oauth_user' | 'token_user';
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  status: string;
}>): Connection | undefined {
  const conn = getConnection(id);
  if (!conn) return undefined;

  const db = getDb();
  const txn = db.transaction(() => {
    const normalized = (data.config !== undefined || data.secrets !== undefined)
      ? normalizeConnectionInput(
        data.config,
        data.secrets !== undefined ? data.secrets : (getConnectionSecrets(id) || undefined)
      )
      : null;
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
    if (data.authMode !== undefined) { fields.push('auth_mode = ?'); values.push(data.authMode); }
    if (normalized && data.config !== undefined) { fields.push('config = ?'); values.push(JSON.stringify(normalized.config)); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE connections SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    if (normalized && (data.secrets !== undefined || data.config !== undefined)) {
      db.prepare('DELETE FROM connection_secrets WHERE connection_id = ?').run(id);
      if (normalized.secrets && Object.keys(normalized.secrets).length > 0) {
        const encrypted = encrypt(JSON.stringify(normalized.secrets));
        db.prepare('INSERT INTO connection_secrets (connection_id, encrypted_data) VALUES (?, ?)').run(id, encrypted);
      }
    }
  });
  txn();
  return getConnection(id);
}

export function deleteConnection(id: string): boolean {
  const result = getDb().prepare('DELETE FROM connections WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getConnectionSecrets(id: string): Record<string, string> | null {
  const row = getDb().prepare(
    'SELECT encrypted_data FROM connection_secrets WHERE connection_id = ?'
  ).get(id) as { encrypted_data: string } | undefined;
  if (!row) return null;
  return JSON.parse(decrypt(row.encrypted_data));
}

// ── Agents ──

export interface Agent {
  id: string;
  name: string;
  user_id: string | null;
  model: string;
  api_key: string | null;
  workspace_dir: string;
  status: string;
  connection_ids: string[];
  created_at: string;
  updated_at: string;
}

export function listAgents(): Agent[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all() as Omit<Agent, 'connection_ids'>[];
  return rows.map(r => {
    const conns = db.prepare(
      'SELECT connection_id FROM agent_connections WHERE agent_id = ?'
    ).all(r.id) as { connection_id: string }[];
    return { ...r, connection_ids: conns.map(c => c.connection_id) };
  });
}

export function getAgent(id: string): Agent | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Omit<Agent, 'connection_ids'> | undefined;
  if (!row) return undefined;
  const conns = db.prepare(
    'SELECT connection_id FROM agent_connections WHERE agent_id = ?'
  ).all(id) as { connection_id: string }[];
  return { ...row, connection_ids: conns.map(c => c.connection_id) };
}

export function createAgent(data: {
  id?: string;
  name: string;
  userId?: string;
  model?: string;
  apiKey?: string;
  workspaceDir: string;
  connectionIds?: string[];
}): Agent {
  const id = (data.id || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || genId('agent'));

  const model = data.model || 'google/gemini-2.0-flash';

  const db = getDb();
  const txn = db.transaction(() => {
    db.prepare(
      'INSERT INTO agents (id, name, user_id, model, api_key, workspace_dir) VALUES (?, ?, ?, ?, ?, ?)' 
    ).run(id, data.name, data.userId || null, model, data.apiKey || null, data.workspaceDir);

    if (data.connectionIds?.length) {
      const stmt = db.prepare('INSERT INTO agent_connections (agent_id, connection_id) VALUES (?, ?)');
      for (const connId of data.connectionIds) {
        stmt.run(id, connId);
      }
    }
  });
  txn();
  return getAgent(id)!;
}

export function updateAgent(id: string, data: Partial<{
  name: string;
  userId: string | null;
  model: string;
  apiKey: string | null;
  status: string;
  connectionIds: string[];
}>): Agent | undefined {
  const agent = getAgent(id);
  if (!agent) return undefined;

  const db = getDb();
  const txn = db.transaction(() => {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.userId !== undefined) { fields.push('user_id = ?'); values.push(data.userId); }
    if (data.model !== undefined) { fields.push('model = ?'); values.push(data.model); }
    if (data.apiKey !== undefined) { fields.push('api_key = ?'); values.push(data.apiKey); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    if (data.connectionIds !== undefined) {
      db.prepare('DELETE FROM agent_connections WHERE agent_id = ?').run(id);
      const stmt = db.prepare('INSERT INTO agent_connections (agent_id, connection_id) VALUES (?, ?)');
      for (const connId of data.connectionIds) {
        stmt.run(id, connId);
      }
    }
  });
  txn();
  return getAgent(id);
}

export function deleteAgent(id: string): boolean {
  const result = getDb().prepare('DELETE FROM agents WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Organizations (OA-1/OA-2 scaffolding) ──

export function writeAuditEvent(data: {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): void {
  const id = genId('audit');
  getDb().prepare(
    'INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    data.actorUserId || null,
    data.action,
    data.entityType,
    data.entityId || null,
    JSON.stringify(data.metadata || {}),
  );
}

export function getIdempotentResponse(key: string, route: string, method: string): { responseJson: string; statusCode: number } | null {
  const row = getDb().prepare(
    'SELECT response_json, status_code FROM api_idempotency WHERE idempotency_key = ? AND route = ? AND method = ?'
  ).get(key, route, method) as { response_json: string; status_code: number } | undefined;
  if (!row) return null;
  return { responseJson: row.response_json, statusCode: row.status_code };
}

export function storeIdempotentResponse(key: string, route: string, method: string, response: unknown, statusCode: number): void {
  getDb().prepare(
    'INSERT OR REPLACE INTO api_idempotency (idempotency_key, route, method, response_json, status_code) VALUES (?, ?, ?, ?, ?)'
  ).run(key, route, method, JSON.stringify(response), statusCode);
}

export interface UserSkillInstall {
  user_id: string;
  skill_id: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export function listUserSkillInstalls(userId: string): UserSkillInstall[] {
  return getDb().prepare('SELECT * FROM user_skill_installs WHERE user_id = ? ORDER BY created_at DESC').all(userId) as UserSkillInstall[];
}

export function upsertUserSkillInstall(data: { userId: string; skillId: string; source?: string }): UserSkillInstall {
  const db = getDb();
  db.prepare(`
    INSERT INTO user_skill_installs (user_id, skill_id, source)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, skill_id)
    DO UPDATE SET source = excluded.source, updated_at = datetime('now')
  `).run(data.userId, data.skillId, data.source || 'public');
  return db.prepare('SELECT * FROM user_skill_installs WHERE user_id = ? AND skill_id = ?').get(data.userId, data.skillId) as UserSkillInstall;
}

export function deleteUserSkillInstall(userId: string, skillId: string): boolean {
  const res = getDb().prepare('DELETE FROM user_skill_installs WHERE user_id = ? AND skill_id = ?').run(userId, skillId);
  return res.changes > 0;
}

export interface ToolPolicy extends AdminToolCatalogEntry {
  enabled: boolean;
}

export interface AdminSettings {
  companyName: string;
  defaultModel: string;
  responseStyle: string;
  maxQueriesPerDay: number;
  maxAgents: number;
  dataRetentionDays: number;
  hasSharedApiKey: boolean;
  sharedApiKey: string | null;
}

const ADMIN_SETTINGS_DEFAULTS: Omit<AdminSettings, 'hasSharedApiKey' | 'sharedApiKey'> = {
  companyName: 'Mira',
  defaultModel: 'google/gemini-2.0-flash',
  responseStyle: 'professional',
  maxQueriesPerDay: 500,
  maxAgents: 10,
  dataRetentionDays: 90,
};

function readAppSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function writeAppSetting(key: string, value: string): void {
  getDb().prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key)
    DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value);
}

function readAppSecret(key: string): string | null {
  const row = getDb().prepare('SELECT encrypted_data FROM app_setting_secrets WHERE key = ?').get(key) as { encrypted_data: string } | undefined;
  if (!row) return null;
  return decrypt(row.encrypted_data);
}

function writeAppSecret(key: string, value: string | null): void {
  const db = getDb();
  if (!value) {
    db.prepare('DELETE FROM app_setting_secrets WHERE key = ?').run(key);
    return;
  }
  db.prepare(`
    INSERT INTO app_setting_secrets (key, encrypted_data, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key)
    DO UPDATE SET encrypted_data = excluded.encrypted_data, updated_at = datetime('now')
  `).run(key, encrypt(value));
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAdminSettings(): AdminSettings {
  const sharedApiKey = readAppSecret('sharedApiKey');
  return {
    companyName: readAppSetting('companyName') || ADMIN_SETTINGS_DEFAULTS.companyName,
    defaultModel: readAppSetting('defaultModel') || ADMIN_SETTINGS_DEFAULTS.defaultModel,
    responseStyle: readAppSetting('responseStyle') || ADMIN_SETTINGS_DEFAULTS.responseStyle,
    maxQueriesPerDay: parsePositiveInt(readAppSetting('maxQueriesPerDay'), ADMIN_SETTINGS_DEFAULTS.maxQueriesPerDay),
    maxAgents: parsePositiveInt(readAppSetting('maxAgents'), ADMIN_SETTINGS_DEFAULTS.maxAgents),
    dataRetentionDays: parsePositiveInt(readAppSetting('dataRetentionDays'), ADMIN_SETTINGS_DEFAULTS.dataRetentionDays),
    hasSharedApiKey: !!sharedApiKey,
    sharedApiKey,
  };
}

export function updateAdminSettings(data: Partial<{
  companyName: string;
  defaultModel: string;
  responseStyle: string;
  maxQueriesPerDay: number;
  maxAgents: number;
  dataRetentionDays: number;
  sharedApiKey: string | null;
}>): AdminSettings {
  if (data.companyName !== undefined) writeAppSetting('companyName', data.companyName.trim() || ADMIN_SETTINGS_DEFAULTS.companyName);
  if (data.defaultModel !== undefined) writeAppSetting('defaultModel', data.defaultModel.trim() || ADMIN_SETTINGS_DEFAULTS.defaultModel);
  if (data.responseStyle !== undefined) writeAppSetting('responseStyle', data.responseStyle.trim() || ADMIN_SETTINGS_DEFAULTS.responseStyle);
  if (data.maxQueriesPerDay !== undefined) writeAppSetting('maxQueriesPerDay', String(data.maxQueriesPerDay));
  if (data.maxAgents !== undefined) writeAppSetting('maxAgents', String(data.maxAgents));
  if (data.dataRetentionDays !== undefined) writeAppSetting('dataRetentionDays', String(data.dataRetentionDays));
  if (data.sharedApiKey !== undefined) writeAppSecret('sharedApiKey', data.sharedApiKey ? data.sharedApiKey.trim() : null);
  return getAdminSettings();
}

export function listToolPolicies(): ToolPolicy[] {
  const db = getDb();
  const rows = db.prepare('SELECT tool_name, enabled FROM tool_settings').all() as Array<{ tool_name: string; enabled: number }>;
  const byName = new Map(rows.map((row) => [row.tool_name, !!row.enabled]));
  return ADMIN_TOOL_CATALOG.map((tool) => ({
    ...tool,
    enabled: byName.has(tool.name) ? !!byName.get(tool.name) : tool.defaultEnabled,
  }));
}

export function updateToolPolicy(toolName: string, data: { enabled: boolean }): ToolPolicy | undefined {
  const catalogEntry = getAdminToolCatalogEntry(toolName);
  if (!catalogEntry) return undefined;

  getDb().prepare(`
    INSERT INTO tool_settings (tool_name, enabled)
    VALUES (?, ?)
    ON CONFLICT(tool_name)
    DO UPDATE SET enabled = excluded.enabled, updated_at = datetime('now')
  `).run(toolName, data.enabled ? 1 : 0);

  return {
    ...catalogEntry,
    enabled: data.enabled,
  };
}

export interface McpServerRecord {
  id: string;
  name: string;
  server_kind: McpServerKind;
  connection_id: string | null;
  connection_name: string | null;
  connection_type: string | null;
  transport: McpTransport;
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  status: string;
  enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function hydrateMcpServer(row: Record<string, unknown>): McpServerRecord {
  let args: string[] = [];
  let env: Record<string, string> = {};

  try {
    const parsedArgs = JSON.parse(String(row.args_json || '[]'));
    if (Array.isArray(parsedArgs)) {
      args = parsedArgs.map((entry) => String(entry));
    }
  } catch {
    args = [];
  }

  try {
    const parsedEnv = JSON.parse(String(row.env_json || '{}'));
    if (parsedEnv && typeof parsedEnv === 'object' && !Array.isArray(parsedEnv)) {
      env = Object.fromEntries(Object.entries(parsedEnv).map(([key, value]) => [key, String(value)]));
    }
  } catch {
    env = {};
  }

  return {
    id: String(row.id),
    name: String(row.name),
    server_kind: row.server_kind === 'connector_linked' ? 'connector_linked' : 'standalone',
    connection_id: typeof row.connection_id === 'string' ? row.connection_id : null,
    connection_name: typeof row.connection_name === 'string' ? row.connection_name : null,
    connection_type: typeof row.connection_type === 'string' ? row.connection_type : null,
    transport: row.transport === 'http' || row.transport === 'sse' ? row.transport : 'stdio',
    command: typeof row.command === 'string' ? row.command : null,
    args,
    env,
    url: typeof row.url === 'string' ? row.url : null,
    status: typeof row.status === 'string' ? row.status : 'configured',
    enabled: !!row.enabled,
    notes: typeof row.notes === 'string' ? row.notes : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function listMcpServers(): McpServerRecord[] {
  const rows = getDb().prepare(`
    SELECT m.*, c.name as connection_name, c.type as connection_type
    FROM mcp_servers m
    LEFT JOIN connections c ON c.id = m.connection_id
    ORDER BY m.created_at DESC
  `).all() as Record<string, unknown>[];

  return rows.map(hydrateMcpServer);
}

export function getMcpServer(id: string): McpServerRecord | undefined {
  const row = getDb().prepare(`
    SELECT m.*, c.name as connection_name, c.type as connection_type
    FROM mcp_servers m
    LEFT JOIN connections c ON c.id = m.connection_id
    WHERE m.id = ?
  `).get(id) as Record<string, unknown> | undefined;

  return row ? hydrateMcpServer(row) : undefined;
}

export function listAvailableConnectorMcpTargets(): Array<{ connection_id: string; connection_name: string; connection_type: string }> {
  return getDb().prepare(`
    SELECT c.id as connection_id, c.name as connection_name, c.type as connection_type
    FROM connections c
    LEFT JOIN mcp_servers m ON m.connection_id = c.id
    WHERE m.connection_id IS NULL
    ORDER BY c.created_at DESC
  `).all() as Array<{ connection_id: string; connection_name: string; connection_type: string }>;
}

export function createMcpServer(data: {
  name: string;
  serverKind: McpServerKind;
  connectionId?: string | null;
  transport: McpTransport;
  command?: string | null;
  args?: string[];
  env?: Record<string, string>;
  url?: string | null;
  notes?: string | null;
}): McpServerRecord {
  const id = genId('mcp');
  getDb().prepare(`
    INSERT INTO mcp_servers (id, name, server_kind, connection_id, transport, command, args_json, env_json, url, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.name,
    data.serverKind,
    data.connectionId || null,
    data.transport,
    data.command || null,
    JSON.stringify(data.args || []),
    JSON.stringify(data.env || {}),
    data.url || null,
    data.notes || null,
  );
  return getMcpServer(id)!;
}

export function updateMcpServer(id: string, data: Partial<{
  name: string;
  transport: McpTransport;
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  status: string;
  enabled: boolean;
  notes: string | null;
}>): McpServerRecord | undefined {
  const existing = getMcpServer(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.transport !== undefined) { fields.push('transport = ?'); values.push(data.transport); }
  if (data.command !== undefined) { fields.push('command = ?'); values.push(data.command); }
  if (data.args !== undefined) { fields.push('args_json = ?'); values.push(JSON.stringify(data.args)); }
  if (data.env !== undefined) { fields.push('env_json = ?'); values.push(JSON.stringify(data.env)); }
  if (data.url !== undefined) { fields.push('url = ?'); values.push(data.url); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.enabled !== undefined) { fields.push('enabled = ?'); values.push(data.enabled ? 1 : 0); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);
  getDb().prepare(`UPDATE mcp_servers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getMcpServer(id);
}

export function deleteMcpServer(id: string): boolean {
  const result = getDb().prepare('DELETE FROM mcp_servers WHERE id = ?').run(id);
  return result.changes > 0;
}

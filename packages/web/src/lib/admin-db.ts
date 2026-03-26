/**
 * Admin database — SQLite for users, connections, agents, and assignments.
 * This is the source of truth for admin CRUD operations.
 */

import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

const DB_PATH = path.resolve(process.cwd(), '../../data/buildai-admin.db');

let _db: Database.Database | null = null;

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
  `);
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
  config: Record<string, unknown>;
  secrets?: Record<string, string>;
}): Connection {
  const id = genId('conn');
  const normalized = normalizeConnectionInput(data.config, data.secrets);
  const configJson = JSON.stringify(normalized.config);

  const db = getDb();
  const txn = db.transaction(() => {
    db.prepare(
      'INSERT INTO connections (id, name, type, config) VALUES (?, ?, ?, ?)'
    ).run(id, data.name, data.type, configJson);

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

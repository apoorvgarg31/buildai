/**
 * Engine config manager — reads/writes buildai.config.json5.
 * Adds/removes agents from the engine config and signals reload.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const CONFIG_PATH = path.resolve(
  process.env.BUILDAI_ENGINE_CONFIG || path.join(process.cwd(), '../../packages/engine/buildai.config.json5')
);

interface AgentEntry {
  id: string;
  name?: string;
  workspace: string;
  model?: { primary: string };
  identity?: { name: string; emoji: string };
  heartbeat?: {
    every: string;
    activeHours?: { start: string; end: string; timezone?: string };
    prompt?: string;
  };
}

interface EngineConfig {
  agents?: {
    defaults?: Record<string, unknown>;
    list?: AgentEntry[];
  };
  [key: string]: unknown;
}

/**
 * Read the engine config file (JSON5 → parse as JSON since our file is valid JSON).
 */
function readConfig(): EngineConfig {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');

  // Prefer parsing the raw file first. Our config is usually valid JSON,
  // and naive comment stripping breaks URLs like http://localhost:3000.
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(cleaned);
  }
}

/**
 * Write the engine config file.
 */
function writeConfig(config: EngineConfig): void {
  const json = JSON.stringify(config, null, 2);
  fs.writeFileSync(CONFIG_PATH, json, 'utf-8');
}

function resolveProvider(model: string): string {
  return model.split('/')[0] || 'google';
}

export function writeAgentAuthProfile(agentId: string, model: string, apiKey: string): void {
  const provider = resolveProvider(model || 'google/gemini-2.0-flash');

  const envDir = path.resolve(path.dirname(CONFIG_PATH), '../../data/agent-env');
  if (!fs.existsSync(envDir)) fs.mkdirSync(envDir, { recursive: true });
  const envPath = path.join(envDir, `${agentId}.env`);
  const envLines: string[] = [];
  if (provider === 'anthropic') {
    envLines.push(`ANTHROPIC_API_KEY=${apiKey}`);
  } else if (provider === 'openai') {
    envLines.push(`OPENAI_API_KEY=${apiKey}`);
  } else if (provider === 'google') {
    envLines.push(`GEMINI_API_KEY=${apiKey}`);
  } else {
    envLines.push(`LLM_API_KEY=${apiKey}`);
  }
  fs.writeFileSync(envPath, envLines.join('\n') + '\n', 'utf-8');

  const stateDir = path.resolve(path.dirname(CONFIG_PATH), '.clawdbot-state');
  const authDir = path.join(stateDir, 'agents', agentId, 'agent');
  const authPath = path.join(authDir, 'auth-profiles.json');
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  type AuthFile = {
    version: number;
    profiles: Record<string, { type: string; provider: string; token?: string; access?: string; refresh?: string }>;
  };

  let authFile: AuthFile = { version: 1, profiles: {} };
  try {
    if (fs.existsSync(authPath)) {
      authFile = JSON.parse(fs.readFileSync(authPath, 'utf-8')) as AuthFile;
      if (!authFile.version) authFile.version = 1;
      if (!authFile.profiles) authFile.profiles = {};
    }
  } catch {
    authFile = { version: 1, profiles: {} };
  }

  authFile.profiles[`${provider}:default`] = {
    type: 'token',
    provider,
    token: apiKey,
  };

  fs.writeFileSync(authPath, JSON.stringify(authFile, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
  console.log(`[engine-config] Wrote auth profile for agent ${agentId} (${provider}) → ${authPath}`);
}

/**
 * Add an agent to the engine config.
 */
export async function addAgentToConfig(
  agentId: string,
  opts: { name: string; workspace: string; model?: string; apiKey?: string }
): Promise<void> {
  const config = readConfig();

  if (!config.agents) config.agents = {};
  if (!config.agents.list) config.agents.list = [];

  // Don't add duplicates
  const existing = config.agents.list.find(a => a.id === agentId);
  if (existing) {
    // Update existing
    existing.workspace = opts.workspace;
    if (opts.model) existing.model = { primary: opts.model };
    if (opts.name) existing.name = opts.name;
  } else {
    const entry: AgentEntry = {
      id: agentId,
      name: opts.name,
      workspace: opts.workspace,
      model: { primary: opts.model || 'google/gemini-2.0-flash' },
      identity: { name: 'BuildAI', emoji: '🏗️' },
      heartbeat: {
        every: '30m',
        activeHours: { start: '07:00', end: '19:00' },
        prompt: 'Read HEARTBEAT.md. Run the monitoring checks using available skills. If any issues found, write alerts to ACTIVE.md. If nothing needs attention, reply HEARTBEAT_OK.',
      },
    };
    config.agents.list.push(entry);
  }

  writeConfig(config);

  // Write agent-specific credentials if API key is provided.
  if (opts.apiKey) {
    writeAgentAuthProfile(agentId, opts.model || 'google/gemini-2.0-flash', opts.apiKey);
  }

  await reloadEngine();
}

/**
 * Remove an agent from the engine config.
 */
export async function removeAgentFromConfig(agentId: string): Promise<void> {
  const config = readConfig();
  if (config.agents?.list) {
    config.agents.list = config.agents.list.filter(a => a.id !== agentId);
  }
  writeConfig(config);
  await reloadEngine();
}

/**
 * Signal the engine to reload config.
 * Tries SIGUSR1 first (hot reload), falls back to no-op (engine will pick up on next session).
 */
export async function reloadEngine(): Promise<void> {
  try {
    // Find engine PID from the pidfile or by port
    // Cross-platform: use lsof (macOS/Linux) instead of ss (Linux only)
    const result = execSync("lsof -ti :18789 2>/dev/null || ss -tlnp 2>/dev/null | grep ':18789' | grep -oP 'pid=\\K[0-9]+'", { encoding: 'utf-8', timeout: 3000 }).trim().split('\n')[0];
    if (result) {
      const pid = parseInt(result, 10);
      if (!isNaN(pid)) {
        process.kill(pid, 'SIGUSR1');
        console.log(`[engine-config] Sent SIGUSR1 to engine PID ${pid}`);
        return;
      }
    }
  } catch {
    // Engine might not be running, that's OK
    console.log('[engine-config] Could not signal engine reload (engine may not be running)');
  }
}

/**
 * Engine config manager — reads/writes buildai.config.json5.
 * Adds/removes agents from the engine config and signals reload.
 */

import fs from 'fs';
import path from 'path';

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
  // Strip single-line comments for JSON5 compatibility
  const cleaned = raw.replace(/\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(cleaned);
}

/**
 * Write the engine config file.
 */
function writeConfig(config: EngineConfig): void {
  const json = JSON.stringify(config, null, 2);
  fs.writeFileSync(CONFIG_PATH, json, 'utf-8');
}

/**
 * Add an agent to the engine config.
 */
export async function addAgentToConfig(
  agentId: string,
  opts: { name: string; workspace: string; model?: string }
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
      model: { primary: opts.model || 'anthropic/claude-sonnet-4-20250514' },
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
async function reloadEngine(): Promise<void> {
  try {
    // Find engine PID from the pidfile or by port
    const { execSync } = require('child_process');
    const result = execSync("ss -tlnp | grep ':18790' | grep -oP 'pid=\\K[0-9]+'", { encoding: 'utf-8', timeout: 3000 }).trim();
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

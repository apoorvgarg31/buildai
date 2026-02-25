import path from 'path';

const AGENT_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isValidAgentId(agentId: string): boolean {
  return AGENT_ID_RE.test(agentId);
}

export function safeJoinWithin(baseDir: string, ...parts: string[]): string | null {
  const target = path.resolve(baseDir, ...parts);
  const base = path.resolve(baseDir);
  if (!target.startsWith(base + path.sep) && target !== base) {
    return null;
  }
  return target;
}

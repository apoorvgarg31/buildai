import { describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';

const script = path.resolve(__dirname, '../skills/buildai-procore/procore-api.sh');

function run(args: string[]) {
  const out = execFileSync('bash', [script, '--dry-run', ...args], { encoding: 'utf8' }).trim();
  return JSON.parse(out) as { mode: string; method: string; path: string; final_path: string };
}

describe('buildai-procore skill dry-run routing', () => {
  it('supports raw mode', () => {
    const res = run(['GET', '/rest/v1.0/projects']);
    expect(res.mode).toBe('raw');
    expect(res.method).toBe('GET');
    expect(res.path).toContain('/rest/v1.0/projects');
  });

  it('supports entity list mode', () => {
    const res = run(['rfis', 'list', '562949954991755']);
    expect(res.mode).toBe('entity');
    expect(res.method).toBe('GET');
    expect(res.path).toContain('/rest/v1.0/projects/562949954991755/rfis');
  });

  it('supports entity update mode and upgrades to v1.1 path', () => {
    const res = run(['rfis', 'update', '562949954991755', '123', '{"rfi":{"status":"closed"}}']);
    expect(res.mode).toBe('entity');
    expect(res.method).toBe('PATCH');
    expect(res.path).toContain('/rest/v1.0/projects/562949954991755/rfis/123');
    expect(res.final_path).toContain('/rest/v1.1/projects/562949954991755/rfis/123');
  });
});

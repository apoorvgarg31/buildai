/**
 * Test: Engine components are correctly configured for BuildAI
 * 
 * Verifies that:
 * 1. Config file exists and is valid JSON5
 * 2. Environment file exists with correct skip flags
 * 3. Disabled components are properly flagged
 * 4. Enabled components (core + webchat) are preserved
 * 5. Engine entry point exists and is loadable
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ENGINE_DIR = path.resolve(__dirname, '..');

describe('BuildAI Engine Component Configuration', () => {
  
  describe('Config file (buildai.config.json5)', () => {
    const configPath = path.join(ENGINE_DIR, 'buildai.config.json5');
    
    it('should exist', () => {
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('should be parseable (valid JSON5)', async () => {
      const content = fs.readFileSync(configPath, 'utf-8');
      // JSON5 allows comments — strip them for basic parse check
      const stripped = content
        .replace(/\/\/.*$/gm, '')  // line comments
        .replace(/\/\*[\s\S]*?\*\//g, '')  // block comments
        .replace(/,(\s*[}\]])/g, '$1');  // trailing commas
      
      const parsed = JSON.parse(stripped);
      expect(parsed).toBeDefined();
      expect(typeof parsed).toBe('object');
    });

    it('should disable browser automation', async () => {
      const config = parseConfig(configPath);
      expect(config.browser?.enabled).toBe(false);
    });

    it('should disable canvas/A2UI', async () => {
      const config = parseConfig(configPath);
      expect(config.canvasHost?.enabled).toBe(false);
    });

    it('should disable node host (device pairing)', async () => {
      const config = parseConfig(configPath);
      expect(config.nodeHost?.enabled).toBe(false);
    });

    it('should disable discovery', async () => {
      const config = parseConfig(configPath);
      expect(config.discovery?.enabled).toBe(false);
    });

    it('should disable all messaging channels except web', async () => {
      const config = parseConfig(configPath);
      const disabledChannels = [
        'telegram', 'discord', 'whatsapp', 'slack', 
        'signal', 'imessage', 'line', 'googlechat', 'msteams'
      ];
      
      for (const channel of disabledChannels) {
        expect(config.channels?.[channel]?.enabled).toBe(false);
      }
    });

    it('should keep web channel enabled', async () => {
      const config = parseConfig(configPath);
      expect(config.channels?.web?.enabled).toBe(true);
    });

    it('should keep cron enabled', async () => {
      const config = parseConfig(configPath);
      expect(config.cron?.enabled).toBe(true);
    });

    it('should keep internal hooks enabled', async () => {
      const config = parseConfig(configPath);
      expect(config.hooks?.internal?.enabled).toBe(true);
    });

    it('should have gateway configuration', async () => {
      const config = parseConfig(configPath);
      expect(config.gateway).toBeDefined();
      expect(config.gateway?.port).toBe(18789);
    });

    it('should have agent defaults', async () => {
      const config = parseConfig(configPath);
      expect(config.agents?.defaults?.model).toBeDefined();
    });
  });

  describe('Environment file (.env.buildai)', () => {
    const envPath = path.join(ENGINE_DIR, '.env.buildai');
    
    it('should exist', () => {
      expect(fs.existsSync(envPath)).toBe(true);
    });

    it('should set CLAWDBOT_SKIP_BROWSER_CONTROL_SERVER=1', () => {
      const content = fs.readFileSync(envPath, 'utf-8');
      expect(content).toContain('CLAWDBOT_SKIP_BROWSER_CONTROL_SERVER=1');
    });

    it('should set CLAWDBOT_SKIP_CANVAS_HOST=1', () => {
      const content = fs.readFileSync(envPath, 'utf-8');
      expect(content).toContain('CLAWDBOT_SKIP_CANVAS_HOST=1');
    });

    it('should set CLAWDBOT_SKIP_GMAIL_WATCHER=1', () => {
      const content = fs.readFileSync(envPath, 'utf-8');
      expect(content).toContain('CLAWDBOT_SKIP_GMAIL_WATCHER=1');
    });

    it('should set CLAWDBOT_SKIP_CHANNELS=1', () => {
      const content = fs.readFileSync(envPath, 'utf-8');
      expect(content).toContain('CLAWDBOT_SKIP_CHANNELS=1');
    });
  });

  describe('Component documentation (COMPONENTS.md)', () => {
    const docsPath = path.join(ENGINE_DIR, 'COMPONENTS.md');
    
    it('should exist', () => {
      expect(fs.existsSync(docsPath)).toBe(true);
    });

    it('should document enabled components', () => {
      const content = fs.readFileSync(docsPath, 'utf-8');
      const enabledComponents = ['Gateway', 'Agent Runtime', 'Tool System', 'Memory', 'Compaction', 'Heartbeat', 'Cron', 'Webchat'];
      for (const component of enabledComponents) {
        expect(content).toContain(component);
      }
    });

    it('should document disabled components', () => {
      const content = fs.readFileSync(docsPath, 'utf-8');
      const disabledComponents = ['Telegram', 'Discord', 'WhatsApp', 'Browser', 'Canvas'];
      for (const component of disabledComponents) {
        expect(content).toContain(component);
      }
    });
  });

  describe('Engine entry point', () => {
    it('should have dist/entry.js', () => {
      const entryPath = path.join(ENGINE_DIR, 'dist', 'entry.js');
      expect(fs.existsSync(entryPath)).toBe(true);
    });

    it('should have dist/gateway/server.js', () => {
      const serverPath = path.join(ENGINE_DIR, 'dist', 'gateway', 'server.js');
      expect(fs.existsSync(serverPath)).toBe(true);
    });

    it('should have dist/channels/web/index.js (webchat channel)', () => {
      const webChannelPath = path.join(ENGINE_DIR, 'dist', 'channels', 'web', 'index.js');
      expect(fs.existsSync(webChannelPath)).toBe(true);
    });

    it('should have dist/memory/ directory', () => {
      const memoryPath = path.join(ENGINE_DIR, 'dist', 'memory');
      expect(fs.existsSync(memoryPath)).toBe(true);
      expect(fs.statSync(memoryPath).isDirectory()).toBe(true);
    });

    it('should have dist/cron/ directory', () => {
      const cronPath = path.join(ENGINE_DIR, 'dist', 'cron');
      expect(fs.existsSync(cronPath)).toBe(true);
      expect(fs.statSync(cronPath).isDirectory()).toBe(true);
    });
  });

  describe('Startup script', () => {
    const scriptPath = path.join(ENGINE_DIR, 'start-buildai.sh');
    
    it('should exist and be executable', () => {
      expect(fs.existsSync(scriptPath)).toBe(true);
      const stat = fs.statSync(scriptPath);
      // Check executable bit
      expect(stat.mode & 0o111).toBeGreaterThan(0);
    });

    it('should source .env.buildai', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('.env.buildai');
    });

    it('should start the gateway via dist/entry.js', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('dist/entry.js');
      expect(content).toContain('gateway start');
    });
  });
});

// Helper: parse JSON5 config (strips comments and trailing commas)
function parseConfig(filePath: string): Record<string, any> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const stripped = content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(stripped);
}

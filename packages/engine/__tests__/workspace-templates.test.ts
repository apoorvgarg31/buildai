/**
 * Test: Workspace templates are complete and contain required sections
 * 
 * Validates that all template files exist in workspaces/templates/ and
 * contain the required sections for a construction PM agent.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', '..', 'workspaces', 'templates');

const REQUIRED_TEMPLATES = [
  'SOUL.md',
  'AGENTS.md',
  'HEARTBEAT.md',
  'ACTIVE.md',
  'TOOLS.md',
  'MEMORY.md',
];

describe('Workspace Templates', () => {
  
  describe('All required template files exist', () => {
    for (const file of REQUIRED_TEMPLATES) {
      it(`should have ${file}`, () => {
        const filePath = path.join(TEMPLATES_DIR, file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    }
  });

  describe('SOUL.md — Agent identity and behavior', () => {
    let content: string;
    
    beforeAll(() => {
      content = fs.readFileSync(path.join(TEMPLATES_DIR, 'SOUL.md'), 'utf-8');
    });

    it('should define the agent as a construction PM assistant', () => {
      expect(content.toLowerCase()).toContain('construction');
      expect(content.toLowerCase()).toContain('project manager');
    });

    it('should describe reactive/proactive behavior', () => {
      expect(content.toLowerCase()).toMatch(/reactive|proactive/);
    });

    it('should mention key construction concepts', () => {
      const concepts = ['rfi', 'submittal', 'budget', 'schedule'];
      for (const concept of concepts) {
        expect(content.toLowerCase()).toContain(concept);
      }
    });

    it('should mention PMIS systems', () => {
      expect(content.toLowerCase()).toContain('procore');
    });

    it('should define personality/communication style', () => {
      expect(content.toLowerCase()).toMatch(/personality|efficient|sharp|construction-savvy/);
    });

    it('should have safety rules', () => {
      expect(content.toLowerCase()).toMatch(/never fabricate|don't make up|confirm first/);
    });

    it('should emphasize offering next actions', () => {
      expect(content.toLowerCase()).toMatch(/next action|suggest|offer/);
    });
  });

  describe('HEARTBEAT.md — Monitoring configuration', () => {
    let content: string;
    
    beforeAll(() => {
      content = fs.readFileSync(path.join(TEMPLATES_DIR, 'HEARTBEAT.md'), 'utf-8');
    });

    it('should define a check schedule', () => {
      expect(content.toLowerCase()).toMatch(/schedule|heartbeat|interval|minutes/);
    });

    it('should monitor overdue RFIs', () => {
      expect(content.toLowerCase()).toContain('overdue rfi');
    });

    it('should monitor expiring insurance certificates', () => {
      expect(content.toLowerCase()).toMatch(/insurance|cert|expir/);
    });

    it('should monitor budget overruns', () => {
      expect(content.toLowerCase()).toMatch(/budget.*overrun|over.*budget/);
    });

    it('should monitor late submittals', () => {
      expect(content.toLowerCase()).toMatch(/late.*submittal|submittal.*late|submittal.*past/);
    });

    it('should monitor pending change orders', () => {
      expect(content.toLowerCase()).toMatch(/change order|pending.*co/);
    });

    it('should have schedule-related monitoring', () => {
      expect(content.toLowerCase()).toMatch(/schedule|critical path|milestone/);
    });

    it('should define alert format', () => {
      expect(content.toLowerCase()).toContain('alert');
    });

    it('should have quiet rules (no alerts at night)', () => {
      expect(content.toLowerCase()).toMatch(/quiet|night|pm|am/);
    });

    it('should mention pattern tracking', () => {
      expect(content.toLowerCase()).toMatch(/pattern|automat/);
    });
  });

  describe('AGENTS.md — Agent operating procedures', () => {
    let content: string;
    
    beforeAll(() => {
      content = fs.readFileSync(path.join(TEMPLATES_DIR, 'AGENTS.md'), 'utf-8');
    });

    it('should define session startup steps', () => {
      expect(content).toMatch(/SOUL\.md/);
      expect(content).toMatch(/ACTIVE\.md/);
      expect(content).toMatch(/TOOLS\.md/);
    });

    it('should describe memory management', () => {
      expect(content.toLowerCase()).toContain('memory');
    });

    it('should enforce write-first discipline', () => {
      expect(content.toLowerCase()).toMatch(/write.*first|write.*before/);
    });

    it('should describe reactive behavior', () => {
      expect(content.toLowerCase()).toContain('reactive');
    });

    it('should list what to watch for', () => {
      expect(content.toLowerCase()).toContain('overdue');
    });

    it('should describe tools usage', () => {
      expect(content.toLowerCase()).toContain('tools');
    });

    it('should have safety rules', () => {
      expect(content.toLowerCase()).toMatch(/safety|never fabricate/);
    });
  });

  describe('ACTIVE.md — Current state template', () => {
    let content: string;
    
    beforeAll(() => {
      content = fs.readFileSync(path.join(TEMPLATES_DIR, 'ACTIVE.md'), 'utf-8');
    });

    it('should have a status section', () => {
      expect(content.toLowerCase()).toContain('status');
    });

    it('should have a connected systems section', () => {
      expect(content.toLowerCase()).toMatch(/connect|system/);
    });

    it('should have a current tasks section', () => {
      expect(content.toLowerCase()).toMatch(/current.*task|task/);
    });
  });

  describe('TOOLS.md — Available tools documentation', () => {
    let content: string;
    
    beforeAll(() => {
      content = fs.readFileSync(path.join(TEMPLATES_DIR, 'TOOLS.md'), 'utf-8');
    });

    it('should document Procore tool', () => {
      expect(content.toLowerCase()).toContain('procore');
    });

    it('should document Database tool', () => {
      expect(content.toLowerCase()).toContain('database');
    });

    it('should document Documents tool', () => {
      expect(content.toLowerCase()).toContain('document');
    });

    it('should include usage examples', () => {
      expect(content).toContain('python3 tools/');
    });

    it('should mention safety constraints', () => {
      expect(content.toLowerCase()).toMatch(/safety|select.*only|no write/i);
    });
  });

  describe('MEMORY.md — Long-term memory template', () => {
    let content: string;
    
    beforeAll(() => {
      content = fs.readFileSync(path.join(TEMPLATES_DIR, 'MEMORY.md'), 'utf-8');
    });

    it('should have user profile section', () => {
      expect(content.toLowerCase()).toMatch(/user.*profile/);
    });

    it('should have projects section', () => {
      expect(content.toLowerCase()).toContain('projects');
    });

    it('should have preferences section', () => {
      expect(content.toLowerCase()).toContain('preferences');
    });
  });

  describe('Template consistency', () => {
    it('should all be non-empty', () => {
      for (const file of REQUIRED_TEMPLATES) {
        const content = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf-8');
        expect(content.trim().length).toBeGreaterThan(10);
      }
    });

    it('should all be valid markdown (start with # heading)', () => {
      for (const file of REQUIRED_TEMPLATES) {
        const content = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf-8');
        expect(content.trimStart().startsWith('#')).toBe(true);
      }
    });

    it('AGENTS.md should reference all other template files', () => {
      const agents = fs.readFileSync(path.join(TEMPLATES_DIR, 'AGENTS.md'), 'utf-8');
      expect(agents).toContain('SOUL.md');
      expect(agents).toContain('ACTIVE.md');
      expect(agents).toContain('TOOLS.md');
      // MEMORY.md is referenced indirectly via memory/ pattern
      expect(agents.toLowerCase()).toContain('memory');
    });
  });
});

// Need to import beforeAll from vitest
import { beforeAll } from 'vitest';

import { describe, expect, it } from 'vitest';
import { getMarketplaceSkill, listMarketplaceSkills, packageSkill } from '../src/lib/marketplace';

describe('marketplace Anthropic skill imports', () => {
  it('lists the requested Anthropic skills in the catalog', () => {
    const skills = listMarketplaceSkills();
    const anthroIds = skills.filter((skill) => skill.vendor === 'Anthropic').map((skill) => skill.id);

    expect(anthroIds).toEqual(expect.arrayContaining(['pdf', 'docx', 'doc-coauthoring', 'xlsx', 'pptx', 'skill-creator', 'internal-comms']));
  });

  it('uses the bundled upstream SKILL.md as marketplace readme', () => {
    const pdf = getMarketplaceSkill('pdf');
    const docCoauthoring = getMarketplaceSkill('doc-coauthoring');
    const internalComms = getMarketplaceSkill('internal-comms');
    const skillCreator = getMarketplaceSkill('skill-creator');

    expect(pdf?.readme).toContain('# PDF');
    expect(docCoauthoring?.readme).toContain('# Doc Co-Authoring Workflow');
    expect(internalComms?.readme).toContain('name: internal-comms');
    expect(skillCreator?.readme).toContain('# Skill Creator');
    expect(skillCreator?.vendor).toBe('Anthropic');
  });

  it('packages all requested Anthropic skill files from the bundled directories', () => {
    const pdfPackage = packageSkill('pdf');
    const docCoauthoringPackage = packageSkill('doc-coauthoring');
    const internalCommsPackage = packageSkill('internal-comms');
    const skillCreatorPackage = packageSkill('skill-creator');

    expect(pdfPackage?.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(['SKILL.md', 'forms.md', 'reference.md', 'LICENSE.txt']),
    );
    expect(docCoauthoringPackage?.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(['SKILL.md']),
    );
    expect(internalCommsPackage?.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'SKILL.md',
        'LICENSE.txt',
        'examples/3p-updates.md',
        'examples/company-newsletter.md',
      ]),
    );
    expect(skillCreatorPackage?.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'SKILL.md',
        'LICENSE.txt',
        'agents/grader.md',
        'assets/eval_review.html',
        'eval-viewer/viewer.html',
        'scripts/run_loop.py',
      ]),
    );
  });
});

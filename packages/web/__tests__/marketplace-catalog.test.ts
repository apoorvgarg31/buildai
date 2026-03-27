import { describe, expect, it } from 'vitest';
import { getMarketplaceSkill, listMarketplaceSkills, packageSkill } from '../src/lib/marketplace';

describe('marketplace Anthropic skill imports', () => {
  it('lists the requested Anthropic skills in the catalog', () => {
    const skills = listMarketplaceSkills();
    const anthroIds = skills.filter((skill) => skill.vendor === 'Anthropic').map((skill) => skill.id);

    expect(anthroIds).toEqual(expect.arrayContaining(['pdf', 'docx', 'xlsx', 'pptx', 'skill-creator']));
  });

  it('uses the bundled upstream SKILL.md as marketplace readme', () => {
    const pdf = getMarketplaceSkill('pdf');
    const skillCreator = getMarketplaceSkill('skill-creator');

    expect(pdf?.readme).toContain('# PDF');
    expect(skillCreator?.readme).toContain('# Skill Creator');
    expect(skillCreator?.vendor).toBe('Anthropic');
  });

  it('packages all requested Anthropic skill files from the bundled directories', () => {
    const pdfPackage = packageSkill('pdf');
    const skillCreatorPackage = packageSkill('skill-creator');

    expect(pdfPackage?.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(['SKILL.md', 'forms.md', 'reference.md', 'LICENSE.txt']),
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

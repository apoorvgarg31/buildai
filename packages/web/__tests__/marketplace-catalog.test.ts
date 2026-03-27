import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateInstallToken, getCategories, getMarketplaceSkill, listMarketplaceSkills, packageSkill, verifyInstallToken } from '../src/lib/marketplace';

describe('marketplace helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('marks installed skills and lists unique categories', () => {
    const skills = listMarketplaceSkills(['pdf', 'brand-guidelines@1']);

    expect(skills.find(skill => skill.id === 'pdf')?.installed).toBe(true);
    expect(skills.find(skill => skill.id === 'brand-guidelines')?.installed).toBe(true);
    expect(skills.find(skill => skill.id === 'docx')?.installed).toBe(false);

    const categories = getCategories();
    expect(categories.length).toBe(new Set(categories).size);
    expect(categories).toEqual(expect.arrayContaining(['Documents', 'Communication', 'PMIS']));
  });

  it('generates install tokens that verify, and rejects tampered or expired tokens', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const token = generateInstallToken('pdf', 'agent-1');
    expect(verifyInstallToken(token)).toEqual({ skillId: 'pdf', agentId: 'agent-1' });

    const [payload, sig] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ skillId: 'docx', agentId: 'agent-1', exp: 1_700_000_000_000 + 3_600_000, nonce: 'abcd' })).toString('base64url');
    expect(verifyInstallToken(`${tamperedPayload}.${sig}`)).toBeNull();

    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000 + 3_600_001);
    expect(verifyInstallToken(token)).toBeNull();
    expect(verifyInstallToken('not-a-token')).toBeNull();
  });

  it('returns null when packaging an unknown skill', () => {
    expect(packageSkill('missing-skill')).toBeNull();
    expect(getMarketplaceSkill('missing-skill')).toBeUndefined();
  });
});

describe('marketplace Anthropic skill imports', () => {
  it('lists the requested Anthropic skills in the catalog', () => {
    const skills = listMarketplaceSkills();
    const anthroIds = skills.filter((skill) => skill.vendor === 'Anthropic').map((skill) => skill.id);

    expect(anthroIds).toEqual(expect.arrayContaining(['pdf', 'docx', 'doc-coauthoring', 'xlsx', 'pptx', 'skill-creator', 'internal-comms', 'brand-guidelines']));
  });

  it('uses the bundled upstream SKILL.md as marketplace readme', () => {
    const pdf = getMarketplaceSkill('pdf');
    const docCoauthoring = getMarketplaceSkill('doc-coauthoring');
    const internalComms = getMarketplaceSkill('internal-comms');
    const brandGuidelines = getMarketplaceSkill('brand-guidelines');
    const skillCreator = getMarketplaceSkill('skill-creator');

    expect(pdf?.readme).toContain('# PDF');
    expect(docCoauthoring?.readme).toContain('# Doc Co-Authoring Workflow');
    expect(internalComms?.readme).toContain('name: internal-comms');
    expect(brandGuidelines?.readme).toContain('name: brand-guidelines');
    expect(skillCreator?.readme).toContain('# Skill Creator');
    expect(skillCreator?.vendor).toBe('Anthropic');
  });

  it('packages all requested Anthropic skill files from the bundled directories', () => {
    const pdfPackage = packageSkill('pdf');
    const docCoauthoringPackage = packageSkill('doc-coauthoring');
    const internalCommsPackage = packageSkill('internal-comms');
    const brandGuidelinesPackage = packageSkill('brand-guidelines');
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
    expect(brandGuidelinesPackage?.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(['SKILL.md', 'LICENSE.txt']),
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

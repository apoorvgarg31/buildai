import { describe, expect, it } from 'vitest';
import { defaultUserSettings, parseUserSettingsFromMarkdown, upsertUserSettingsInMarkdown } from '../src/lib/user-settings';

describe('user settings markdown helpers', () => {
  it('parses persisted settings from USER.md preferences section', () => {
    const markdown = `# USER

## Preferences
- Response style: detailed
- Alert level: all
- Daily brief: 07:45
- Proactive updates: disabled
`;

    expect(parseUserSettingsFromMarkdown(markdown)).toEqual({
      responseStyle: 'detailed',
      alertLevel: 'all',
      dailyBriefTime: '07:45',
      proactiveUpdates: false,
    });
  });

  it('falls back to defaults when no preferences section exists', () => {
    expect(parseUserSettingsFromMarkdown('# USER\n- Name: Test')).toEqual(defaultUserSettings);
  });

  it('upserts the preferences section without dropping other USER.md content', () => {
    const original = `# USER\n\n## Role\n- PM\n\n## Preferences\n- Response style: concise\n- Alert level: critical\n- Daily brief: 08:30\n- Proactive updates: enabled\n\n## Top Pain Points\n- RFIs\n`;

    const next = upsertUserSettingsInMarkdown(original, {
      responseStyle: 'balanced',
      alertLevel: 'important',
      dailyBriefTime: '09:15',
      proactiveUpdates: false,
    });

    expect(next).toContain('## Role\n- PM');
    expect(next).toContain('## Top Pain Points\n- RFIs');
    expect(next).toContain('## Preferences\n- Response style: balanced\n- Alert level: important\n- Daily brief: 09:15\n- Proactive updates: disabled');
    expect(next).not.toContain('Response style: concise');
  });
});

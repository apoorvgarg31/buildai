export type ResponseStyle = "concise" | "balanced" | "detailed";
export type AlertLevel = "critical" | "important" | "all";

export interface UserSettings {
  responseStyle: ResponseStyle;
  alertLevel: AlertLevel;
  dailyBriefTime: string;
  proactiveUpdates: boolean;
}

export const defaultUserSettings: UserSettings = {
  responseStyle: "balanced",
  alertLevel: "important",
  dailyBriefTime: "08:30",
  proactiveUpdates: true,
};

function parsePreferenceLine(markdown: string, label: string): string {
  const prefix = `- ${label.toLowerCase()}:`;
  const line = markdown
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.toLowerCase().startsWith(prefix));

  return line ? line.slice(prefix.length).trim() : "";
}

function sanitizeTime(value: string): string {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? value : defaultUserSettings.dailyBriefTime;
}

export function parseUserSettingsFromMarkdown(markdown: string): UserSettings {
  const preferencesBlock = markdown.match(/## Preferences\n([\s\S]*?)(?:\n## |\s*$)/)?.[1] || "";
  if (!preferencesBlock.trim()) return { ...defaultUserSettings };

  const responseStyle = parsePreferenceLine(preferencesBlock, "Response style");
  const alertLevel = parsePreferenceLine(preferencesBlock, "Alert level");
  const dailyBriefTime = parsePreferenceLine(preferencesBlock, "Daily brief");
  const proactiveUpdates = parsePreferenceLine(preferencesBlock, "Proactive updates").toLowerCase();

  return {
    responseStyle:
      responseStyle === "concise" || responseStyle === "balanced" || responseStyle === "detailed"
        ? responseStyle
        : defaultUserSettings.responseStyle,
    alertLevel:
      alertLevel === "critical" || alertLevel === "important" || alertLevel === "all"
        ? alertLevel
        : defaultUserSettings.alertLevel,
    dailyBriefTime: sanitizeTime(dailyBriefTime),
    proactiveUpdates:
      proactiveUpdates === "disabled"
        ? false
        : proactiveUpdates === "enabled"
          ? true
          : defaultUserSettings.proactiveUpdates,
  };
}

function buildPreferencesSection(settings: UserSettings): string {
  return [
    "## Preferences",
    `- Response style: ${settings.responseStyle}`,
    `- Alert level: ${settings.alertLevel}`,
    `- Daily brief: ${sanitizeTime(settings.dailyBriefTime)}`,
    `- Proactive updates: ${settings.proactiveUpdates ? "enabled" : "disabled"}`,
  ].join("\n");
}

export function upsertUserSettingsInMarkdown(markdown: string, settings: UserSettings): string {
  const nextSection = buildPreferencesSection(settings);
  const normalized = markdown.trimEnd();

  if (!normalized) {
    return `# USER\n\n${nextSection}\n`;
  }

  if (/## Preferences\n([\s\S]*?)(?:\n## |\s*$)/.test(normalized)) {
    const replaced = normalized.replace(/## Preferences\n([\s\S]*?)(?=\n## |\s*$)/, nextSection);
    return `${replaced.trimEnd()}\n`;
  }

  return `${normalized}\n\n${nextSection}\n`;
}

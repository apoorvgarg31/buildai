"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell, SectionCard } from "./MiraShell";
import { defaultUserSettings, parseUserSettingsFromMarkdown, upsertUserSettingsInMarkdown, type AlertLevel, type ResponseStyle, type UserSettings } from "@/lib/user-settings";

const responseStyleCopy: Record<ResponseStyle, string> = {
  concise: "Short, direct answers for high-tempo project work.",
  balanced: "A practical middle ground for normal daily operations.",
  detailed: "Longer context when you want full reasoning and caveats.",
};

const alertLevelCopy: Record<AlertLevel, string> = {
  critical: "Interrupt only for blockers, risk, and schedule threats.",
  important: "Surface major changes without constant noise.",
  all: "Show every meaningful update the workspace can produce.",
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [userMarkdown, setUserMarkdown] = useState("");
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings);

  useEffect(() => {
    let mounted = true;

    fetch("/api/personality/files")
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "load failed");
        return data;
      })
      .then((data) => {
        if (!mounted) return;
        const nextUserMarkdown = typeof data.files?.USER === "string" ? data.files.USER : "";
        setUserMarkdown(nextUserMarkdown);
        setSettings(parseUserSettingsFromMarkdown(nextUserMarkdown));
      })
      .catch(() => {
        if (!mounted) return;
        setError("We could not load your settings.");
        setUserMarkdown("");
        setSettings(defaultUserSettings);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const previewSummary = useMemo(() => {
    return [
      `${settings.responseStyle} replies`,
      `${settings.alertLevel} alerts`,
      `daily brief ${settings.dailyBriefTime}`,
      settings.proactiveUpdates ? "proactive updates on" : "proactive updates off",
    ].join(" • ");
  }, [settings]);

  async function saveSettings() {
    setSaving(true);
    setError("");
    setMessage("");

    const nextMarkdown = upsertUserSettingsInMarkdown(userMarkdown, settings);
    try {
      const response = await fetch("/api/personality/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: "USER.md", content: nextMarkdown }),
      });

      if (!response.ok) {
        throw new Error("save failed");
      }

      setUserMarkdown(nextMarkdown);
      setMessage("Preferences saved for future Mira sessions.");
    } catch {
      setError("We could not save your settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      title="Workspace settings"
      subtitle="Shape how Mira briefs you, how proactive it should be, and how much signal cuts through during the day. These preferences are written into your workspace memory instead of living as dead UI state."
      eyebrow="User settings"
      actions={<button onClick={saveSettings} disabled={loading || saving} className="mira-button-primary px-4 py-2 text-sm font-semibold disabled:opacity-50">{saving ? "Saving..." : "Save preferences"}</button>}
    >
      <div className="mx-auto max-w-6xl space-y-5">
        {(error || message) && (
          <SectionCard>
            <p className={`text-sm ${error ? "text-rose-600" : "text-emerald-700"}`}>{error || message}</p>
          </SectionCard>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_0.9fr]">
          <SectionCard>
            <p className="mira-eyebrow">Preference profile</p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Assistant defaults that persist with your workspace</h2>
            <p className="mt-2 text-sm text-slate-600">These controls update the preference section in your `USER.md`, so the agent keeps the same working rhythm when the session restarts or the runtime is recreated.</p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Response style</span>
                <select aria-label="Response style" value={settings.responseStyle} onChange={(e) => setSettings((prev) => ({ ...prev, responseStyle: e.target.value as ResponseStyle }))} disabled={loading} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400">
                  <option value="concise">Concise</option>
                  <option value="balanced">Balanced</option>
                  <option value="detailed">Detailed</option>
                </select>
                <p className="text-xs leading-5 text-slate-500">{responseStyleCopy[settings.responseStyle]}</p>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Alert level</span>
                <select aria-label="Alert level" value={settings.alertLevel} onChange={(e) => setSettings((prev) => ({ ...prev, alertLevel: e.target.value as AlertLevel }))} disabled={loading} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400">
                  <option value="critical">Critical only</option>
                  <option value="important">Important</option>
                  <option value="all">All meaningful updates</option>
                </select>
                <p className="text-xs leading-5 text-slate-500">{alertLevelCopy[settings.alertLevel]}</p>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Daily brief time</span>
                <input aria-label="Daily brief time" type="time" value={settings.dailyBriefTime} onChange={(e) => setSettings((prev) => ({ ...prev, dailyBriefTime: e.target.value }))} disabled={loading} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400" />
                <p className="text-xs leading-5 text-slate-500">When Mira should shape the start-of-day snapshot written for this workspace.</p>
              </label>

              <label className="flex items-start gap-3 rounded-[1.5rem] border border-slate-200/70 bg-slate-50/70 px-4 py-4 text-sm font-medium text-slate-700">
                <input aria-label="Proactive updates" type="checkbox" checked={settings.proactiveUpdates} onChange={(e) => setSettings((prev) => ({ ...prev, proactiveUpdates: e.target.checked }))} disabled={loading} className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-300" />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Proactive updates</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">Allow Mira to surface material changes without waiting for a direct prompt.</span>
                </span>
              </label>
            </div>
          </SectionCard>

          <div className="space-y-5">
            <SectionCard>
              <p className="mira-eyebrow">Live policy</p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">How Mira will behave</h2>
              <p className="mt-3 rounded-[1.3rem] bg-slate-950 px-4 py-4 text-sm leading-6 text-white/92">{previewSummary}</p>
            </SectionCard>

            <SectionCard>
              <p className="mira-eyebrow">Persistence</p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">Why this is durable</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
                <li>Preferences are stored in your workspace memory, not in a temporary client store.</li>
                <li>They survive page reloads and future sessions because the agent reads the same `USER.md` file later.</li>
                <li>The save path uses the existing signed-in personality file API, so no second shadow settings system is introduced.</li>
              </ul>
            </SectionCard>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

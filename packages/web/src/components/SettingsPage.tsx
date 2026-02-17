"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("Mike Torres");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [slackNotifs, setSlackNotifs] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <header className="flex items-center pl-14 pr-6 lg:px-6 h-14 border-b border-white/5 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-white">Settings</h2>
          <p className="text-[11px] text-gray-500">Your preferences</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile */}
          <div className="rounded-xl border border-white/5 bg-[#171717] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Profile</h3>
            <label className="block">
              <span className="text-[12px] text-gray-400">Display Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/30 transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-[12px] text-gray-400">Timezone</span>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-sm text-white focus:outline-none focus:border-amber-500/30 transition-colors"
              >
                <option value="America/New_York">Eastern (ET)</option>
                <option value="America/Chicago">Central (CT)</option>
                <option value="America/Denver">Mountain (MT)</option>
                <option value="America/Los_Angeles">Pacific (PT)</option>
                <option value="America/Anchorage">Alaska (AKT)</option>
                <option value="Pacific/Honolulu">Hawaii (HT)</option>
              </select>
            </label>
          </div>

          {/* Notifications */}
          <div className="rounded-xl border border-white/5 bg-[#171717] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <Toggle label="Email notifications" desc="RFI deadlines, budget alerts, schedule changes" checked={emailNotifs} onChange={setEmailNotifs} />
            <Toggle label="Slack notifications" desc="Push alerts to your Slack channel" checked={slackNotifs} onChange={setSlackNotifs} />
            <Toggle label="Weekly digest" desc="Summary of AI usage and project highlights every Monday" checked={weeklyDigest} onChange={setWeeklyDigest} />
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              saved
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25"
            }`}
          >
            {saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-[13px] text-gray-200">{label}</p>
        <p className="text-[11px] text-gray-500">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-amber-500" : "bg-white/10"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

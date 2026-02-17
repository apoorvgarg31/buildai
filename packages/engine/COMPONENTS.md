# Engine Components — Enable/Disable Guide

This document maps every major engine component to its enable/disable mechanism.
BuildAI only needs a subset of the full Clawdbot engine.

## Component Status

### ✅ ENABLED (Core BuildAI)

| Component | What It Does | Config | Env Override |
|-----------|-------------|--------|-------------|
| **Gateway** | WebSocket server, session mgmt, message routing | `gateway` section | `CLAWDBOT_GATEWAY_PORT` |
| **Agent Runtime** | LLM integration, streaming, context management | Always on | — |
| **Tool System** | exec-based tool dispatch | `tools` section | — |
| **Memory** | MEMORY.md, daily logs, ACTIVE.md | Always on (file-based) | — |
| **Compaction** | Context compaction with knowledge preservation | Built into runtime | — |
| **Heartbeat** | Scheduled monitoring (30min intervals) | Built into runtime | — |
| **Cron** | Scheduled jobs, daily digest | `cron.enabled: true` | `CLAWDBOT_SKIP_CRON=1` to disable |
| **Webchat** | Web channel via gateway WebSocket | `channels.web.enabled: true` | — |
| **Exec** | Shell command execution for tools | Built into tool system | — |
| **Hooks** | Internal event hooks for reactive behavior | `hooks.internal.enabled: true` | — |

### ❌ DISABLED (Not Needed for BuildAI)

| Component | What It Does | Disable Method | Re-Enable |
|-----------|-------------|---------------|-----------|
| **Telegram** | Telegram bot channel | `channels.telegram.enabled: false` | Set to `true` |
| **Discord** | Discord bot channel | `channels.discord.enabled: false` | Set to `true` |
| **WhatsApp** | WhatsApp channel (Baileys) | `channels.whatsapp.enabled: false` | Set to `true` |
| **Slack** | Slack bot channel | `channels.slack.enabled: false` | Set to `true` |
| **Signal** | Signal channel | `channels.signal.enabled: false` | Set to `true` |
| **iMessage** | iMessage channel (macOS) | `channels.imessage.enabled: false` | Set to `true` |
| **Line** | Line messaging channel | `channels.line.enabled: false` | Set to `true` |
| **Google Chat** | Google Chat channel | `channels.googlechat.enabled: false` | Set to `true` |
| **MS Teams** | Microsoft Teams channel | `channels.msteams.enabled: false` | Set to `true` |
| **Browser** | Browser automation (Playwright/CDP) | `browser.enabled: false` + `CLAWDBOT_SKIP_BROWSER_CONTROL_SERVER=1` | Remove env var, set `true` |
| **Canvas/A2UI** | Canvas rendering and A2UI | `canvasHost.enabled: false` + `CLAWDBOT_SKIP_CANVAS_HOST=1` | Remove env var, set `true` |
| **Node Pairing** | Mobile device pairing (camera, screen) | `nodeHost.enabled: false` | Set to `true` |
| **Discovery** | Bonjour/mDNS device discovery | `discovery.enabled: false` | Set to `true` |
| **Gmail Watcher** | Email monitoring via hooks | `hooks.gmail.enabled: false` + `CLAWDBOT_SKIP_GMAIL_WATCHER=1` | Remove env var |
| **TTS** | Text-to-speech output | `tts.enabled: false` | Set to `true` |
| **ClawdHub** | Skill marketplace / remote skills | Not configured | Add ClawdHub config |

### 🔮 FUTURE (Will Enable Later)

| Component | Phase | Notes |
|-----------|-------|-------|
| **TTS** | Phase 5 | Voice output for jobsite use |
| **Voice Input (STT)** | Phase 5 | Whisper integration |
| **Gmail Watcher** | Phase 6 | Email monitoring for PMs |

## Configuration Files

1. **`buildai.config.json5`** — Primary config (JSON5 format, used by engine)
2. **`.env.buildai`** — Environment variables for process-level component control
3. **`COMPONENTS.md`** — This file (documentation only)

## How to Apply

### Development
```bash
# Source the env file before starting engine
source packages/engine/.env.buildai

# Or set env vars inline
CLAWDBOT_SKIP_BROWSER_CONTROL_SERVER=1 \
CLAWDBOT_SKIP_CANVAS_HOST=1 \
CLAWDBOT_SKIP_GMAIL_WATCHER=1 \
CLAWDBOT_SKIP_CHANNELS=1 \
node packages/engine/dist/entry.js gateway start
```

### Production
Set environment variables in your deployment platform (Docker, systemd, etc.)
and mount `buildai.config.json5` as the engine config.

## Skills (Extensions)

Located in `skills/` and `extensions/`. These are loaded on-demand by the agent,
not at startup. No need to delete them — unused skills simply aren't invoked.

### Skills to BUILD for BuildAI:
- `procore` — Procore PMIS integration (Phase 2)
- `database` — Read-only database queries (Phase 3)
- `documents` — Document management via Gemini (Phase 3)

### Existing skills (not used, can ignore):
Most skills in `skills/` are Clawdbot-specific (Spotify, Discord, GitHub, etc.)
and won't be invoked by the construction PM agent.

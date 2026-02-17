# BuildAI — Deployment & Security Implementation Plan

> From demo to production. Everything needed to ship to real customers.

---

## Current State (Feb 2026)

### ✅ Working
- Chat UI → Engine gateway (WebSocket, server-side proxy)
- Agent creation from admin panel (workspace + skill provisioning)
- Marketplace with 12 skills (8 working, 4 coming soon)
- SQLite admin DB (users, agents, connections)
- Postgres project DB with demo data
- Engine built and startable via `start-buildai.sh`
- Gateway binds to loopback only (not exposed to internet)

### ❌ Not Shipped
- No deployment (localhost only)
- No real auth (hardcoded demo users)
- No sandbox isolation between agents
- No HTTPS / domain
- Hardcoded gateway token

---

## Phase 1: Authentication (Clerk)

**Why Clerk:** Free up to 50k MAU, Google + Microsoft OAuth built-in, works on localhost, 30-minute setup.

### Steps

1. **Create Clerk account** at clerk.com
   - Create a new application (e.g., "BuildAI")
   - Enable providers: Google, Microsoft, Email/Password
   - Copy publishable key + secret key

2. **Install Clerk SDK**
   ```bash
   cd packages/web
   npm install @clerk/nextjs
   ```

3. **Add env vars** to `.env.local`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
   ```

4. **Wrap app layout** in `ClerkProvider`:
   ```tsx
   // app/layout.tsx
   import { ClerkProvider } from '@clerk/nextjs';
   
   export default function RootLayout({ children }) {
     return (
       <ClerkProvider>
         <html><body>{children}</body></html>
       </ClerkProvider>
     );
   }
   ```

5. **Add middleware** for route protection:
   ```ts
   // middleware.ts
   import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
   
   const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);
   
   export default clerkMiddleware(async (auth, req) => {
     if (!isPublicRoute(req)) await auth.protect();
   });
   ```

6. **Replace LoginScreen** with Clerk's `<SignIn />` component

7. **Admin role check** via Clerk public metadata:
   ```ts
   // In Clerk dashboard: set user metadata { "role": "admin" }
   // In code:
   const { user } = useUser();
   const isAdmin = user?.publicMetadata?.role === 'admin';
   ```

8. **Map Clerk users to agents** — update SQLite users table:
   - Add `clerk_id` column
   - On first login, create user record + assign agent
   - Admin assigns agents via admin panel (already built)

9. **Remove old auth** — delete `lib/auth.ts` (hardcoded demo users)

### Effort: ~2-3 hours

---

## Phase 2: Deployment (GCE VM)

**Why GCE:** Docker sandbox support, full control, $300 free credit, ~$25/mo after.

### Architecture

```
Internet
   │
   ▼
┌─────────────────────────────────────────────┐
│  GCE VM (e2-medium, 2 vCPU, 4GB RAM)       │
│                                              │
│  ┌──────────┐    ┌───────────────────────┐  │
│  │  Caddy    │───▶│  Next.js (port 3001)  │  │
│  │ (HTTPS)   │    │  Frontend + API       │  │
│  │ :443/:80  │    └──────────┬────────────┘  │
│  └──────────┘               │ ws://localhost  │
│                              ▼                │
│               ┌──────────────────────────┐   │
│               │  BuildAI Engine          │   │
│               │  Gateway (port 18790)    │   │
│               │  loopback only           │   │
│               └──────────┬───────────────┘   │
│                          │                    │
│            ┌─────────────┼──────────────┐    │
│            ▼             ▼              ▼    │
│     ┌──────────┐  ┌──────────┐  ┌────────┐ │
│     │Container │  │Container │  │Contain. │ │
│     │Agent A   │  │Agent B   │  │Agent C  │ │
│     │(sandbox) │  │(sandbox) │  │(sandbox)│ │
│     └──────────┘  └──────────┘  └────────┘ │
│                                              │
│  ┌──────────┐  ┌──────────┐                 │
│  │ SQLite   │  │ Postgres │                 │
│  │ admin DB │  │ project  │                 │
│  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────┘
```

### Steps

1. **Create GCE VM**
   ```bash
   gcloud compute instances create buildai-prod \
     --machine-type=e2-medium \
     --zone=europe-west2-a \
     --image-family=ubuntu-2204-lts \
     --image-project=ubuntu-os-cloud \
     --boot-disk-size=50GB \
     --tags=http-server,https-server
   ```

2. **Open firewall**
   ```bash
   gcloud compute firewall-rules create allow-https \
     --allow tcp:80,tcp:443 --target-tags=https-server
   ```

3. **Install dependencies on VM**
   ```bash
   # SSH in
   gcloud compute ssh buildai-prod
   
   # Install Node.js 22
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs
   
   # Install Docker
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   
   # Install Caddy (auto-HTTPS)
   sudo apt install -y caddy
   
   # Install PostgreSQL
   sudo apt install -y postgresql postgresql-contrib
   
   # Install pnpm
   npm install -g pnpm
   ```

4. **Set up Caddy** (automatic HTTPS with Let's Encrypt):
   ```
   # /etc/caddy/Caddyfile
   app.buildai.dev {
     reverse_proxy localhost:3001
   }
   ```

5. **Clone and build**
   ```bash
   git clone https://github.com/apoorvgarg31/buildai.git
   cd buildai
   
   # Web frontend
   cd packages/web
   pnpm install
   pnpm build
   
   # Engine
   cd ../engine
   pnpm install
   ```

6. **Production env vars** — create `.env.production`:
   ```bash
   # Auth (Clerk)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   
   # Engine
   BUILDAI_GATEWAY_URL=ws://localhost:18790
   BUILDAI_GATEWAY_TOKEN=<generate-strong-random-token>
   
   # Database
   DB_HOST=/var/run/postgresql
   DB_PORT=5432
   DB_NAME=buildai_prod
   DB_USER=buildai
   
   # Procore (per-tenant later, shared for now)
   PROCORE_CLIENT_ID=...
   PROCORE_CLIENT_SECRET=...
   ```

7. **Process management** — use systemd:
   ```ini
   # /etc/systemd/system/buildai-web.service
   [Unit]
   Description=BuildAI Web Frontend
   After=network.target
   
   [Service]
   WorkingDirectory=/home/buildai/buildai/packages/web
   ExecStart=/usr/bin/node server.js
   Restart=always
   EnvironmentFile=/home/buildai/buildai/.env.production
   
   [Install]
   WantedBy=multi-user.target
   ```
   
   ```ini
   # /etc/systemd/system/buildai-engine.service
   [Unit]
   Description=BuildAI Engine Gateway
   After=network.target
   
   [Service]
   WorkingDirectory=/home/buildai/buildai/packages/engine
   ExecStart=/bin/bash start-buildai.sh
   Restart=always
   EnvironmentFile=/home/buildai/buildai/.env.production
   
   [Install]
   WantedBy=multi-user.target
   ```

8. **Domain** — point `app.buildai.dev` (or whatever domain) to VM's external IP

### Effort: ~4-6 hours

---

## Phase 3: Sandbox Isolation

**Why:** Without sandboxing, any agent can read other agents' files, env vars, and host filesystem.

### Steps

1. **Enable Docker sandbox** in `buildai.config.json5`:
   ```json5
   {
     "agents": {
       "defaults": {
         "sandbox": {
           "mode": "all",        // Sandbox every session
           "scope": "agent",     // One container per agent
           "workspaceAccess": "rw"  // Agent can read/write its own workspace
         }
       }
     }
   }
   ```

2. **What this does:**
   - Each agent gets its own Docker container
   - Container only sees its own workspace (mounted at `/workspace`)
   - Cannot access host filesystem, other workspaces, or env vars
   - Engine manages container lifecycle automatically
   - Container persists while agent is active (good for long conversations)

3. **Per-agent env vars** — move secrets out of global env:
   - Database credentials → injected per-agent via skill config
   - Procore tokens → per-tenant OAuth (Phase 5)
   - Gateway token → only on host, never in containers

4. **Disable Telegram** in engine config (remove from plugins):
   ```json5
   {
     "plugins": {
       "entries": {}  // Empty — no messaging channels
     }
   }
   ```

### Effort: ~1-2 hours (after Docker is installed)

---

## Phase 4: Production Hardening

### Security Checklist

- [ ] Generate strong gateway token (replace `buildai-dev-token-2026`)
  ```bash
  openssl rand -hex 32
  ```
- [ ] Disable Telegram plugin in engine config
- [ ] Set `NODE_ENV=production` on all services
- [ ] Configure Caddy HTTPS (automatic with Let's Encrypt)
- [ ] Set up daily backups (SQLite + Postgres + workspaces)
  ```bash
  # Cron job: daily backup to GCS
  0 3 * * * /home/buildai/scripts/backup.sh
  ```
- [ ] Set up monitoring (uptime check on `/api/health`)
- [ ] Rate limiting on API routes
- [ ] Log rotation for engine and web logs
- [ ] Firewall: only ports 80/443 open, everything else blocked

### Database

- [ ] Create production Postgres database with separate user
- [ ] Set strong Postgres password
- [ ] Enable SSL on Postgres connections
- [ ] Set up pg_dump nightly backup

### Effort: ~2-3 hours

---

## Phase 5: Per-Tenant Procore OAuth (Future)

**Current:** All agents share one Procore token (rahil's account).
**Target:** Each customer connects their own Procore account.

### Flow
1. Admin creates a customer org
2. Customer clicks "Connect Procore" in settings
3. OAuth flow → customer authorizes BuildAI
4. Token stored per-org (encrypted in SQLite)
5. Agent's Procore skill uses the customer's token

### Steps
- Build OAuth callback route for per-tenant tokens
- Store tokens encrypted in admin DB (per connection)
- Inject token into agent's sandbox env at runtime
- Refresh token flow (already exists in Procore skill)

### Effort: ~1 day

---

## Implementation Priority

| Phase | What | Effort | When |
|-------|------|--------|------|
| **1** | Clerk Auth | 2-3 hrs | Before first customer |
| **2** | GCE Deployment | 4-6 hrs | Before first customer |
| **3** | Sandbox Isolation | 1-2 hrs | Before first customer |
| **4** | Production Hardening | 2-3 hrs | Before first customer |
| **5** | Per-Tenant Procore | 1 day | Before second customer |

**Total to ship: ~10-14 hours of work.**

---

## Quick Deploy Checklist

When ready to deploy, run through this:

- [ ] Sign up for Clerk, create app, get keys
- [ ] Create GCE VM, install deps
- [ ] Clone repo, build web + engine
- [ ] Set up Caddy + domain + HTTPS
- [ ] Configure systemd services
- [ ] Enable sandbox in engine config
- [ ] Run security hardening checklist
- [ ] Create first admin user in Clerk
- [ ] Test full flow: login → create agent → chat → skills work
- [ ] Invite first customer

/**
 * Marketplace — skill catalog and install token management.
 *
 * Skills are defined here as a catalog. Each skill has metadata, a readme,
 * and a source directory in packages/engine/skills/.
 *
 * Install flow:
 * 1. User sees skill in marketplace UI, copies install URL
 * 2. User pastes URL in chat with their agent
 * 3. Agent calls the install API with its marketplace token
 * 4. Server verifies token, returns skill files as JSON
 * 5. Agent writes files to workspace/skills/
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SKILLS_SOURCE = path.resolve(process.cwd(), '../../packages/engine/skills');

export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  vendor: string;
  version: string;
  tags: string[];
  connectionType?: string; // If skill needs a connection
  readme: string;
  installed?: boolean;
}

export interface SkillPackage {
  id: string;
  name: string;
  files: { path: string; content: string }[];
}

/**
 * Skill catalog — all available skills in the marketplace.
 */
const SKILL_CATALOG: Omit<MarketplaceSkill, 'installed'>[] = [
  {
    id: 'buildai-procore',
    name: 'Procore Integration',
    description: 'Full read/write access to Procore — RFIs, submittals, budgets, daily logs, punch items, change orders, drawings, meetings, and more.',
    category: 'PMIS',
    icon: '🏗️',
    vendor: 'BuildAI',
    version: '1.0.0',
    tags: ['procore', 'rfi', 'submittal', 'budget', 'construction'],
    connectionType: 'procore',
    readme: `# Procore Integration

Connect your Procore account to query and manage construction data directly through your AI assistant.

## What You Can Do
- **RFIs** — List, create, update, close RFIs across projects
- **Submittals** — Track submittal status and deadlines
- **Budgets** — View budget line items, track variances
- **Daily Logs** — Create and review daily construction logs
- **Punch Items** — Manage punch lists and assignments
- **Change Orders** — Track change order packages
- **Drawings & Documents** — Access project drawings and docs
- **Directory** — Look up team members and contacts

## Setup
Your admin will configure the Procore connection with OAuth credentials. Once connected, just ask your assistant about any project data.

## Example Questions
- "Show me all open RFIs on Terminal A"
- "Create an RFI about the HVAC routing conflict"
- "What's the budget variance on the renovation project?"
- "List overdue submittals across all projects"`,
  },
  {
    id: 'buildai-monitor',
    name: 'Project Monitor',
    description: 'Automated monitoring and alerts for project data — track RFI status changes, budget overruns, and more with daily digests.',
    category: 'Analytics',
    icon: '👁️',
    vendor: 'BuildAI',
    version: '1.0.0',
    tags: ['monitoring', 'alerts', 'digest', 'automation'],
    readme: `# Project Monitor

Set up automated watches on your project data. Get alerted when things change.

## What You Can Do
- **Watch RFIs** — Get notified when an RFI status changes or new RFIs are created
- **Watch Budgets** — Alert when budget lines exceed thresholds
- **Daily Digests** — Scheduled summary of all watched items
- **Custom Watches** — Monitor any project metric

## Setup
Just ask your assistant to start monitoring something:

## Example Requests
- "Watch this RFI and tell me when it changes"
- "Monitor the Terminal A budget for overruns"
- "Set up a daily digest at 9am"
- "Show me all my active watches"`,
  },
  {
    id: 'buildai-database',
    name: 'Database Query',
    description: 'Query your project database with natural language. The assistant writes SQL for you and returns structured results.',
    category: 'Analytics',
    icon: '📊',
    vendor: 'BuildAI',
    version: '1.0.0',
    tags: ['database', 'sql', 'analytics', 'reporting'],
    connectionType: 'database',
    readme: `# Database Query

Connect your project database and query it using natural language. Your assistant translates your questions into SQL.

## What You Can Do
- **Natural Language Queries** — Ask questions in plain English
- **Project Dashboards** — Get project overviews with key metrics
- **Custom Reports** — Generate ad-hoc reports on demand
- **Cross-Project Analysis** — Compare data across projects

## Safety
- Read-only access — cannot modify your database
- All queries are auto-limited to prevent runaway results
- 30-second timeout on all queries

## Example Questions
- "How many open RFIs do we have across all projects?"
- "Show me projects that are over budget"
- "Which vendors have expiring insurance?"
- "Compare RFI closure rates between projects"`,
  },
  {
    id: 'buildai-p6',
    name: 'Primavera P6',
    description: 'Connect to Oracle Primavera P6 for schedule management — activities, WBS, resources, baselines, and critical path analysis.',
    category: 'Scheduling',
    icon: '📅',
    vendor: 'BuildAI',
    version: '0.1.0',
    tags: ['p6', 'primavera', 'scheduling', 'oracle', 'critical-path'],
    connectionType: 'p6',
    readme: `# Primavera P6 Integration

Connect to Oracle Primavera P6 to manage schedules through your AI assistant.

## What You Can Do
- **Activities** — View and filter schedule activities
- **Critical Path** — Analyze critical path and float
- **Resources** — Check resource assignments and loading
- **Baselines** — Compare current vs baseline schedules
- **WBS** — Navigate work breakdown structure

## Coming Soon
This skill is in development. Contact your BuildAI admin for early access.`,
  },
  {
    id: 'buildai-unifier',
    name: 'Oracle Unifier',
    description: 'Connect to Oracle Unifier for cost management — business processes, cost sheets, cash flow, and project controls.',
    category: 'Cost Management',
    icon: '💰',
    vendor: 'BuildAI',
    version: '0.1.0',
    tags: ['unifier', 'oracle', 'cost', 'project-controls'],
    connectionType: 'unifier',
    readme: `# Oracle Unifier Integration

Connect to Oracle Unifier for cost management and project controls.

## What You Can Do
- **Cost Sheets** — View project cost breakdowns
- **Business Processes** — Track BPs and approvals
- **Cash Flow** — Forecast and actual cash flow analysis
- **Change Management** — Track cost changes and trends

## Coming Soon
This skill is in development. Contact your BuildAI admin for early access.`,
  },
  {
    id: 'buildai-documents',
    name: 'Document Analysis',
    description: 'Upload and analyze construction documents — specs, contracts, drawings. Extract key information and answer questions.',
    category: 'Documents',
    icon: '📄',
    vendor: 'BuildAI',
    version: '0.1.0',
    tags: ['documents', 'specs', 'contracts', 'analysis'],
    readme: `# Document Analysis

Upload construction documents and let your AI assistant extract information and answer questions.

## What You Can Do
- **Spec Review** — Extract requirements from specifications
- **Contract Analysis** — Find key terms, dates, obligations
- **Drawing References** — Cross-reference drawing callouts
- **Compliance Check** — Verify document completeness

## Coming Soon
This skill is in development. Contact your BuildAI admin for early access.`,
  },
  {
    id: 'buildai-reports',
    name: 'Report Generator',
    description: 'Generate formatted project reports — executive summaries, status reports, meeting minutes, and custom templates.',
    category: 'Communication',
    icon: '📋',
    vendor: 'BuildAI',
    version: '0.1.0',
    tags: ['reports', 'templates', 'executive-summary', 'status'],
    readme: `# Report Generator

Generate professional project reports from your data automatically.

## What You Can Do
- **Executive Summaries** — One-page project overview for leadership
- **Weekly Status** — Automated weekly status reports
- **Meeting Minutes** — Structured meeting notes and action items
- **Custom Templates** — Define your own report formats

## Coming Soon
This skill is in development. Contact your BuildAI admin for early access.`,
  },
  {
    id: 'buildai-compliance',
    name: 'Compliance Tracker',
    description: 'Track insurance certificates, permits, safety compliance, and regulatory requirements with automated expiry alerts.',
    category: 'Compliance',
    icon: '✅',
    vendor: 'BuildAI',
    version: '0.1.0',
    tags: ['compliance', 'insurance', 'permits', 'safety'],
    readme: `# Compliance Tracker

Monitor compliance requirements and get alerted before things expire.

## What You Can Do
- **Insurance Tracking** — Monitor certificate expiration dates
- **Permits** — Track permit status and renewals
- **Safety Compliance** — OSHA requirements and inspections
- **Automated Alerts** — Get notified before deadlines

## Coming Soon
This skill is in development. Contact your BuildAI admin for early access.`,
  },
];

/**
 * List all marketplace skills, optionally marking which are installed for an agent.
 */
export function listMarketplaceSkills(installedSkillIds?: string[]): MarketplaceSkill[] {
  return SKILL_CATALOG.map(skill => ({
    ...skill,
    installed: installedSkillIds?.some(id => id === skill.id || id.startsWith(skill.id)) ?? false,
  }));
}

/**
 * Get a single marketplace skill by ID.
 */
export function getMarketplaceSkill(id: string): MarketplaceSkill | undefined {
  return SKILL_CATALOG.find(s => s.id === id);
}

/**
 * Get all unique categories.
 */
export function getCategories(): string[] {
  return [...new Set(SKILL_CATALOG.map(s => s.category))];
}

/**
 * Generate a marketplace install token for an agent.
 * Token format: base64({ skillId, agentId, exp }) + "." + hmac signature
 */
export function generateInstallToken(skillId: string, agentId: string): string {
  const payload = {
    skillId,
    agentId,
    exp: Date.now() + 60 * 60 * 1000, // 1 hour expiry
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getMarketplaceSecret())
    .update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

/**
 * Verify and decode an install token.
 * Returns the payload if valid, null if invalid/expired.
 */
export function verifyInstallToken(token: string): { skillId: string; agentId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getMarketplaceSecret())
    .update(payloadB64).digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return { skillId: payload.skillId, agentId: payload.agentId };
  } catch {
    return null;
  }
}

/**
 * Package a skill's files for download.
 * Returns all files in the skill directory as { path, content } pairs.
 */
export function packageSkill(skillId: string): SkillPackage | null {
  const skill = getMarketplaceSkill(skillId);
  if (!skill) return null;

  const skillDir = path.join(SKILLS_SOURCE, skillId);
  if (!fs.existsSync(skillDir)) return null;

  const files: { path: string; content: string }[] = [];

  function readDir(dir: string, prefix: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue; // Skip .env, .git, etc.
      const fullPath = path.join(dir, entry.name);
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        readDir(fullPath, relPath);
      } else {
        files.push({
          path: relPath,
          content: fs.readFileSync(fullPath, 'utf-8'),
        });
      }
    }
  }

  readDir(skillDir, '');

  return {
    id: skillId,
    name: skill.name,
    files,
  };
}

/**
 * Get the marketplace signing secret.
 */
function getMarketplaceSecret(): string {
  return process.env.BUILDAI_MARKETPLACE_SECRET || process.env.BUILDAI_ENCRYPTION_KEY || 'buildai-marketplace-default-key';
}

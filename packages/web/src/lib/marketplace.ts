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

function resolveSkillsSource(): string {
  const candidates = [
    path.resolve(process.cwd(), '../../packages/engine/skills'),
    path.resolve(process.cwd(), '../engine/skills'),
    path.resolve(process.cwd(), 'packages/engine/skills'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0]!;
}

const SKILLS_SOURCE = resolveSkillsSource();

function readBundledSkillReadme(skillId: string): string {
  const skillMdPath = path.join(SKILLS_SOURCE, skillId, 'SKILL.md');
  return fs.readFileSync(skillMdPath, 'utf-8');
}

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
    vendor: 'Mira',
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
    vendor: 'Mira',
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
    vendor: 'Mira',
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
    vendor: 'Mira',
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
This skill is in development. Contact your Mira admin for early access.`,
  },
  {
    id: 'buildai-unifier',
    name: 'Oracle Unifier',
    description: 'Connect to Oracle Unifier for cost management — business processes, cost sheets, cash flow, and project controls.',
    category: 'Cost Management',
    icon: '💰',
    vendor: 'Mira',
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
This skill is in development. Contact your Mira admin for early access.`,
  },
  // Old placeholders removed — replaced by real skills below
  {
    id: 'buildai-pdf-extract',
    name: 'PDF Extractor',
    description: 'Extract text, tables, and structured content from any PDF — specifications, submittals, contracts, RFIs, inspection reports, and vendor quotes.',
    category: 'Documents',
    icon: '📄',
    vendor: 'Mira',
    version: '1.0.0',
    tags: ['pdf', 'extract', 'text', 'tables', 'specifications', 'submittals'],
    readme: `# PDF Extractor

Extract text and tables from PDF documents for analysis.

## What You Can Do
- **Text Extraction** — Pull all text from multi-page PDFs
- **Table Extraction** — Extract tables with headers and rows
- **Page Selection** — Process specific pages or ranges
- **Multiple Formats** — Output as plain text or structured JSON

## Construction Use Cases
- Parse specification sections to find requirements
- Extract submittal data sheets and compare against specs
- Pull key terms from contracts and subcontracts
- Read RFI attachments and drawing notes
- Extract data from inspection reports

## Example
Upload a PDF and ask: "Extract the tables from this specification document"`,
  },
  {
    id: 'buildai-doc-generator',
    name: 'Report Generator',
    description: 'Generate professional PDF reports — executive summaries, RFI reports, daily construction logs, meeting minutes, and project status updates.',
    category: 'Communication',
    icon: '📋',
    vendor: 'Mira',
    version: '1.0.0',
    tags: ['pdf', 'report', 'executive-summary', 'meeting-minutes', 'daily-log'],
    readme: `# Report Generator

Generate formatted PDF reports from your project data.

## Report Types
- **Executive Summary** — One-page project overview with budget, RFI status, and key risks
- **RFI Report** — RFI status summary with details and aging
- **Daily Report** — Construction daily log with weather, crew, work completed
- **Meeting Minutes** — Structured notes with action items, owners, and due dates
- **Status Report** — Weekly/monthly project status with metrics

## How It Works
1. Ask your assistant to generate a report
2. It pulls live data from your connected sources (Procore, database)
3. Formats it into a professional PDF
4. Returns the file for download

## Example
"Generate an executive summary for Terminal A with current budget and RFI data"`,
  },
  {
    id: 'buildai-invoice-parser',
    name: 'Invoice Parser',
    description: 'Extract structured data from construction invoices — vendor name, amounts, line items, dates, PO numbers. Parse PDF invoices for budget tracking and payment processing.',
    category: 'Cost Management',
    icon: '🧾',
    vendor: 'Mira',
    version: '1.0.0',
    tags: ['invoice', 'payment', 'vendor', 'cost', 'budget', 'billing'],
    readme: `# Invoice Parser

Parse construction invoices into structured data.

## What You Can Do
- **Vendor Extraction** — Identify vendor/contractor name
- **Amount Parsing** — Extract subtotal, tax, and total amounts
- **Line Items** — Parse individual line items with quantities and prices
- **Reference Numbers** — Extract invoice numbers, PO numbers, dates
- **Batch Processing** — Process multiple invoices at once

## Construction Use Cases
- Parse subcontractor payment applications
- Cross-reference invoiced amounts against budget line items
- Track payment schedules and due dates
- Audit invoice amounts against approved change orders
- Build payment history for vendor management

## Example
Upload an invoice and ask: "Parse this invoice and compare the total against our budget"`,
  },
  {
    id: 'buildai-contract-parser',
    name: 'Contract Parser',
    description: 'Parse construction contracts to extract key terms — parties, dates, scope, payment terms, insurance requirements, liquidated damages, and obligations.',
    category: 'Documents',
    icon: '📜',
    vendor: 'Mira',
    version: '1.0.0',
    tags: ['contract', 'legal', 'terms', 'insurance', 'obligations', 'subcontract'],
    readme: `# Contract Parser

Extract key terms and obligations from construction contracts.

## What You Can Do
- **Party Identification** — Extract owner, contractor, sub names
- **Financial Terms** — Contract value, retainage, payment schedule
- **Key Dates** — Execution, start, completion, milestones
- **Insurance Requirements** — Required coverage types and limits
- **Clause Detection** — Identify indemnification, termination, force majeure, bonds
- **Risk Flags** — Highlight liquidated damages, warranty terms

## Construction Use Cases
- Review subcontract terms before execution
- Extract insurance requirements for compliance tracking
- Compare terms across multiple subcontracts
- Identify onerous clauses or missing provisions
- Build a contract terms database

## Example
Upload a contract and ask: "What are the insurance requirements and payment terms?"`,
  },
  {
    id: 'buildai-schedule-import',
    name: 'Schedule Import',
    description: 'Import project schedules from CSV, Excel, or PDF exports — P6, MS Project, Asta Powerproject. Extract activities, durations, dependencies, and milestones.',
    category: 'Scheduling',
    icon: '📅',
    vendor: 'Mira',
    version: '1.0.0',
    tags: ['schedule', 'p6', 'primavera', 'ms-project', 'activities', 'milestones'],
    readme: `# Schedule Import

Import and analyze project schedule data from various formats.

## Supported Formats
- **CSV** — P6 exports, MS Project CSV, generic schedule CSV
- **Excel** — .xlsx schedule files
- **PDF** — Tabular schedule PDFs (best effort)

## What You Can Do
- **Activity Import** — Parse activities with start, finish, duration
- **Milestone Tracking** — Identify key milestones
- **Dependency Mapping** — Extract predecessor relationships
- **Progress Tracking** — Read percent complete values
- **Summary Statistics** — Total activities, date range, average completion

## Construction Use Cases
- Import P6 schedule exports for AI-powered analysis
- Compare baseline vs current schedule
- Identify slipping activities and critical path changes
- Track milestone completion rates
- Generate schedule narratives from data

## Example
Upload a P6 CSV export and ask: "What activities are behind schedule?"`,
  },
  {
    id: 'buildai-safety-checker',
    name: 'Safety Compliance',
    description: 'Check construction project safety compliance — OSHA 1926 requirements, safety plan review, incident tracking, toolbox talks, and inspection checklists.',
    category: 'Compliance',
    icon: '🦺',
    vendor: 'Mira',
    version: '0.1.0',
    tags: ['safety', 'osha', 'compliance', 'inspection', 'incidents'],
    readme: `# Safety Compliance

Monitor and verify construction safety compliance.

## Planned Capabilities
- **OSHA Compliance** — Check against OSHA 1926 requirements
- **Safety Plan Review** — Analyze site safety plans for completeness
- **Incident Tracking** — Log and track safety incidents
- **Toolbox Talks** — Schedule and track safety briefings
- **Inspection Checklists** — Generate safety inspection forms

## Coming Soon
This skill is in development. Contact your Mira admin for early access.`,
  },
  {
    id: 'buildai-email',
    name: 'Email Send',
    description: 'Send emails with attachments — deliver reports, exports, notifications, and summaries to users via email. Supports HTML formatting and file attachments.',
    category: 'Communication',
    icon: '📧',
    vendor: 'Mira',
    version: '1.0.0',
    tags: ['email', 'smtp', 'notification', 'report', 'attachment'],
    readme: `# Email Send

Send emails directly from your AI assistant — reports, exports, notifications, and more.

## What You Can Do
- **Send Reports** — Email generated PDF reports to stakeholders
- **Deliver Exports** — Send Excel exports as attachments
- **Notifications** — Send project updates and alerts
- **HTML Emails** — Rich formatting with tables, headers, and styling

## Setup
Admin configures SMTP credentials (Gmail App Password) as environment variables. No user setup needed.

## Example Requests
- "Email the RFI report to sarah@company.com"
- "Send the budget export to the project team"
- "Notify the PM about the overdue submittals"`,
  },
  {
    id: 'buildai-excel-export',
    name: 'Excel Export',
    description: 'Export data to formatted Excel (.xlsx) files — RFIs, budgets, schedules, or any tabular data with headers, auto-column-widths, filters, and multiple sheets.',
    category: 'Analytics',
    icon: '📊',
    vendor: 'Mira',
    version: '1.0.0',
    tags: ['excel', 'xlsx', 'export', 'spreadsheet', 'report', 'data'],
    readme: `# Excel Export

Export any project data to professionally formatted Excel spreadsheets.

## What You Can Do
- **Data Export** — Convert any query results or project data to .xlsx
- **Formatted Output** — Headers, auto-column-widths, alternating rows, filters
- **Multiple Sheets** — Combine different data sets in one workbook
- **Title Pages** — Add report titles and metadata

## Construction Use Cases
- Export RFI list with status, dates, and assignees
- Budget line items with variance analysis
- Schedule activities with progress tracking
- Vendor list with insurance expiry dates
- Punch list items by area and trade

## Workflow
1. Ask your assistant to export data
2. It generates a formatted .xlsx file
3. Download directly or have it emailed to you

## Example Requests
- "Export all open RFIs to Excel"
- "Create a budget spreadsheet for Terminal A"
- "Export the punch list and email it to me"`,
  },
  {
    id: 'buildai-ppt-generator',
    name: 'PPT Generator',
    description: 'Generate PowerPoint (.pptx) decks from outlines, project updates, meeting notes, and uploaded document context. Outputs ready-to-download presentation files.',
    category: 'Communication',
    icon: '📽️',
    vendor: 'Mira',
    version: '1.0.0',
    tags: ['ppt', 'pptx', 'presentation', 'slides', 'deck', 'reporting'],
    readme: `# PPT Generator

Generate polished PowerPoint decks directly from chat.

## What You Can Do
- **Project Update Decks** — Weekly/monthly status presentations
- **Executive Briefs** — Leadership-ready summaries
- **Meeting Decks** — Agendas, decisions, and action items
- **Investor / Client Decks** — Narrative + metrics + roadmap
- **Image Slides** — Include generated or uploaded images in slides

## Output
- Produces .pptx files in agent artifacts
- Files appear in Mira Artifacts UI for download

## Example Requests
- "Create a 10-slide project status deck for Terminal A"
- "Turn these meeting notes into a concise executive deck"
- "Generate an investor update presentation with next-quarter roadmap"`,
  },
  {
    id: 'buildai-photo-log',
    name: 'Photo Log',
    description: 'Process construction site photos — EXIF metadata extraction, auto-tagging by location and trade, daily photo logs, and visual progress reports.',
    category: 'Documents',
    icon: '📸',
    vendor: 'Mira',
    version: '0.1.0',
    tags: ['photos', 'site', 'progress', 'documentation', 'visual'],
    readme: `# Photo Log

Organize and process construction site photography.

## Planned Capabilities
- **EXIF Extraction** — Pull date, GPS, camera data from photos
- **Auto-Tagging** — Categorize by trade, location, phase
- **Daily Photo Log** — Organize photos into dated reports
- **Progress Tracking** — Compare photos over time
- **Drawing Markup** — Link photos to drawing locations

## Coming Soon
This skill is in development. Contact your Mira admin for early access.`,
  },
  {
    id: 'pdf',
    name: 'PDF',
    description: 'Read, inspect, and work with PDF documents using the upstream Anthropic PDF skill.',
    category: 'Documents',
    icon: '📄',
    vendor: 'Anthropic',
    version: 'main',
    tags: ['pdf', 'documents', 'anthropic'],
    readme: readBundledSkillReadme('pdf'),
  },
  {
    id: 'docx',
    name: 'DOCX',
    description: 'Create and edit Word documents with the upstream Anthropic DOCX skill.',
    category: 'Documents',
    icon: '📝',
    vendor: 'Anthropic',
    version: 'main',
    tags: ['docx', 'word', 'documents', 'anthropic'],
    readme: readBundledSkillReadme('docx'),
  },
  {
    id: 'doc-coauthoring',
    name: 'Doc Coauthoring',
    description: 'Collaborate on document drafting and revision workflows with the upstream Anthropic doc-coauthoring skill.',
    category: 'Communication',
    icon: '✍️',
    vendor: 'Anthropic',
    version: 'main',
    tags: ['documents', 'coauthoring', 'drafting', 'anthropic'],
    readme: readBundledSkillReadme('doc-coauthoring'),
  },
  {
    id: 'xlsx',
    name: 'XLSX',
    description: 'Generate and manipulate spreadsheet workbooks with the upstream Anthropic XLSX skill.',
    category: 'Analytics',
    icon: '📊',
    vendor: 'Anthropic',
    version: 'main',
    tags: ['xlsx', 'excel', 'spreadsheet', 'anthropic'],
    readme: readBundledSkillReadme('xlsx'),
  },
  {
    id: 'pptx',
    name: 'PPTX',
    description: 'Create and edit presentation decks with the upstream Anthropic PPTX skill.',
    category: 'Communication',
    icon: '📽️',
    vendor: 'Anthropic',
    version: 'main',
    tags: ['pptx', 'presentation', 'slides', 'anthropic'],
    readme: readBundledSkillReadme('pptx'),
  },
  {
    id: 'skill-creator',
    name: 'Skill Creator',
    description: 'Create, improve, evaluate, and package skills with the upstream Anthropic skill-creator workflow.',
    category: 'Developer Tools',
    icon: '🛠️',
    vendor: 'Anthropic',
    version: 'main',
    tags: ['skills', 'evaluation', 'benchmarking', 'anthropic'],
    readme: readBundledSkillReadme('skill-creator'),
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
  const secret = process.env.BUILDAI_MARKETPLACE_SECRET || process.env.BUILDAI_ENCRYPTION_KEY;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'test') return 'buildai-test-marketplace-secret';
  throw new Error('BUILDAI_MARKETPLACE_SECRET (or BUILDAI_ENCRYPTION_KEY) must be set');
}

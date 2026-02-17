/**
 * LLM service using Google Gemini 2.0 Flash.
 * Handles the two-step agent loop:
 *   1. User question → Gemini generates SQL (or a direct answer)
 *   2. SQL results fed back → Gemini generates a natural language response
 */

import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { getDatabaseSchema, query } from './db';
import { hasTokens, procoreApi, resolveEndpointPath, ENDPOINT_MAP } from './procore';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// In-memory conversation store (good enough for demo)
const conversationStore = new Map<string, Content[]>();

function buildSystemPrompt(): string {
  const procoreAvailable = hasTokens();
  const procoreSection = procoreAvailable
    ? `
## Procore Integration (LIVE — sandbox.procore.com)

You also have access to **Procore**, a cloud-based construction project management system.
When the user asks about Procore data (or you need real-time project info from Procore), generate a Procore API call.

Wrap the call in a code block tagged \`\`\`procore ... \`\`\`:

\`\`\`procore
{ "endpoint": "projects" }
\`\`\`

Or with project-scoped data:

\`\`\`procore
{ "endpoint": "rfis", "projectId": 12345 }
\`\`\`

### Available Procore endpoints:
${Object.entries(ENDPOINT_MAP).map(([key, val]) => `- **${key}** — ${val.needsProject ? 'requires projectId' : 'no projectId needed'}`).join('\n')}

### When to use Procore vs PostgreSQL:
- **PostgreSQL** = your internal BuildAI database (historical data, agents, configs)
- **Procore** = live project management data (real-time RFIs, submittals, budgets, daily logs from Procore)
- If the user says "Procore" or asks about live/external project data, use Procore
- If the user asks about internal data or doesn't specify, default to PostgreSQL
- You can combine both in one answer if helpful
`
    : `
## Procore Integration (NOT CONNECTED)
Procore is not yet connected. If the user asks about Procore data, let them know they need to connect
Procore first via the Admin → Connections page.
`;

  return `You are **BuildAI**, an expert construction project management assistant.
You have access to a PostgreSQL database with real project data. Your job is to help construction PMs
get instant answers about their projects, budgets, RFIs, submittals, and more.

${getDatabaseSchema()}
${procoreSection}

## How you work

When the user asks a question that requires data:
1. Generate a SQL query to answer it (for PostgreSQL data).
2. Wrap the SQL in a code block tagged \`\`\`sql ... \`\`\`
3. You will receive the query results, then provide a natural-language answer.

For Procore data:
1. Generate a Procore API call as JSON.
2. Wrap it in a code block tagged \`\`\`procore ... \`\`\`
3. You will receive the API results, then provide a natural-language answer.

When the user asks a general question (greetings, construction advice, etc.), answer directly without SQL or API calls.

## Onboarding (First-time Users)
When a user first interacts (their first message, or they say "hi/hello/get started" or ask for a scan):
1. Greet them warmly and briefly
2. Run a quick system scan — query the database for active projects with key metrics
3. Present a **Project Health Summary** showing:
   - Active projects with key stats
   - 🔴 Critical items (overdue RFIs, expiring insurance, budget overruns)
   - 🟡 Warnings (items approaching due dates)
   - 🟢 What's on track
4. Ask: "Which project would you like to dive into?"

This makes the user feel the system is ALIVE and already working for them.

## Proactive Behavior
- When showing project data, ALWAYS check for red flags and mention them
- If overdue RFIs exist: "⚠️ I notice X critical RFIs are overdue — want details?"
- If insurance is expiring soon, flag it
- If budget variance is negative, highlight the overrun
- Be the assistant who catches things the PM might miss

## Rules
- ONLY generate SELECT queries. Never INSERT, UPDATE, DELETE, DROP, ALTER, or any DDL/DML.
- Prefer the pre-built views (v_project_dashboard, v_overdue_rfis, v_expiring_insurance, v_project_budget_summary) when they match.
- Keep SQL concise. Use LIMIT when appropriate (default to 20 rows max unless asked for more).
- Format currency values with $ and commas in your responses.
- Use markdown tables, bullet lists, and bold text to make responses scannable.
- If a query returns no results, say so clearly and suggest alternatives.
- When discussing budgets, always mention variance and flag overruns (negative variance).
- Be proactive: if you notice overdue RFIs, expiring insurance, or budget overruns in the data, mention them.
- Be concise but thorough. This is for busy project managers.
- Today's date for reference: use CURRENT_DATE in SQL.
`;
}

const SYSTEM_PROMPT = buildSystemPrompt();

/**
 * Extract a Procore API call from a Gemini response (looks for ```procore ... ``` blocks).
 */
function extractProcoreCall(text: string): { endpoint: string; projectId?: number; params?: Record<string, string> } | null {
  const match = text.match(/```procore\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

/**
 * Execute a Procore API call and return formatted results.
 */
async function executeProcoreCall(call: { endpoint: string; projectId?: number; params?: Record<string, string> }): Promise<string> {
  try {
    const path = resolveEndpointPath(call.endpoint, call.projectId);
    const data = await procoreApi(path, { params: call.params });
    if (Array.isArray(data)) {
      return `Procore API returned ${data.length} results:\n\n${JSON.stringify(data.slice(0, 20), null, 2)}${data.length > 20 ? `\n\n... and ${data.length - 20} more items` : ''}`;
    }
    return `Procore API response:\n\n${JSON.stringify(data, null, 2)}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Procore API Error: ${msg}`;
  }
}

/**
 * Extract SQL from a Gemini response (looks for ```sql ... ``` blocks).
 */
function extractSQL(text: string): string | null {
  const match = text.match(/```sql\s*([\s\S]*?)```/);
  if (!match) return null;
  
  const sql = match[1].trim();
  
  // Safety: reject anything that's not a SELECT / WITH
  const firstKeyword = sql.split(/\s+/)[0]?.toUpperCase();
  if (firstKeyword !== 'SELECT' && firstKeyword !== 'WITH') {
    return null;
  }
  
  // Extra safety: reject dangerous keywords
  const dangerous = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC)\b/i;
  if (dangerous.test(sql)) {
    return null;
  }
  
  return sql;
}

/**
 * Format query results as a readable string for the LLM.
 */
function formatResultsForLLM(rows: Record<string, unknown>[], rowCount: number | null): string {
  if (!rows || rows.length === 0) {
    return 'Query returned 0 rows (no matching data found).';
  }
  
  const columns = Object.keys(rows[0]);
  const header = columns.join(' | ');
  const separator = columns.map(() => '---').join(' | ');
  const dataRows = rows.map(row => 
    columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return 'NULL';
      if (val instanceof Date) return val.toISOString().split('T')[0];
      return String(val);
    }).join(' | ')
  );
  
  return `Query returned ${rowCount ?? rows.length} rows:\n\n${header}\n${separator}\n${dataRows.join('\n')}`;
}

export interface AgentResponse {
  response: string;
  sqlExecuted?: string;
  rowCount?: number;
}

/**
 * Main agent function: process a user message through the Gemini agent loop.
 */
export async function chat(sessionId: string, userMessage: string): Promise<AgentResponse> {
  // Get or create conversation history
  let history = conversationStore.get(sessionId) || [];
  
  // Add user message
  history.push({ role: 'user', parts: [{ text: userMessage }] });
  
  // Step 1: Send to Gemini
  const chatSession = model.startChat({
    history: history.slice(0, -1), // all except the latest message
    systemInstruction: {
      role: 'user',
      parts: [{ text: SYSTEM_PROMPT }],
    },
  });
  
  const result1 = await chatSession.sendMessage(userMessage);
  const response1 = result1.response.text();
  
  // Check if Gemini generated SQL or a Procore call
  const sql = extractSQL(response1);
  const procoreCall = extractProcoreCall(response1);
  
  if (!sql && !procoreCall) {
    // No data call — it's a direct answer
    history.push({ role: 'model', parts: [{ text: response1 }] });
    conversationStore.set(sessionId, trimHistory(history));
    return { response: response1 };
  }

  // Add the generation step to history
  history.push({ role: 'model', parts: [{ text: response1 }] });

  let queryResults: string;
  let rowCount: number | null = null;
  let executedSQL: string | undefined;
  
  if (procoreCall) {
    // Step 2a: Execute Procore API call
    queryResults = await executeProcoreCall(procoreCall);
  } else if (sql) {
    // Step 2b: Execute SQL query
    executedSQL = sql;
    try {
      const dbResult = await query(sql);
      rowCount = dbResult.rowCount;
      queryResults = formatResultsForLLM(dbResult.rows, dbResult.rowCount);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      queryResults = `SQL Error: ${errMsg}\n\nPlease fix the query and try again, or answer based on what you know.`;
    }
  } else {
    queryResults = 'No data retrieved.';
  }
  
  // Step 3: Feed results back to Gemini for natural language response
  const source = procoreCall ? 'Procore API' : 'database';
  const followUp = `Here are the ${source} results for your query:\n\n${queryResults}\n\nNow please provide a clear, well-formatted natural language answer to the user's question based on these results. Use markdown formatting. Do NOT include the raw SQL or API call JSON in your response.`;
  
  history.push({ role: 'user', parts: [{ text: followUp }] });
  
  const result2 = await chatSession.sendMessage(followUp);
  const response2 = result2.response.text();
  
  history.push({ role: 'model', parts: [{ text: response2 }] });
  
  conversationStore.set(sessionId, trimHistory(history));
  
  return {
    response: response2,
    sqlExecuted: executedSQL,
    rowCount: rowCount ?? undefined,
  };
}

/**
 * Keep conversation history manageable (last 20 turns).
 */
function trimHistory(history: Content[]): Content[] {
  const MAX_TURNS = 40; // 20 exchanges = 40 messages
  if (history.length > MAX_TURNS) {
    return history.slice(history.length - MAX_TURNS);
  }
  return history;
}

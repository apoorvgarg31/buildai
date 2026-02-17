/**
 * Database utility for BuildAI demo.
 * Connects to the local PostgreSQL `buildai_demo` database.
 */

import { Pool, QueryResult } from 'pg';

const pool = new Pool({
  // Use Unix socket for peer auth (no password needed)
  host: process.env.DB_HOST || '/var/run/postgresql',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'buildai_demo',
  user: process.env.DB_USER || 'apoorvgarg',
  password: process.env.DB_PASSWORD || undefined,
  max: 5,
  idleTimeoutMillis: 30000,
});

/**
 * Execute a SQL query and return the result rows.
 * For the demo, we accept AI-generated SQL directly.
 * In production you'd want a read-only role + query allow-listing.
 */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number | null }> {
  const result: QueryResult<T> = await pool.query<T>(sql, params);
  return { rows: result.rows, rowCount: result.rowCount };
}

/**
 * Get the full database schema description for embedding in the LLM system prompt.
 * This is a static string so we don't burn a DB round-trip every request.
 */
export function getDatabaseSchema(): string {
  return `
DATABASE SCHEMA — PostgreSQL database "buildai_demo"
=====================================================

TABLE: projects
  id              SERIAL PRIMARY KEY
  name            VARCHAR(200) NOT NULL
  address         VARCHAR(300)
  city            VARCHAR(100)
  state           VARCHAR(50)
  status          VARCHAR(20)  CHECK (status IN ('active','completed','on_hold'))
  contract_sum    NUMERIC(14,2)
  start_date      DATE
  projected_completion DATE
  actual_completion    DATE
  owner_name      VARCHAR(200)
  architect       VARCHAR(200)
  general_contractor VARCHAR(200)
  project_type    VARCHAR(30)  CHECK (project_type IN ('commercial','residential','infrastructure','mixed_use','healthcare'))

TABLE: rfis
  id              SERIAL PRIMARY KEY
  project_id      INTEGER → projects(id)
  number          VARCHAR(20) NOT NULL
  subject         VARCHAR(300)
  status          VARCHAR(10)  CHECK (status IN ('open','closed','void'))
  priority        VARCHAR(10)  CHECK (priority IN ('normal','urgent','critical'))
  assigned_to     VARCHAR(150)
  created_by      VARCHAR(150)
  created_date    DATE
  due_date        DATE
  closed_date     DATE
  days_open       INTEGER
  description     TEXT
  response        TEXT

TABLE: submittals
  id              SERIAL PRIMARY KEY
  project_id      INTEGER → projects(id)
  number          VARCHAR(30) NOT NULL
  title           VARCHAR(300)
  spec_section    VARCHAR(20)
  status          VARCHAR(15)  CHECK (status IN ('pending','approved','rejected','resubmit'))
  submitted_by    VARCHAR(150)
  reviewer        VARCHAR(150)
  submitted_date  DATE
  due_date        DATE
  approved_date   DATE

TABLE: budget_line_items
  id              SERIAL PRIMARY KEY
  project_id      INTEGER → projects(id)
  cost_code       VARCHAR(20)
  description     VARCHAR(200)
  original_budget NUMERIC(12,2)
  approved_changes NUMERIC(12,2)
  revised_budget  NUMERIC(12,2)
  committed_costs NUMERIC(12,2)
  actual_costs    NUMERIC(12,2)
  projected_final NUMERIC(12,2)
  variance        NUMERIC(12,2)
  variance_percent NUMERIC(6,2)

TABLE: change_orders
  id              SERIAL PRIMARY KEY
  project_id      INTEGER → projects(id)
  number          VARCHAR(20) NOT NULL
  title           VARCHAR(300)
  description     TEXT
  amount          NUMERIC(12,2)
  status          VARCHAR(15)  CHECK (status IN ('pending','approved','rejected'))
  submitted_date  DATE
  approved_date   DATE
  reason          VARCHAR(30)  CHECK (reason IN ('owner_change','design_error','unforeseen_condition','value_engineering','code_compliance','schedule_acceleration'))

TABLE: daily_logs
  id              SERIAL PRIMARY KEY
  project_id      INTEGER → projects(id)
  log_date        DATE
  weather         VARCHAR(50)
  temperature_high INTEGER
  temperature_low  INTEGER
  workforce_count  INTEGER
  superintendent   VARCHAR(150)
  notes           TEXT
  delays          TEXT
  safety_incidents INTEGER DEFAULT 0

TABLE: punch_list_items
  id              SERIAL PRIMARY KEY
  project_id      INTEGER → projects(id)
  location        VARCHAR(200)
  description     TEXT
  assigned_to     VARCHAR(150)
  status          VARCHAR(15)  CHECK (status IN ('open','in_progress','completed','verified'))
  priority        VARCHAR(10)  CHECK (priority IN ('low','medium','high','critical'))
  created_date    DATE
  due_date        DATE
  completed_date  DATE

TABLE: insurance_certs
  id              SERIAL PRIMARY KEY
  project_id      INTEGER → projects(id)
  vendor_name     VARCHAR(200)
  policy_type     VARCHAR(20)  CHECK (policy_type IN ('GL','WC','auto','umbrella','professional','builders_risk','pollution'))
  policy_number   VARCHAR(50)
  effective_date  DATE
  expiration_date DATE
  coverage_amount NUMERIC(14,2)
  certificate_holder VARCHAR(200)

TABLE: vendors
  id              SERIAL PRIMARY KEY
  project_id      INTEGER → projects(id)
  company_name    VARCHAR(200) NOT NULL
  trade           VARCHAR(100)
  contact_name    VARCHAR(150)
  email           VARCHAR(200)
  phone           VARCHAR(20)
  contract_amount NUMERIC(12,2)
  paid_to_date    NUMERIC(12,2)
  retainage_held  NUMERIC(12,2)

TABLE: pay_applications
  id              SERIAL PRIMARY KEY
  project_id      INTEGER → projects(id)
  number          INTEGER
  vendor_id       INTEGER → vendors(id)
  period_start    DATE
  period_end      DATE
  scheduled_value NUMERIC(12,2)
  work_completed_previous NUMERIC(12,2)
  work_completed_current  NUMERIC(12,2)
  materials_stored NUMERIC(12,2)
  total_completed  NUMERIC(12,2)
  retainage        NUMERIC(12,2)
  amount_due       NUMERIC(12,2)
  status           VARCHAR(15)  CHECK (status IN ('draft','submitted','approved','paid'))

------ PRE-BUILT VIEWS (use these for common queries) ------

VIEW: v_project_dashboard
  Columns: id, name, status, contract_sum, project_type, location, open_rfis, overdue_rfis,
           pending_submittals, pending_change_orders, pending_co_value, open_punch_items, expiring_certs
  — Best for: project overview / summary dashboards

VIEW: v_overdue_rfis
  Columns: id, number, project_name, subject, priority, assigned_to, created_date, due_date, days_overdue, description
  — Best for: listing overdue RFIs

VIEW: v_expiring_insurance
  Columns: id, project_name, vendor_name, policy_type, policy_number, expiration_date, days_until_expiration, coverage_amount
  — Best for: insurance compliance alerts

VIEW: v_project_budget_summary
  Columns: project_id, project_name, contract_sum, total_original_budget, total_approved_changes,
           total_revised_budget, total_committed, total_actual_costs, total_projected_final, total_variance, variance_percent
  — Best for: budget summaries and variance analysis

IMPORTANT:
- Today's date is available via CURRENT_DATE in SQL.
- All monetary values are in USD.
- Use the pre-built views when they match the user's question — they're optimized.
- Always JOIN through project_id to connect tables.
`.trim();
}

export default pool;

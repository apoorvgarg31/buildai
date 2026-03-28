import { test, expect, Page, APIRequestContext } from '@playwright/test';

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function deleteByButtonInCard(page: Page, headingText: string, buttonName: string) {
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: headingText, exact: true }) }).first();
  await expect(card).toBeVisible({ timeout: 30000 });
  await card.getByRole('button', { name: buttonName, exact: true }).click();
}

async function getMe(request: APIRequestContext) {
  const res = await request.get('/api/me');
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.describe.serial('user workflow coverage', () => {
  test('shows admin-configured connectors assigned to the current user agent', async ({ page, request }) => {
    const suffix = uniqueSuffix();
    const name = `Playwright User Connector ${suffix}`;

    const me = await getMe(request);
    const agentId = me.agentId as string;
    expect(agentId).toBeTruthy();

    const agentRes = await request.get(`/api/admin/agents/${agentId}`);
    expect(agentRes.ok()).toBeTruthy();
    const agent = await agentRes.json();
    const originalConnectionIds = Array.isArray(agent.connection_ids) ? [...agent.connection_ids] : [];

    const createConnection = await request.post('/api/admin/connections', {
      data: {
        name,
        type: 'database',
        authMode: 'shared',
        config: { host: 'localhost', port: '5432', dbName: 'mira_demo' },
        secrets: { username: 'demo_user', password: 'demo_password' },
      },
    });
    expect(createConnection.ok()).toBeTruthy();
    const connection = await createConnection.json();

    try {
      const updateAgent = await request.put(`/api/admin/agents/${agentId}`, {
        data: { connectionIds: [...originalConnectionIds, connection.id] },
      });
      expect(updateAgent.ok()).toBeTruthy();

      await page.goto('/connectors', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Connectors', exact: true })).toBeVisible();
      await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 30000 });
      await expect(page.getByText('Configured by your admin and ready for shared enterprise use.')).toBeVisible();
    } finally {
      await request.put(`/api/admin/agents/${agentId}`, { data: { connectionIds: originalConnectionIds } });
      await request.delete(`/api/admin/connections/${connection.id}`);
    }
  });

  test('installs, removes, and reinstalls a marketplace skill', async ({ page }) => {
    await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Marketplace', exact: true })).toBeVisible();

    const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Project Monitor', exact: true }) }).first();
    await expect(card).toBeVisible({ timeout: 30000 });

    const installButton = card.getByRole('button', { name: 'Install', exact: true });
    const removeButton = card.getByRole('button', { name: 'Remove', exact: true });

    if (await removeButton.count()) {
      await removeButton.click();
      await expect(installButton).toBeVisible({ timeout: 30000 });
    }

    await installButton.click();
    await expect(removeButton).toBeVisible({ timeout: 30000 });

    await removeButton.click();
    await expect(installButton).toBeVisible({ timeout: 30000 });

    await installButton.click();
    await expect(removeButton).toBeVisible({ timeout: 30000 });
  });

  test('persists user settings after refresh', async ({ page }) => {
    const nextBriefTime = '07:45';
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Workspace settings', exact: true })).toBeVisible();

    const originalStyle = await page.getByLabel('Response style').inputValue();
    const originalAlert = await page.getByLabel('Alert level').inputValue();
    const originalTime = await page.getByLabel('Daily brief time').inputValue();
    const originalProactive = await page.getByLabel('Proactive updates').isChecked();

    await page.getByLabel('Response style').selectOption('detailed');
    await page.getByLabel('Alert level').selectOption('all');
    await page.getByLabel('Daily brief time').fill(nextBriefTime);
    if (!originalProactive) {
      await page.getByLabel('Proactive updates').check();
    }

    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await expect(page.getByText('Preferences saved for future Mira sessions.', { exact: true })).toBeVisible({ timeout: 30000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Response style')).toHaveValue('detailed');
    await expect(page.getByLabel('Alert level')).toHaveValue('all');
    await expect(page.getByLabel('Daily brief time')).toHaveValue(nextBriefTime);
    await expect(page.getByLabel('Proactive updates')).toHaveJSProperty('checked', true);

    await page.getByLabel('Response style').selectOption(originalStyle);
    await page.getByLabel('Alert level').selectOption(originalAlert);
    await page.getByLabel('Daily brief time').fill(originalTime);
    if (originalProactive !== (await page.getByLabel('Proactive updates').isChecked())) {
      await page.getByLabel('Proactive updates').click();
    }
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await expect(page.getByText('Preferences saved for future Mira sessions.', { exact: true })).toBeVisible({ timeout: 30000 });
  });

  test('adds and removes a watchlist item', async ({ page }) => {
    const suffix = uniqueSuffix();
    const entityId = `RFI-${suffix}`;
    const label = `Playwright Watch ${suffix}`;

    await page.goto('/watchlist', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Watchlist', exact: true })).toBeVisible();

    const inputs = page.locator('input');
    await inputs.nth(2).fill(entityId);
    await inputs.nth(3).fill(label);
    await page.getByRole('button', { name: 'Add item', exact: true }).click();

    await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 30000 });
    const card = page.locator('section').filter({ hasText: label }).first();
    await card.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByText(label, { exact: true })).toHaveCount(0, { timeout: 30000 });
  });

  test('creates, runs, pauses, resumes, and deletes a schedule', async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `Playwright Schedule ${suffix}`;
    const reminderText = `Digest ${suffix}`;
    const localTimeZone = 'Europe/London';
    let createdJobId = '';
    let jobs: Array<{ jobId: string; name: string; enabled: boolean; schedule: { kind: string; expr: string; tz: string }; recentRuns: Array<{ status: string; summary: string; ts: number }> }> = [];

    await page.route('**/api/schedule', async (route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jobs }),
        });
        return;
      }

      const body = JSON.parse(request.postData() || '{}');
      if (body.action === 'add') {
        createdJobId = `job-${suffix}`;
        jobs = [{
          jobId: createdJobId,
          name,
          enabled: true,
          schedule: { kind: 'cron', expr: '15 9 * * *', tz: body.tz || localTimeZone },
          recentRuns: [],
        }];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { jobId: createdJobId } }) });
        return;
      }

      if (body.action === 'run') {
        jobs = jobs.map((job) => job.jobId === body.jobId ? {
          ...job,
          recentRuns: [...job.recentRuns, { status: 'ok', summary: 'Triggered manually', ts: Date.now() }],
        } : job);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }

      if (body.action === 'update') {
        jobs = jobs.map((job) => job.jobId === body.jobId ? { ...job, enabled: !!body.enabled } : job);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }

      if (body.action === 'remove') {
        jobs = jobs.filter((job) => job.jobId !== body.jobId);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }

      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Unsupported action' }) });
    });

    await page.goto('/automation', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Automation', exact: true })).toBeVisible();
    await expect(page.getByText(`Runs daily in ${localTimeZone}`, { exact: true })).toBeVisible();

    const inputs = page.locator('input');
    await inputs.nth(0).fill(name);
    await inputs.nth(1).fill(reminderText);
    await inputs.nth(2).fill('9');
    await inputs.nth(3).fill('15');
    await page.getByRole('button', { name: 'Create daily schedule', exact: true }).click();

    const card = page.locator('section').filter({ hasText: name }).first();
    await expect(card).toBeVisible({ timeout: 30000 });

    await card.getByRole('button', { name: 'Run now', exact: true }).click();
    await expect(page.getByText('Triggered.', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(card.getByText('Triggered manually', { exact: false })).toBeVisible({ timeout: 30000 });

    await card.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByText('Schedule paused.', { exact: true })).toBeVisible({ timeout: 30000 });

    const resumedCard = page.locator('section').filter({ hasText: name }).first();
    await resumedCard.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.getByText('Schedule resumed.', { exact: true })).toBeVisible({ timeout: 30000 });

    const finalCard = page.locator('section').filter({ hasText: name }).first();
    await finalCard.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Schedule deleted.', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(name, { exact: true })).toHaveCount(0, { timeout: 30000 });
  });

  test('preserves chat history after refresh on the real chat route', async ({ page }) => {
    const scopedSessionKey = 'agent:user-e2e:webchat:user-demo:default';
    const messagesBySession = new Map<string, Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string }>>();
    messagesBySession.set(scopedSessionKey, []);

    let messageCounter = 0;
    let assistantCounter = 0;

    await page.route('**/api/chat', async (route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
        return;
      }

      const body = JSON.parse(request.postData() || '{}');
      const incomingMessage = String(body.message || '');
      const sessionKey = scopedSessionKey;
      const transcript = messagesBySession.get(sessionKey) || [];
      const userMessage = { id: `user-${++messageCounter}`, role: 'user' as const, content: incomingMessage, timestamp: new Date().toISOString() };
      const assistantText = `Persisted user reply ${++assistantCounter}: ${incomingMessage}`;
      const assistantMessage = { id: `assistant-${assistantCounter}`, role: 'assistant' as const, content: assistantText, timestamp: new Date().toISOString() };
      messagesBySession.set(sessionKey, [...transcript, userMessage, assistantMessage]);

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          `data: ${JSON.stringify({ type: 'delta', text: assistantText })}`,
          `data: ${JSON.stringify({ type: 'done', sessionId: sessionKey })}`,
          '',
        ].join('\n'),
      });
    });

    await page.route('**/api/chat/history**', async (route) => {
      const messages = messagesBySession.get(scopedSessionKey) || [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessionKey: scopedSessionKey, messages }),
      });
    });

    await page.goto('/chat', { waitUntil: 'domcontentloaded' });
    const input = page.getByPlaceholder('Ask Mira anything about your project');
    await expect(input).toBeVisible({ timeout: 30000 });

    await input.fill('First real-route question');
    await page.locator('button[title="Send message"]').click();
    await expect(page.getByText('First real-route question', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Persisted user reply 1: First real-route question', { exact: true })).toBeVisible({ timeout: 30000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('First real-route question', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Persisted user reply 1: First real-route question', { exact: true })).toBeVisible({ timeout: 30000 });
  });
});

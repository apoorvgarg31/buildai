import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkspaceOnboardingPage from '../src/components/WorkspaceOnboardingPage';

describe('WorkspaceOnboardingPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('provisions the workspace on demand and reports completion', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ agentId: 'agent-123' }),
    });
    const onProvisioned = vi.fn();

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    render(
      <WorkspaceOnboardingPage
        user={{ name: 'Apy', role: 'admin' }}
        onProvisioned={onProvisioned}
      />
    );

    expect(screen.getByText('Welcome to Mira command')).toBeDefined();
    expect(screen.getByText(/You are the first admin in this deployment\./)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Create my workspace' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/me', expect.objectContaining({ method: 'POST' }));
    });

    await waitFor(() => {
      expect(onProvisioned).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'agent-123' }));
    });
  });

  it('shows a recoverable error when provisioning fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Provision failed' }),
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    render(
      <WorkspaceOnboardingPage
        user={{ name: 'Casey', role: 'user' }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create my workspace' }));

    await waitFor(() => {
      expect(screen.getByText('We could not finish provisioning your workspace. Try again in a moment.')).toBeDefined();
    });
  });
});

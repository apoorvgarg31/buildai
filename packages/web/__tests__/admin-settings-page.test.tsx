import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminSettingsPage from '../src/components/AdminSettingsPage';

describe('AdminSettingsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads persisted settings and saves the shared llm configuration', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          companyName: 'Mira',
          defaultModel: 'google/gemini-2.0-flash',
          responseStyle: 'professional',
          maxQueriesPerDay: 500,
          maxAgents: 10,
          dataRetentionDays: 90,
          hasSharedApiKey: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          companyName: 'Mira Command',
          defaultModel: 'openai/gpt-4o',
          responseStyle: 'detailed',
          maxQueriesPerDay: 600,
          maxAgents: 20,
          dataRetentionDays: 120,
          hasSharedApiKey: true,
        }),
      });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Mira')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Mira Command' } });
    fireEvent.change(screen.getByLabelText('Default LLM model'), { target: { value: 'openai/gpt-4o' } });
    fireEvent.change(screen.getByLabelText('Shared LLM API key'), { target: { value: 'shared-admin-key' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith('/api/admin/settings', expect.objectContaining({ method: 'PUT' }));
    });
  });
});

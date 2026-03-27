import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminToolsPage from '../src/components/AdminToolsPage';

describe('AdminToolsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders inherited tool policy and updates toggles', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          {
            name: 'web_fetch',
            label: 'Web fetch',
            description: 'Read external pages without opening the browser runtime.',
            category: 'Research',
            enabled: true,
            defaultEnabled: true,
            risk: 'standard',
          },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: false }),
      });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    render(<AdminToolsPage />);

    await waitFor(() => {
      expect(screen.getByText('Web fetch')).toBeDefined();
    });

    expect(screen.getByText('Inherited by every agent unless the policy changes.')).toBeDefined();

    const toggle = screen.getByRole('checkbox', { name: 'Enable Web fetch' });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith('/api/admin/tools/web_fetch', expect.objectContaining({ method: 'PUT' }));
    });
  });
});

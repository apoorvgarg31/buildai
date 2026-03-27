import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MarketplacePage from '../src/components/MarketplacePage';

describe('MarketplacePage skill lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(async () => undefined) },
    } as unknown as Navigator);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('refreshes the installed state across remove and reinstall flows', async () => {
    let listState = 'installed';

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === '/api/me') {
        return { ok: true, json: async () => ({ agentId: 'agent-1' }) } as Response;
      }

      if (input === '/api/marketplace/skills' || input === '/api/marketplace/skills?agentId=agent-1') {
        const installed = listState === 'installed';
        return {
          ok: true,
          json: async () => ({
            skills: [
              {
                id: 'pdf',
                name: 'PDF',
                description: 'PDF tools',
                category: 'Documents',
                icon: '📄',
                vendor: 'Anthropic',
                version: '1.0.0',
                tags: ['pdf'],
                readme: '# PDF',
                installablePublic: !installed,
                removableByUser: installed,
                installedByUser: installed,
              },
            ],
            categories: ['Documents'],
          }),
        } as Response;
      }

      if (input === '/api/marketplace/skills/pdf?agentId=agent-1' && init?.method === 'DELETE') {
        listState = 'removed';
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }

      if (input === '/api/marketplace/skills/pdf/install' && init?.method === 'POST') {
        listState = 'installed';
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    render(<MarketplacePage />);

    await waitFor(() => {
      expect(screen.getByText('PDF')).toBeDefined();
      expect(screen.getByText('Remove')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Remove'));

    await waitFor(() => {
      expect(screen.getByText('Install')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Install'));

    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeDefined();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/marketplace/skills/pdf?agentId=agent-1', { method: 'DELETE' });
    expect(fetchMock).toHaveBeenCalledWith('/api/marketplace/skills/pdf/install', expect.objectContaining({ method: 'POST' }));
  });
});

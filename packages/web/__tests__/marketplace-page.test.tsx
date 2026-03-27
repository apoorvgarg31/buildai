import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MarketplacePage from '../src/components/MarketplacePage';

describe('MarketplacePage skill install and uninstall', () => {
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

  it('installs and removes marketplace skills from the user view', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === '/api/me') {
        return { ok: true, json: async () => ({ agentId: 'agent-1' }) } as Response;
      }

      if (input === '/api/marketplace/skills' || input === '/api/marketplace/skills?agentId=agent-1') {
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
                installablePublic: true,
                removableByUser: true,
                installedByUser: true,
              },
              {
                id: 'docx',
                name: 'DOCX',
                description: 'DOCX tools',
                category: 'Documents',
                icon: '📝',
                vendor: 'Anthropic',
                version: '1.0.0',
                tags: ['docx'],
                readme: '# DOCX',
                installablePublic: true,
                removableByUser: false,
                installedByUser: false,
              },
            ],
            categories: ['Documents'],
          }),
        } as Response;
      }

      if (input === '/api/marketplace/skills/docx/install') {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }

      if (input === '/api/marketplace/skills/pdf?agentId=agent-1') {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    render(<MarketplacePage />);

    await waitFor(() => {
      expect(screen.getByText('PDF')).toBeDefined();
      expect(screen.getByText('DOCX')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Install'));
    fireEvent.click(screen.getByText('Remove'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/marketplace/skills/docx/install', expect.objectContaining({ method: 'POST' }));
      expect(fetchMock).toHaveBeenCalledWith('/api/marketplace/skills/pdf?agentId=agent-1', { method: 'DELETE' });
    });
  });
});

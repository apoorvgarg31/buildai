import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SchedulePage from '../src/components/SchedulePage';

describe('SchedulePage timezone handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === 'string' && input === '/api/schedule' && (!init || !init.method || init.method === 'GET')) {
        return {
          ok: true,
          json: async () => ({ jobs: [] }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ ok: true }),
      } as Response;
    }) as typeof fetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('submits the browser timezone instead of a hardcoded fallback', async () => {
    const timezoneSpy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      (() => ({
        resolvedOptions: () => ({ timeZone: 'America/Los_Angeles' }),
      })) as unknown as typeof Intl.DateTimeFormat,
    );

    render(<SchedulePage />);
    fireEvent.click(screen.getByText('Create daily schedule'));

    await waitFor(() => {
      const postCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(([, init]) => init?.method === 'POST');
      expect(postCall).toBeDefined();
      expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
        action: 'add',
        tz: 'America/Los_Angeles',
      });
    });

    timezoneSpy.mockRestore();
  });
});

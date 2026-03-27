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

  it('renders existing jobs and supports run, pause, and delete actions', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === 'string' && input === '/api/schedule' && (!init || !init.method || init.method === 'GET')) {
        return {
          ok: true,
          json: async () => ({
            jobs: [
              {
                id: 'job-1',
                name: 'Morning Digest',
                enabled: true,
                schedule: { expr: '30 8 * * *', tz: 'Europe/London' },
              },
            ],
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ ok: true }),
      } as Response;
    }) as typeof fetch);

    render(<SchedulePage />);

    await waitFor(() => {
      expect(screen.getByText('Morning Digest')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Run now'));
    fireEvent.click(screen.getByText('Pause'));
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      const postBodies = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
        .filter(([, init]) => init?.method === 'POST')
        .map(([, init]) => JSON.parse(String(init?.body)));

      expect(postBodies).toEqual(expect.arrayContaining([
        expect.objectContaining({ action: 'run', jobId: 'job-1' }),
        expect.objectContaining({ action: 'update', jobId: 'job-1', enabled: false }),
        expect.objectContaining({ action: 'remove', jobId: 'job-1' }),
      ]));
    });
  });

  it('shows an error message when a run-now request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === 'string' && input === '/api/schedule' && (!init || !init.method || init.method === 'GET')) {
        return {
          ok: true,
          json: async () => ({ jobs: [{ id: 'job-2', name: 'Evening Digest', enabled: true }] }),
        } as Response;
      }

      return {
        ok: false,
        json: async () => ({ error: 'failed' }),
      } as Response;
    }) as typeof fetch);

    render(<SchedulePage />);

    await waitFor(() => {
      expect(screen.getByText('Evening Digest')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Run now'));

    await waitFor(() => {
      expect(screen.getByText('Run failed.')).toBeDefined();
    });
  });
});

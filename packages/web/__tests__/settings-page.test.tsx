import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsPage from '../src/components/SettingsPage';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('loads persisted user settings from USER.md', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (input === '/api/personality/files') {
        return {
          ok: true,
          json: async () => ({
            files: {
              USER: '# USER\n\n## Preferences\n- Response style: detailed\n- Alert level: all\n- Daily brief: 07:45\n- Proactive updates: disabled\n',
            },
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as typeof fetch);

    render(<SettingsPage />);

    await waitFor(() => {
      expect((screen.getByLabelText('Response style') as HTMLSelectElement).value).toBe('detailed');
      expect((screen.getByLabelText('Alert level') as HTMLSelectElement).value).toBe('all');
      expect((screen.getByLabelText('Daily brief time') as HTMLInputElement).value).toBe('07:45');
      expect((screen.getByLabelText('Proactive updates') as HTMLInputElement).checked).toBe(false);
    });
  });

  it('saves updated settings back into USER.md without dropping existing content', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === '/api/personality/files' && !init?.method) {
        return {
          ok: true,
          json: async () => ({
            files: {
              USER: '# USER\n\n## Role\n- PM\n\n## Preferences\n- Response style: concise\n- Alert level: critical\n- Daily brief: 08:30\n- Proactive updates: enabled\n\n## Top Pain Points\n- RFIs\n',
            },
          }),
        } as Response;
      }

      if (input === '/api/personality/files' && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as { file: string; content: string };
        expect(body.file).toBe('USER.md');
        expect(body.content).toContain('## Role\n- PM');
        expect(body.content).toContain('## Top Pain Points\n- RFIs');
        expect(body.content).toContain('Response style: balanced');
        expect(body.content).toContain('Alert level: important');
        expect(body.content).toContain('Daily brief: 09:15');
        expect(body.content).toContain('Proactive updates: disabled');

        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Response style')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Response style'), { target: { value: 'balanced' } });
    fireEvent.change(screen.getByLabelText('Alert level'), { target: { value: 'important' } });
    fireEvent.change(screen.getByLabelText('Daily brief time'), { target: { value: '09:15' } });
    fireEvent.click(screen.getByLabelText('Proactive updates'));
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));

    await waitFor(() => {
      expect(screen.getByText('Preferences saved for future Mira sessions.')).toBeDefined();
    });
  });

  it('shows a clear save error when persistence fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === '/api/personality/files' && !init?.method) {
        return {
          ok: true,
          json: async () => ({ files: { USER: '# USER' } }),
        } as Response;
      }

      if (input === '/api/personality/files' && init?.method === 'PUT') {
        return { ok: false, json: async () => ({ error: 'disk full' }) } as Response;
      }

      throw new Error(`Unexpected fetch: ${String(input)}`);
    }) as typeof fetch);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Response style')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));

    await waitFor(() => {
      expect(screen.getByText('We could not save your settings.')).toBeDefined();
    });
  });
});

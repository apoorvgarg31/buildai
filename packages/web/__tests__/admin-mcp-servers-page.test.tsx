import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminMcpServersPage from '../src/components/AdminMcpServersPage';

describe('AdminMcpServersPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
  });

  it('renders registered MCP servers and connector-linked suggestions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        servers: [
          {
            id: 'mcp-linear',
            name: 'Linear MCP',
            server_kind: 'connector_linked',
            transport: 'stdio',
            status: 'configured',
            enabled: true,
            connection_name: 'Linear Workspace',
            connection_type: 'linear',
          },
        ],
        availableConnectorTargets: [
          {
            connection_id: 'conn-slack',
            connection_name: 'Slack HQ',
            connection_type: 'slack',
          },
        ],
      }),
    })) as typeof fetch);

    render(<AdminMcpServersPage />);

    await waitFor(() => {
      expect(screen.getByText('Linear MCP')).toBeDefined();
    });

    expect(screen.getByText('Slack HQ')).toBeDefined();
    expect(screen.getByText('Connector-linked suggestion')).toBeDefined();
  });

  it('opens a prefilled modal from a connector suggestion and creates a server', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method || init.method === 'GET') {
        return {
          ok: true,
          json: async () => ({
            servers: [],
            availableConnectorTargets: [
              {
                connection_id: 'conn-linear',
                connection_name: 'Linear Workspace',
                connection_type: 'linear',
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({ success: true }),
      };
    });
    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    render(<AdminMcpServersPage />);

    await waitFor(() => {
      expect(screen.getByText('Linear Workspace')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Create server'));

    expect(screen.getByDisplayValue('Linear Workspace MCP')).toBeDefined();
    expect(screen.getByDisplayValue('npx')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('@vendor/server --flag'), {
      target: { value: '@acme/linear-mcp --headless' },
    });
    fireEvent.click(screen.getAllByText('Create server', { selector: 'button' }).at(-1)!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/mcp-servers', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('deletes a registered MCP server after confirmation', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method || init.method === 'GET') {
        return {
          ok: true,
          json: async () => ({
            servers: [
              {
                id: 'mcp-linear',
                name: 'Linear MCP',
                server_kind: 'connector_linked',
                transport: 'stdio',
                status: 'active',
                enabled: true,
                connection_name: 'Linear Workspace',
                connection_type: 'linear',
              },
            ],
            availableConnectorTargets: [],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({ success: true }),
      };
    });
    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    render(<AdminMcpServersPage />);

    await waitFor(() => {
      expect(screen.getByText('Linear MCP')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/mcp-servers/mcp-linear', { method: 'DELETE' });
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import AdminMcpServersPage from '../src/components/AdminMcpServersPage';

describe('AdminMcpServersPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
});

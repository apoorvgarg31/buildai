import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import ConnectorsPage from '../src/components/ConnectorsPage';

describe('ConnectorsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders reconnect guidance for expired oauth connectors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({
        agentId: 'agent-a',
        connections: [
          {
            id: 'conn-procore',
            name: 'Procore Production',
            type: 'procore',
            status: 'connected',
            authMode: 'oauth_user',
            userAuthorized: false,
            readyForUse: false,
            requiresUserAuth: true,
            tokenExpired: true,
            reconnectRequired: true,
            blockedReason: 'reconnect_required',
            statusLabel: 'Reconnect required',
            actionLabel: 'Reconnect account',
            authUrl: '/api/procore/auth?connectionId=conn-procore',
          },
        ],
      }),
    })) as typeof fetch);

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByText('Procore Production')).toBeDefined();
    });

    expect(screen.getByText('Reconnect required')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Reconnect account' })).toBeDefined();
  });
});

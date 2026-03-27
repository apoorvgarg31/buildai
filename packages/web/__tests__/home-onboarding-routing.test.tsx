import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const useCurrentUserMock = vi.fn();

vi.mock('@/lib/user', () => ({
  useCurrentUser: () => useCurrentUserMock(),
}));

vi.mock('@/components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('@/components/ChatArea', () => ({
  default: () => <div>Chat area</div>,
}));

vi.mock('@/components/WorkspaceOnboardingPage', () => ({
  default: () => <div>Workspace onboarding</div>,
}));

vi.mock('@/components/ConnectorsPage', () => ({ default: () => <div>Connectors</div> }));
vi.mock('@/components/AdminDashboard', () => ({ default: () => <div>Admin dashboard</div> }));
vi.mock('@/components/AdminUsersPage', () => ({ default: () => <div>Admin users</div> }));
vi.mock('@/components/AdminAgentsPage', () => ({ default: () => <div>Admin agents</div> }));
vi.mock('@/components/AdminConnectionsPage', () => ({ default: () => <div>Admin connections</div> }));
vi.mock('@/components/AdminToolsPage', () => ({ default: () => <div>Admin tools</div> }));
vi.mock('@/components/AdminMcpServersPage', () => ({ default: () => <div>Admin MCP</div> }));
vi.mock('@/components/AdminSettingsPage', () => ({ default: () => <div>Admin settings</div> }));
vi.mock('@/components/MarketplacePage', () => ({ default: () => <div>Marketplace</div> }));
vi.mock('@/components/UsagePage', () => ({ default: () => <div>Usage</div> }));
vi.mock('@/components/SettingsPage', () => ({ default: () => <div>Settings</div> }));
vi.mock('@/components/PersonalityStudio', () => ({ default: () => <div>Personality</div> }));
vi.mock('@/components/WatchlistPage', () => ({ default: () => <div>Watchlist</div> }));
vi.mock('@/components/SchedulePage', () => ({ default: () => <div>Schedule</div> }));
vi.mock('@/components/ArtifactsPage', () => ({ default: () => <div>Artifacts</div> }));
vi.mock('@clerk/nextjs', () => ({ RedirectToSignIn: () => <div>Sign in redirect</div> }));

import Home from '../src/app/page';

describe('Home onboarding routing', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows workspace onboarding before chat when provisioning is still required', () => {
    useCurrentUserMock.mockReturnValue({
      isLoaded: true,
      user: {
        id: 'user-1',
        email: 'apy@example.com',
        name: 'Apy',
        role: 'admin',
        title: 'Administrator',
        avatar: 'AG',
        agentId: undefined,
        needsProvisioning: true,
      },
    });

    render(<Home />);

    expect(screen.getByText('Workspace onboarding')).toBeDefined();
    expect(screen.queryByText('Chat area')).toBeNull();
  });
});

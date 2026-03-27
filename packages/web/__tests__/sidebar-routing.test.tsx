import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Sidebar from '../src/components/Sidebar';

const usePathnameMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ signOut: vi.fn() }),
}));

describe('Sidebar routing', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders route links for the user workspace', () => {
    usePathnameMock.mockReturnValue('/chat');

    render(<Sidebar user={{
      id: 'user-1',
      email: 'user@example.com',
      name: 'Casey User',
      role: 'user',
      title: 'Project Manager',
      avatar: 'CU',
      needsProvisioning: false,
    }} />);

    expect(screen.getByRole('link', { name: /Chat/i }).getAttribute('href')).toBe('/chat');
    expect(screen.getByRole('link', { name: /Connectors/i }).getAttribute('href')).toBe('/connectors');
    expect(screen.getByRole('link', { name: /Automation/i }).getAttribute('href')).toBe('/automation');
  });

  it('renders admin routes and a path-based view switcher for admins', () => {
    usePathnameMock.mockReturnValue('/admin/dashboard');

    render(<Sidebar user={{
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Apy Admin',
      role: 'admin',
      title: 'Administrator',
      avatar: 'AA',
      needsProvisioning: false,
    }} />);

    expect(screen.getByRole('link', { name: /Dashboard/i }).getAttribute('href')).toBe('/admin/dashboard');
    expect(screen.getByRole('link', { name: /Users/i }).getAttribute('href')).toBe('/admin/users');
    expect(screen.getByRole('link', { name: /Connectors/i }).getAttribute('href')).toBe('/admin/connectors');
    expect(screen.getByRole('link', { name: /Admin/i }).getAttribute('href')).toBe('/chat');
  });
});

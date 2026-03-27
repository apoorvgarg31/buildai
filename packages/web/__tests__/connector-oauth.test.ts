import { describe, expect, it, vi } from 'vitest';
import { CONNECTOR_CATALOG } from '../src/lib/connector-catalog';

const getConnectionMock = vi.hoisted(() => vi.fn());
const getConnectionSecretsMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-db', () => ({
  getConnection: getConnectionMock,
  getConnectionSecrets: getConnectionSecretsMock,
}));

import { buildConnectorAuthorizationUrl, getConnectorAuthUrl, getConnectorTokenStatusUrl, listSupportedOAuthConnectorTypes } from '../src/lib/connector-oauth';

describe('connector oauth registry', () => {
  it('provides auth and token lifecycle urls for every oauth connector in the current catalog', () => {
    const oauthTypes = CONNECTOR_CATALOG.filter((entry) => entry.defaultAuthMode === 'oauth_user').map((entry) => entry.type);

    for (const type of oauthTypes) {
      expect(getConnectorAuthUrl(type, `conn-${type}`)).toBeTruthy();
      expect(getConnectorTokenStatusUrl(type, `conn-${type}`)).toBeTruthy();
    }
  });

  it('tracks provider definitions for every non-procore oauth connector in the current catalog', () => {
    const defined = new Set(listSupportedOAuthConnectorTypes());
    const expected = CONNECTOR_CATALOG
      .filter((entry) => entry.defaultAuthMode === 'oauth_user' && entry.type !== 'procore')
      .map((entry) => entry.type);

    expect([...defined].sort()).toEqual(expected.sort());
  });

  it('builds a reusable auth url for a standard oauth connector', () => {
    getConnectionMock.mockReturnValue({
      id: 'conn-linear',
      type: 'linear',
      auth_mode: 'oauth_user',
      config: JSON.stringify({ clientId: 'linear-client', scopes: ['issues:write', 'read'] }),
    });
    getConnectionSecretsMock.mockReturnValue({ clientSecret: 'linear-secret' });

    const url = buildConnectorAuthorizationUrl('conn-linear', 'http://localhost:3000', 'state-1');

    expect(url.toString()).toContain('https://linear.app/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('linear-client');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/connectors/callback');
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('scope')).toBe('issues:write read');
  });
});

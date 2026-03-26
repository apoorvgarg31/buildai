export type ConnectorAuthMode = 'shared' | 'oauth_user' | 'token_user';

export type ConnectorCatalogEntry = {
  type: string;
  label: string;
  category: string;
  defaultAuthMode: ConnectorAuthMode;
};

export const CONNECTOR_CATALOG: ConnectorCatalogEntry[] = [
  { type: 'procore', label: 'Procore', category: 'PMIS', defaultAuthMode: 'oauth_user' },
  { type: 'unifier', label: 'Oracle Unifier', category: 'Cost Management', defaultAuthMode: 'oauth_user' },
  { type: 'p6', label: 'Primavera P6', category: 'Scheduling', defaultAuthMode: 'shared' },
  { type: 'linear', label: 'Linear', category: 'Project Tracking', defaultAuthMode: 'oauth_user' },
  { type: 'github', label: 'GitHub', category: 'Developer Tools', defaultAuthMode: 'oauth_user' },
  { type: 'gitlab', label: 'GitLab', category: 'Developer Tools', defaultAuthMode: 'oauth_user' },
  { type: 'jira', label: 'Jira', category: 'Project Tracking', defaultAuthMode: 'oauth_user' },
  { type: 'confluence', label: 'Confluence', category: 'Knowledge Base', defaultAuthMode: 'oauth_user' },
  { type: 'notion', label: 'Notion', category: 'Knowledge Base', defaultAuthMode: 'oauth_user' },
  { type: 'slack', label: 'Slack', category: 'Communication', defaultAuthMode: 'oauth_user' },
  { type: 'salesforce', label: 'Salesforce', category: 'CRM', defaultAuthMode: 'oauth_user' },
  { type: 'hubspot', label: 'HubSpot', category: 'CRM', defaultAuthMode: 'oauth_user' },
  { type: 'database', label: 'Database', category: 'Data', defaultAuthMode: 'shared' },
];

const CATALOG_BY_TYPE = new Map(CONNECTOR_CATALOG.map((entry) => [entry.type, entry]));

export function getConnectorCatalogEntry(type: string): ConnectorCatalogEntry | undefined {
  return CATALOG_BY_TYPE.get(type);
}

export function isSupportedConnectorType(type: string): boolean {
  return CATALOG_BY_TYPE.has(type);
}

export function getDefaultConnectorAuthMode(type: string): ConnectorAuthMode {
  return CATALOG_BY_TYPE.get(type)?.defaultAuthMode || 'shared';
}

import { notFound } from 'next/navigation';
import AdminToolsPage from '@/components/AdminToolsPage';
import AdminMcpServersPage from '@/components/AdminMcpServersPage';

const previewTools = [
  {
    name: 'web_fetch',
    label: 'Web fetch',
    description: 'Read external pages without opening the browser runtime.',
    category: 'Research',
    risk: 'standard' as const,
    enabled: true,
    defaultEnabled: true,
  },
  {
    name: 'browser',
    label: 'Browser',
    description: 'Control the dedicated browser for screenshots, clicks, and forms.',
    category: 'Interactive',
    risk: 'sensitive' as const,
    enabled: false,
    defaultEnabled: false,
  },
  {
    name: 'sessions_spawn',
    label: 'Sessions spawn',
    description: 'Launch a new sub-agent to handle isolated work.',
    category: 'Coordination',
    risk: 'power' as const,
    enabled: true,
    defaultEnabled: true,
  },
];

const previewServers = [
  {
    id: 'mcp-linear',
    name: 'Linear MCP',
    server_kind: 'connector_linked' as const,
    connection_id: 'conn-linear',
    connection_name: 'Linear Workspace',
    connection_type: 'linear',
    transport: 'stdio' as const,
    command: 'npx',
    url: null,
    status: 'configured',
    enabled: true,
    notes: 'Linked to the Linear enterprise connector.',
  },
  {
    id: 'mcp-fetch',
    name: 'Fetch Utility MCP',
    server_kind: 'standalone' as const,
    connection_id: null,
    connection_name: null,
    connection_type: null,
    transport: 'http' as const,
    command: null,
    url: 'https://mcp.internal/fetch',
    status: 'active',
    enabled: true,
    notes: 'Standalone runtime utility server.',
  },
];

const previewAvailableTargets = [
  {
    connection_id: 'conn-slack',
    connection_name: 'Slack HQ',
    connection_type: 'slack',
  },
  {
    connection_id: 'conn-google',
    connection_name: 'Google Workspace',
    connection_type: 'google_workspace',
  },
];

export default function AdminControlPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff,#f8fbff)]">
      <AdminToolsPage initialTools={previewTools} />
      <AdminMcpServersPage initialServers={previewServers} initialAvailableConnectorTargets={previewAvailableTargets} />
    </div>
  );
}

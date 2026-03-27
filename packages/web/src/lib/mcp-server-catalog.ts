export interface ConnectorMcpSuggestion {
  connection_id: string;
  connection_name: string;
  connection_type: string;
}

export const MCP_TRANSPORT_OPTIONS = ['stdio', 'http', 'sse'] as const;
export type McpTransport = typeof MCP_TRANSPORT_OPTIONS[number];

export const MCP_SERVER_KIND_OPTIONS = ['connector_linked', 'standalone'] as const;
export type McpServerKind = typeof MCP_SERVER_KIND_OPTIONS[number];

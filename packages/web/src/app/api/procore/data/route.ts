/**
 * POST /api/procore/data
 * Generic proxy to Procore API endpoints.
 *
 * Body: { endpoint: string, projectId?: number, params?: Record<string, string> }
 *
 * Supported endpoints:
 *   projects, rfis, submittals, budget, daily_logs, change_orders,
 *   punch_items, vendors, schedule, documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { procoreApi, resolveEndpointPath, ENDPOINT_MAP } from '@/lib/procore';

interface DataRequestBody {
  endpoint: string;
  projectId?: number;
  params?: Record<string, string>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as DataRequestBody;

    if (!body.endpoint || typeof body.endpoint !== 'string') {
      return NextResponse.json(
        { error: 'Missing "endpoint" field', available: Object.keys(ENDPOINT_MAP) },
        { status: 400 },
      );
    }

    const path = resolveEndpointPath(body.endpoint, body.projectId);
    const data = await procoreApi(path, { params: body.params });

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Procore data proxy error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

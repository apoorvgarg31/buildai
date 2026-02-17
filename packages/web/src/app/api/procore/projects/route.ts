/**
 * GET /api/procore/projects
 * Returns the list of projects from Procore sandbox.
 */

import { NextResponse } from 'next/server';
import { procoreApi } from '@/lib/procore';

export async function GET(): Promise<NextResponse> {
  try {
    const projects = await procoreApi('/rest/v1.1/projects');
    return NextResponse.json(projects);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Procore projects error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

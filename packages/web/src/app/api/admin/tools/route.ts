import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-guard';
import { listToolPolicies } from '@/lib/admin-db';

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(listToolPolicies());
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('List tools error:', err);
    return NextResponse.json({ error: 'Failed to list tools' }, { status: 500 });
  }
}

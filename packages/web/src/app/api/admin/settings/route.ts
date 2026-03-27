import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-guard';
import { apiError } from '@/lib/api-error';
import { getAdminSettings, updateAdminSettings } from '@/lib/admin-settings';
import { syncRuntimeFromAdminState } from '@/lib/runtime-sync';

function sanitizeSettings(settings: ReturnType<typeof getAdminSettings>) {
  const { sharedApiKey, ...safe } = settings;
  return safe;
}

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(sanitizeSettings(getAdminSettings()));
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && err.message === 'FORBIDDEN') return apiError('insufficient_role', 'Forbidden', 403);
    return apiError('internal_error', 'Failed to read settings', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    const defaultModel = typeof body?.defaultModel === 'string' ? body.defaultModel.trim() : undefined;
    const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : undefined;
    const responseStyle = typeof body?.responseStyle === 'string' ? body.responseStyle.trim() : undefined;
    const maxQueriesPerDay = body?.maxQueriesPerDay !== undefined ? Number.parseInt(String(body.maxQueriesPerDay), 10) : undefined;
    const maxAgents = body?.maxAgents !== undefined ? Number.parseInt(String(body.maxAgents), 10) : undefined;
    const dataRetentionDays = body?.dataRetentionDays !== undefined ? Number.parseInt(String(body.dataRetentionDays), 10) : undefined;
    const sharedApiKey = body?.sharedApiKey === undefined
      ? undefined
      : typeof body.sharedApiKey === 'string'
        ? body.sharedApiKey
        : null;

    if (defaultModel !== undefined && !defaultModel) return apiError('validation_error', 'defaultModel is required', 400);
    if (companyName !== undefined && !companyName) return apiError('validation_error', 'companyName is required', 400);
    if (responseStyle !== undefined && !responseStyle) return apiError('validation_error', 'responseStyle is required', 400);
    if (maxQueriesPerDay !== undefined && (!Number.isFinite(maxQueriesPerDay) || maxQueriesPerDay <= 0)) return apiError('validation_error', 'maxQueriesPerDay must be a positive integer', 400);
    if (maxAgents !== undefined && (!Number.isFinite(maxAgents) || maxAgents <= 0)) return apiError('validation_error', 'maxAgents must be a positive integer', 400);
    if (dataRetentionDays !== undefined && (!Number.isFinite(dataRetentionDays) || dataRetentionDays <= 0)) return apiError('validation_error', 'dataRetentionDays must be a positive integer', 400);

    const next = updateAdminSettings({
      ...(companyName !== undefined ? { companyName } : {}),
      ...(defaultModel !== undefined ? { defaultModel } : {}),
      ...(responseStyle !== undefined ? { responseStyle } : {}),
      ...(maxQueriesPerDay !== undefined ? { maxQueriesPerDay } : {}),
      ...(maxAgents !== undefined ? { maxAgents } : {}),
      ...(dataRetentionDays !== undefined ? { dataRetentionDays } : {}),
      ...(sharedApiKey !== undefined ? { sharedApiKey } : {}),
    });

    await syncRuntimeFromAdminState();
    return NextResponse.json(sanitizeSettings(next));
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') return apiError('unauthenticated', 'Not authenticated', 401);
    if (err instanceof Error && err.message === 'FORBIDDEN') return apiError('insufficient_role', 'Forbidden', 403);
    return apiError('internal_error', 'Failed to update settings', 500);
  }
}

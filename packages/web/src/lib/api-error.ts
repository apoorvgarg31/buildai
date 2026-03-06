import { NextResponse } from 'next/server';
import crypto from 'crypto';

export interface ApiErrorBody {
  code: string;
  message: string;
  error: string;
  details: unknown | null;
  requestId: string;
}

export function apiError(code: string, message: string, status: number, details?: unknown) {
  const body: ApiErrorBody = {
    code,
    message,
    error: message,
    details: details ?? null,
    requestId: crypto.randomUUID(),
  };
  return NextResponse.json(body, { status });
}

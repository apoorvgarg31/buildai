import type { RequestActor } from '@/lib/api-guard';

export interface PolicyCheckInput {
  action: string;
  actor: RequestActor;
  subjectType?: string;
  subjectId?: string;
}

export interface PolicyCheckResult {
  allowed: boolean;
  code?: string;
  reason?: string;
  details?: Record<string, unknown>;
}

/**
 * OA-3.5 policy/approval hook stub.
 * Deterministic behavior:
 * - default allow for backward compatibility
 * - if BUILDAI_REQUIRE_APPROVAL_FOR_MUTATIONS=1, require header-driven approval token via context
 */
export function checkMutationPolicy(input: PolicyCheckInput): PolicyCheckResult {
  const requireApproval = process.env.BUILDAI_REQUIRE_APPROVAL_FOR_MUTATIONS === '1';
  if (!requireApproval) {
    return { allowed: true };
  }

  return {
    allowed: false,
    code: 'policy_blocked',
    reason: 'APPROVAL_REQUIRED',
    details: {
      action: input.action,
      subjectType: input.subjectType || null,
      subjectId: input.subjectId || null,
      approvalRequired: true,
    },
  };
}

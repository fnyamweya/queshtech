type ChargeLike = {
  id?: string;
  chargeKind: string;
  code?: string;
  displayName: string;
  calculationType: string;
  rate?: string | null;
  baseAmount?: string | null;
  amount: string;
  isIncludedInPrice: boolean;
  sourceType?: string | null;
  sourceReference?: string | null;
  metaJson?: Record<string, unknown> | null;
};

export type OrderLevelChargeCreate = Omit<ChargeLike, 'id'> & {
  orderId: string;
  appliesToShipping: boolean;
};

function safeMeta(
  meta: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!meta || typeof meta !== 'object') return {};
  return meta;
}

function negateAmount(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid charge amount: ${amount}`);
  }
  // Keep numeric string formatting stable; callers can toFixed() if desired.
  return (-n).toFixed(4);
}

export function createOrderLevelChargeReversal(opts: {
  original: {
    id: string;
    orderId: string;
    chargeKind: string;
    code?: string | null;
    displayName: string;
    calculationType: string;
    rate?: string | null;
    baseAmount?: string | null;
    amount: string;
    isIncludedInPrice: boolean;
    appliesToShipping: boolean;
    sourceType?: string | null;
    sourceReference?: string | null;
    metaJson?: Record<string, unknown> | null;
  };
  reason?: string;
  meta?: Record<string, unknown>;
}): OrderLevelChargeCreate {
  const { original, reason, meta } = opts;
  return {
    orderId: original.orderId,
    chargeKind: original.chargeKind,
    code: original.code ?? undefined,
    displayName: `${original.displayName} (Reversal)`,
    calculationType: 'fixed',
    rate: undefined,
    baseAmount: original.baseAmount ?? undefined,
    amount: negateAmount(original.amount),
    isIncludedInPrice: original.isIncludedInPrice,
    appliesToShipping: original.appliesToShipping,
    sourceType: 'reversal',
    sourceReference: original.id,
    metaJson: {
      ...safeMeta(original.metaJson),
      reversalOfChargeId: original.id,
      originalSourceType: original.sourceType ?? undefined,
      originalSourceReference: original.sourceReference ?? undefined,
      reason: reason ?? undefined,
      ...(meta ?? {}),
    },
  };
}


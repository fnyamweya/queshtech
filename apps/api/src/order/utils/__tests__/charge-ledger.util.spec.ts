import { createOrderLevelChargeReversal } from '../charge-ledger.util';

describe('charge-ledger.util', () => {
  it('creates an order-level reversal row', () => {
    const r = createOrderLevelChargeReversal({
      original: {
        id: 'c1',
        orderId: 'o1',
        chargeKind: 'discount',
        displayName: 'Promotion Discount',
        calculationType: 'fixed',
        amount: '-20.0000',
        isIncludedInPrice: false,
        appliesToShipping: false,
        sourceType: 'promotion',
        sourceReference: 'p1',
        metaJson: { applied: ['PROMO10'] },
      },
      reason: 'manual_adjustment',
    });

    expect(r.orderId).toBe('o1');
    expect(r.sourceType).toBe('reversal');
    expect(r.sourceReference).toBe('c1');
    expect(r.amount).toBe('20.0000');
    expect(r.metaJson).toBeDefined();
    expect(r.metaJson!.reversalOfChargeId).toBe('c1');
    expect(r.metaJson!.reason).toBe('manual_adjustment');
  });

});

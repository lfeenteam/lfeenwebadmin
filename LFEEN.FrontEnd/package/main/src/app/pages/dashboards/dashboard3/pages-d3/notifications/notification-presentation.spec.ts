import { AdminNotification } from '../../interfaces/admin-notification.model';
import { categoryOf, iconOf, isKnownType, routeFor, severityOf } from './notification-presentation';

const notification = (overrides: Partial<AdminNotification>): AdminNotification => ({
  id: 'n1',
  type: 'SystemAlert',
  title: 'title',
  body: 'body',
  isRead: false,
  readAt: null,
  createdAt: '2026-11-28T10:00:00+02:00',
  referenceId: null,
  referenceType: null,
  ...overrides,
});

describe('notification presentation — MerchantSettlementDebt (BUG-2312)', () => {
  it('is a known finance error with its own icon, not the grey default bell', () => {
    expect(isKnownType('MerchantSettlementDebt')).toBeTrue();
    expect(categoryOf('MerchantSettlementDebt')).toBe('finance');
    expect(severityOf('MerchantSettlementDebt')).toBe('error');
    expect(iconOf('MerchantSettlementDebt')).toBe('cash-off');
  });

  it('opens the Merchant debts tab of Settlements filtered on the merchant', () => {
    const item = notification({
      type: 'MerchantSettlementDebt',
      referenceType: 'MerchantSettlement',
      referenceId: 'acc-42',
    });
    expect(routeFor(item)).toEqual({
      commands: ['settlements'],
      queryParams: { tab: 'debts', accountId: 'acc-42' },
    });
  });

  it('has no destination without a referenceId', () => {
    const item = notification({ type: 'MerchantSettlementDebt', referenceType: 'MerchantSettlement' });
    expect(routeFor(item)).toBeNull();
  });

  it('keeps a plain Settlement reference on the settlements list', () => {
    const item = notification({ type: 'SettlementFailed', referenceType: 'Settlement', referenceId: 's1' });
    expect(routeFor(item)).toEqual({ commands: ['settlements'] });
  });

  it('still falls back for unknown types', () => {
    expect(isKnownType('SomethingNew')).toBeFalse();
    expect(categoryOf('SomethingNew')).toBeNull();
    expect(iconOf('SomethingNew')).toBe('bell');
    expect(severityOf('SomethingNew')).toBe('neutral');
  });
});

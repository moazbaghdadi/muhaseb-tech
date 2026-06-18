import { describe, it, expect } from 'vitest';
import type { RecurringRule } from '../types';
import {
  monthlyOccurrences,
  nextOccurrence,
  occurrenceToTx,
  pendingOccurrences,
} from './recurrence';

function rule(over: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'r1',
    type: 'expense',
    category: 'Rent',
    description: 'Monthly rent',
    amount: 100,
    bucket: 'bank',
    dayOfMonth: 15,
    startDate: '2026-01-15',
    lastMaterialized: '2026-01-15',
    ...over,
  };
}

describe('monthlyOccurrences', () => {
  it('lists each month strictly after the watermark, up to and including today', () => {
    expect(monthlyOccurrences(15, '2026-01-15', '2026-04-15')).toEqual([
      '2026-02-15',
      '2026-03-15',
      '2026-04-15',
    ]);
  });

  it('excludes the from date and includes the to date (half-open at the start)', () => {
    expect(monthlyOccurrences(10, '2026-01-10', '2026-03-09')).toEqual(['2026-02-10']);
  });

  it('returns empty when nothing is due', () => {
    expect(monthlyOccurrences(15, '2026-04-15', '2026-04-20')).toEqual([]);
    expect(monthlyOccurrences(15, '2026-04-15', '2026-04-15')).toEqual([]);
  });

  it('clamps day 31 to the last day of shorter months', () => {
    // Feb 2026 has 28 days; April has 30.
    expect(monthlyOccurrences(31, '2026-01-31', '2026-04-30')).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('clamps day 29 in a non-leap February and uses 29 in a leap one', () => {
    expect(monthlyOccurrences(29, '2026-01-01', '2026-03-01')).toContain('2026-02-28');
    // 2028 is a leap year.
    expect(monthlyOccurrences(29, '2028-01-01', '2028-03-01')).toContain('2028-02-29');
  });

  it('crosses year boundaries', () => {
    expect(monthlyOccurrences(1, '2025-11-01', '2026-02-01')).toEqual([
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ]);
  });
});

describe('nextOccurrence', () => {
  it('returns the same day when today is an occurrence day', () => {
    expect(nextOccurrence(15, '2026-05-15')).toBe('2026-05-15');
  });

  it('returns this month when today is before the day', () => {
    expect(nextOccurrence(15, '2026-05-10')).toBe('2026-05-15');
  });

  it('rolls to next month when today is past the day', () => {
    expect(nextOccurrence(15, '2026-05-16')).toBe('2026-06-15');
  });

  it('clamps to month length', () => {
    expect(nextOccurrence(31, '2026-02-01')).toBe('2026-02-28');
  });
});

describe('pendingOccurrences', () => {
  it('gathers due occurrences across rules', () => {
    const a = rule({ id: 'a', dayOfMonth: 15, lastMaterialized: '2026-01-15' });
    const b = rule({ id: 'b', dayOfMonth: 1, lastMaterialized: '2026-02-01' });
    const pending = pendingOccurrences([a, b], '2026-03-15');
    expect(pending.map((p) => `${p.rule.id}:${p.date}`)).toEqual([
      'a:2026-02-15',
      'a:2026-03-15',
      'b:2026-03-01',
    ]);
  });

  it('is empty when every rule is already caught up', () => {
    expect(pendingOccurrences([rule({ lastMaterialized: '2026-06-15' })], '2026-06-20')).toEqual(
      [],
    );
  });
});

describe('occurrenceToTx', () => {
  it('builds an ordinary transaction tagged with the rule id', () => {
    const tx = occurrenceToTx(rule(), '2026-03-15', 'tx-1');
    expect(tx).toMatchObject({
      id: 'tx-1',
      date: '2026-03-15',
      type: 'expense',
      category: 'Rent',
      amount: 100,
      bucket: 'bank',
      recurringId: 'r1',
      attachments: [],
    });
    expect(tx.toBucket).toBeUndefined();
  });

  it('carries toBucket for transfer rules', () => {
    const tx = occurrenceToTx(
      rule({ type: 'transfer', category: '', bucket: 'bank', toBucket: 'cash' }),
      '2026-03-15',
      'tx-2',
    );
    expect(tx.type).toBe('transfer');
    expect(tx.toBucket).toBe('cash');
  });
});

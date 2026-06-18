import { describe, it, expect } from 'vitest';
import { bucketBalance, totalBalance, sumByType } from './balance';
import type { Bucket, Transaction, TxType } from '../types';

let nextId = 0;
function tx(
  type: TxType,
  amount: number,
  bucket: Bucket,
  toBucket?: Bucket,
): Transaction {
  return {
    id: `t${++nextId}`,
    date: '2026-04-10',
    type,
    category: type === 'transfer' ? '' : 'X',
    description: '',
    amount,
    attachments: [],
    bucket,
    toBucket,
  };
}

describe('bucketBalance', () => {
  it('counts only income tagged to the requested bucket', () => {
    const list = [tx('income', 100, 'bank'), tx('income', 50, 'cash')];
    expect(bucketBalance(list, 'bank')).toBe(100);
    expect(bucketBalance(list, 'cash')).toBe(50);
  });

  it('subtracts expenses tagged to the requested bucket', () => {
    const list = [tx('income', 100, 'cash'), tx('expense', 30, 'cash')];
    expect(bucketBalance(list, 'cash')).toBe(70);
    expect(bucketBalance(list, 'bank')).toBe(0);
  });

  it('moves balance from source to destination on a transfer', () => {
    const list = [tx('income', 200, 'bank'), tx('transfer', 50, 'bank', 'cash')];
    expect(bucketBalance(list, 'bank')).toBe(150);
    expect(bucketBalance(list, 'cash')).toBe(50);
  });

  it('handles a reverse transfer', () => {
    const list = [tx('income', 100, 'cash'), tx('transfer', 40, 'cash', 'bank')];
    expect(bucketBalance(list, 'cash')).toBe(60);
    expect(bucketBalance(list, 'bank')).toBe(40);
  });

  it('handles a mixed sequence', () => {
    const list = [
      tx('income', 500, 'bank'),
      tx('expense', 200, 'bank'),
      tx('income', 100, 'cash'),
      tx('transfer', 50, 'bank', 'cash'),
      tx('expense', 30, 'cash'),
    ];
    expect(bucketBalance(list, 'bank')).toBe(250);
    expect(bucketBalance(list, 'cash')).toBe(120);
  });
});

describe('totalBalance', () => {
  it('equals bank + cash', () => {
    const list = [
      tx('income', 500, 'bank'),
      tx('income', 100, 'cash'),
      tx('expense', 80, 'bank'),
    ];
    expect(totalBalance(list)).toBe(520);
  });

  it('is unaffected by transfers', () => {
    const list = [
      tx('income', 1000, 'bank'),
      tx('transfer', 400, 'bank', 'cash'),
      tx('transfer', 50, 'cash', 'bank'),
    ];
    expect(totalBalance(list)).toBe(1000);
  });
});

describe('opening balances', () => {
  it('adds the bucket opening balance to its transaction-derived balance', () => {
    const list = [tx('income', 100, 'bank'), tx('expense', 30, 'cash')];
    const opening = { bank: 500, cash: 200 };
    expect(bucketBalance(list, 'bank', opening)).toBe(600);
    expect(bucketBalance(list, 'cash', opening)).toBe(170);
  });

  it('folds both openings into the total', () => {
    const list = [tx('income', 100, 'bank')];
    expect(totalBalance(list, { bank: 500, cash: 200 })).toBe(800);
  });

  it('supports a negative opening balance', () => {
    expect(bucketBalance([], 'bank', { bank: -300, cash: 0 })).toBe(-300);
  });

  it('treats an omitted opening as zero', () => {
    const list = [tx('income', 100, 'bank')];
    expect(bucketBalance(list, 'bank')).toBe(100);
    expect(totalBalance(list)).toBe(100);
  });
});

describe('sumByType', () => {
  it('sums income and expense across both buckets, ignoring transfers', () => {
    const list = [
      tx('income', 100, 'bank'),
      tx('income', 200, 'cash'),
      tx('expense', 50, 'bank'),
      tx('transfer', 999, 'bank', 'cash'),
    ];
    expect(sumByType(list, 'income')).toBe(300);
    expect(sumByType(list, 'expense')).toBe(50);
  });
});

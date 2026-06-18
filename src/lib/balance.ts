import type { Bucket, OpeningBalances, Transaction } from '../types';

// Balance for a single bucket = its opening balance plus the net of every
// transaction tagged to it. `opening` is optional so callers that only care
// about the transaction-derived balance (e.g. tests) can omit it.
export function bucketBalance(
  tx: Transaction[],
  bucket: Bucket,
  opening?: OpeningBalances,
): number {
  let n = opening ? opening[bucket] : 0;
  for (const t of tx) {
    if (t.type === 'income' && t.bucket === bucket) n += t.amount;
    else if (t.type === 'expense' && t.bucket === bucket) n -= t.amount;
    else if (t.type === 'transfer') {
      if (t.bucket === bucket) n -= t.amount;
      if (t.toBucket === bucket) n += t.amount;
    }
  }
  return n;
}

export function totalBalance(tx: Transaction[], opening?: OpeningBalances): number {
  return bucketBalance(tx, 'bank', opening) + bucketBalance(tx, 'cash', opening);
}

export function sumByType(tx: Transaction[], type: 'income' | 'expense'): number {
  return tx.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
}

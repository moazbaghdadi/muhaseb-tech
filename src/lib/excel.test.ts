import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildWorkbook, parseWorkbook, SHEET_TX, SHEET_CATS } from './excel';
import type { AppData, Transaction } from '../types';

function makeTx(partial: Partial<Transaction> & Pick<Transaction, 'date' | 'type' | 'amount' | 'bucket'>): Transaction {
  return {
    id: 'placeholder',
    category: '',
    description: '',
    attachments: [],
    ...partial,
  } as Transaction;
}

describe('excel: round-trip', () => {
  it('preserves transaction fields across build → parse (modulo regenerated ids)', () => {
    const data: AppData = {
      cats: { income: ['Salary'], expense: ['Rent', 'Groceries'] },
      recurring: [],
      opening: { bank: 0, cash: 0 },
      tx: [
        makeTx({
          date: '2026-04-01',
          type: 'income',
          category: 'Salary',
          description: 'April pay',
          amount: 1234.56,
          bucket: 'bank',
        }),
        makeTx({
          date: '2026-04-05',
          type: 'expense',
          category: 'Rent',
          description: '',
          amount: 350,
          bucket: 'bank',
        }),
        makeTx({
          date: '2026-04-10',
          type: 'transfer',
          category: '',
          description: 'cash withdrawal',
          amount: 50,
          bucket: 'bank',
          toBucket: 'cash',
        }),
      ],
    };

    const bytes = buildWorkbook(data);
    const result = parseWorkbook(bytes);

    expect(result.errors).toEqual([]);
    expect(result.transactions).toHaveLength(3);

    const [t0, t1, t2] = result.transactions;
    expect(t0).toMatchObject({
      date: '2026-04-01',
      type: 'income',
      category: 'Salary',
      description: 'April pay',
      amount: 1234.56,
      bucket: 'bank',
      attachments: [],
    });
    expect(t0.toBucket).toBeUndefined();
    expect(t0.id).toMatch(/[0-9a-f-]{36}/);

    expect(t1.bucket).toBe('bank');
    expect(t1.amount).toBe(350);

    expect(t2).toMatchObject({
      type: 'transfer',
      bucket: 'bank',
      toBucket: 'cash',
      amount: 50,
    });

    expect(result.cats.income).toEqual(['Salary']);
    expect(result.cats.expense).toEqual(['Rent', 'Groceries']);
  });

  it('survives empty income or expense category lists', () => {
    const data: AppData = {
      cats: { income: [], expense: ['Only expense'] },
      recurring: [],
      opening: { bank: 0, cash: 0 },
      tx: [],
    };
    const result = parseWorkbook(buildWorkbook(data));
    expect(result.errors).toEqual([]);
    expect(result.cats.income).toEqual([]);
    expect(result.cats.expense).toEqual(['Only expense']);
  });

  it('regenerates fresh ids and drops attachments', () => {
    const data: AppData = {
      cats: { income: [], expense: [] },
      recurring: [],
      opening: { bank: 0, cash: 0 },
      tx: [
        {
          id: 'should-be-replaced',
          date: '2026-04-01',
          type: 'expense',
          category: 'X',
          description: '',
          amount: 10,
          attachments: [{ id: 'att1', filename: 'r.pdf', ext: 'pdf' }],
          bucket: 'bank',
        },
      ],
    };
    const result = parseWorkbook(buildWorkbook(data));
    const [t] = result.transactions;
    expect(t.id).not.toBe('should-be-replaced');
    expect(t.attachments).toEqual([]);
  });

  it('backfills cats from transaction categories when the Categories sheet is missing or incomplete', () => {
    // Synthesize a workbook with only the Transactions sheet — exercise the backfill.
    const wb = XLSX.utils.book_new();
    const txSheet = XLSX.utils.json_to_sheet([
      {
        date: '2026-04-01',
        type: 'income',
        bucket: 'bank',
        toBucket: '',
        category: 'NewIncome',
        description: '',
        amount: 100,
      },
      {
        date: '2026-04-02',
        type: 'expense',
        bucket: 'cash',
        toBucket: '',
        category: 'NewExpense',
        description: '',
        amount: 25,
      },
    ]);
    XLSX.utils.book_append_sheet(wb, txSheet, SHEET_TX);
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer | Uint8Array;
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

    const result = parseWorkbook(u8);
    expect(result.errors).toEqual([]);
    expect(result.cats.income).toEqual(['NewIncome']);
    expect(result.cats.expense).toEqual(['NewExpense']);
  });
});

describe('excel: validation', () => {
  function bytesFromRows(txRows: Record<string, unknown>[]): Uint8Array {
    const wb = XLSX.utils.book_new();
    const txSheet = XLSX.utils.json_to_sheet(txRows);
    XLSX.utils.book_append_sheet(wb, txSheet, SHEET_TX);
    const catSheet = XLSX.utils.json_to_sheet([] as Record<string, unknown>[]);
    XLSX.utils.book_append_sheet(wb, catSheet, SHEET_CATS);
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer | Uint8Array;
    return out instanceof Uint8Array ? out : new Uint8Array(out);
  }

  it('reports invalid type, bucket, amount, and bad transfer rows in errors (not transactions)', () => {
    const result = parseWorkbook(
      bytesFromRows([
        // Bad type
        { date: '2026-04-01', type: 'wat', bucket: 'bank', amount: 10, category: '', description: '', toBucket: '' },
        // Bad bucket
        { date: '2026-04-02', type: 'income', bucket: 'mattress', amount: 10, category: '', description: '', toBucket: '' },
        // Non-numeric amount
        { date: '2026-04-03', type: 'income', bucket: 'bank', amount: 'lots', category: '', description: '', toBucket: '' },
        // Negative amount
        { date: '2026-04-04', type: 'income', bucket: 'bank', amount: -5, category: '', description: '', toBucket: '' },
        // Transfer with same bucket on both sides
        { date: '2026-04-05', type: 'transfer', bucket: 'bank', toBucket: 'bank', amount: 1, category: '', description: '' },
        // Transfer with no toBucket
        { date: '2026-04-06', type: 'transfer', bucket: 'bank', toBucket: '', amount: 1, category: '', description: '' },
        // Bad date
        { date: 'yesterday', type: 'income', bucket: 'bank', amount: 1, category: '', description: '', toBucket: '' },
        // Valid row — should survive
        { date: '2026-04-07', type: 'income', bucket: 'bank', amount: 100, category: 'OK', description: '', toBucket: '' },
      ]),
    );
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].category).toBe('OK');
    expect(result.errors).toHaveLength(7);
    for (const e of result.errors) {
      expect(e.sheet).toBe('Transactions');
    }
  });

  it('returns a missing-sheet error when Transactions sheet is absent', () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([{ x: 1 }]);
    XLSX.utils.book_append_sheet(wb, sheet, 'Other');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer | Uint8Array;
    const u8 = out instanceof Uint8Array ? out : new Uint8Array(out);

    const result = parseWorkbook(u8);
    expect(result.transactions).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain(SHEET_TX);
  });
});

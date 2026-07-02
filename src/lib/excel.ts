import * as XLSX from 'xlsx';
import type { AppData, Bucket, Categories, Transaction, TxType } from '../types';

/**
 * Excel serializer + validating parser for the Import/Export screen.
 *
 * Two sheets: `Transactions` and `Categories`. Headers are stable English
 * identifiers so the format survives language switches. `id` and `attachments`
 * are intentionally not round-tripped — imported rows get fresh ids and an
 * empty attachments array.
 */

export const SHEET_TX = 'Transactions';
export const SHEET_CATS = 'Categories';

const TX_HEADERS = [
  'date',
  'type',
  'bucket',
  'toBucket',
  'category',
  'description',
  'invoiceNumber',
  'amount',
] as const;
const CAT_HEADERS = ['type', 'name'] as const;

export type ImportIssue = {
  sheet: 'Transactions' | 'Categories';
  row: number;
  reason: string;
};

export type ParseResult = {
  transactions: Transaction[];
  cats: Categories;
  errors: ImportIssue[];
};

const TX_TYPES: ReadonlySet<TxType> = new Set<TxType>(['income', 'expense', 'transfer']);
const BUCKETS: ReadonlySet<Bucket> = new Set<Bucket>(['bank', 'cash']);

export function buildWorkbook(data: AppData): Uint8Array {
  const wb = XLSX.utils.book_new();

  const txRows = data.tx.map((t) => ({
    date: t.date,
    type: t.type,
    bucket: t.bucket,
    toBucket: t.toBucket ?? '',
    category: t.category,
    description: t.description,
    invoiceNumber: t.invoiceNumber ?? '',
    amount: t.amount,
  }));
  const txSheet = XLSX.utils.json_to_sheet(txRows, { header: [...TX_HEADERS] });
  XLSX.utils.book_append_sheet(wb, txSheet, SHEET_TX);

  const catRows: { type: 'income' | 'expense'; name: string }[] = [
    ...data.cats.income.map((name) => ({ type: 'income' as const, name })),
    ...data.cats.expense.map((name) => ({ type: 'expense' as const, name })),
  ];
  const catSheet = XLSX.utils.json_to_sheet(catRows, { header: [...CAT_HEADERS] });
  XLSX.utils.book_append_sheet(wb, catSheet, SHEET_CATS);

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer | Uint8Array;
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

export function parseWorkbook(bytes: Uint8Array | ArrayBuffer): ParseResult {
  const wb = XLSX.read(bytes, { type: 'array', cellDates: true });
  const errors: ImportIssue[] = [];

  const txSheet = wb.Sheets[SHEET_TX];
  if (!txSheet) {
    return {
      transactions: [],
      cats: { income: [], expense: [] },
      errors: [{ sheet: 'Transactions', row: 0, reason: `missing sheet: ${SHEET_TX}` }],
    };
  }
  const catSheet = wb.Sheets[SHEET_CATS];

  const rawTx = XLSX.utils.sheet_to_json<Record<string, unknown>>(txSheet, {
    defval: '',
    raw: true,
  });
  const transactions: Transaction[] = [];
  rawTx.forEach((row, idx) => {
    const lineNo = idx + 2; // +1 header row, +1 to be 1-indexed
    const parsed = parseTxRow(row);
    if ('error' in parsed) {
      errors.push({ sheet: 'Transactions', row: lineNo, reason: parsed.error });
      return;
    }
    transactions.push(parsed.tx);
  });

  const cats: Categories = { income: [], expense: [] };
  if (catSheet) {
    const rawCats = XLSX.utils.sheet_to_json<Record<string, unknown>>(catSheet, {
      defval: '',
      raw: true,
    });
    const seenIncome = new Set<string>();
    const seenExpense = new Set<string>();
    rawCats.forEach((row, idx) => {
      const lineNo = idx + 2;
      const parsed = parseCatRow(row);
      if ('error' in parsed) {
        errors.push({ sheet: 'Categories', row: lineNo, reason: parsed.error });
        return;
      }
      const seen = parsed.type === 'income' ? seenIncome : seenExpense;
      if (seen.has(parsed.name)) return;
      seen.add(parsed.name);
      cats[parsed.type].push(parsed.name);
    });
  }

  // Backfill: every category referenced by a kept transaction should exist
  // in `cats`, even if the user's Categories sheet was missing or incomplete.
  const seenIncome = new Set(cats.income);
  const seenExpense = new Set(cats.expense);
  for (const t of transactions) {
    if (!t.category) continue;
    if (t.type === 'income' && !seenIncome.has(t.category)) {
      seenIncome.add(t.category);
      cats.income.push(t.category);
    } else if (t.type === 'expense' && !seenExpense.has(t.category)) {
      seenExpense.add(t.category);
      cats.expense.push(t.category);
    }
  }

  return { transactions, cats, errors };
}

type TxRowResult = { tx: Transaction } | { error: string };

function parseTxRow(row: Record<string, unknown>): TxRowResult {
  const date = coerceDate(row.date);
  if (!date) return { error: `invalid date: ${displayValue(row.date)}` };

  const type = coerceLower(row.type);
  if (!type || !TX_TYPES.has(type as TxType)) {
    return { error: `invalid type: ${displayValue(row.type)}` };
  }

  const bucket = coerceLower(row.bucket);
  if (!bucket || !BUCKETS.has(bucket as Bucket)) {
    return { error: `invalid bucket: ${displayValue(row.bucket)}` };
  }

  const amount = coerceNumber(row.amount);
  if (amount === null || amount <= 0) {
    return { error: `invalid amount: ${displayValue(row.amount)}` };
  }

  const txType = type as TxType;
  const fromBucket = bucket as Bucket;

  let toBucket: Bucket | undefined;
  if (txType === 'transfer') {
    const tb = coerceLower(row.toBucket);
    if (!tb || !BUCKETS.has(tb as Bucket)) {
      return { error: `transfer is missing or has invalid toBucket` };
    }
    if (tb === fromBucket) {
      return { error: `transfer toBucket must differ from bucket` };
    }
    toBucket = tb as Bucket;
  }

  const category = coerceString(row.category);
  const description = coerceString(row.description);
  const invoiceNumber = coerceString(row.invoiceNumber).trim();

  const tx: Transaction = {
    id: crypto.randomUUID(),
    date,
    type: txType,
    category,
    description,
    amount,
    attachments: [],
    bucket: fromBucket,
    ...(toBucket ? { toBucket } : {}),
    ...(invoiceNumber ? { invoiceNumber } : {}),
  };
  return { tx };
}

type CatRowResult = { type: 'income' | 'expense'; name: string } | { error: string };

function parseCatRow(row: Record<string, unknown>): CatRowResult {
  const type = coerceLower(row.type);
  if (type !== 'income' && type !== 'expense') {
    return { error: `invalid category type: ${displayValue(row.type)}` };
  }
  const name = coerceString(row.name).trim();
  if (!name) return { error: 'empty category name' };
  return { type, name };
}

function coerceString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return '';
}

function coerceLower(v: unknown): string {
  return coerceString(v).trim().toLowerCase();
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function coerceDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return formatDate(v);
  }
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const d = new Date(`${trimmed}T00:00:00Z`);
      return Number.isNaN(d.getTime()) ? null : trimmed;
    }
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : formatDate(d);
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Excel serial date — only triggered when `cellDates: true` failed to coerce.
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : formatDate(d);
  }
  return null;
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(empty)';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

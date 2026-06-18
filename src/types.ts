export type TxType = 'income' | 'expense' | 'transfer';

export type Bucket = 'bank' | 'cash';

export type Attachment = {
  id: string;
  filename: string;
  ext: string;
};

export type Transaction = {
  id: string;
  date: string;
  type: TxType;
  category: string;
  description: string;
  amount: number;
  attachments: Attachment[];
  bucket: Bucket;
  toBucket?: Bucket;
  // Set on transactions generated from a recurring rule. Informational only
  // (drives the 🔁 badge); a generated transaction is otherwise an ordinary tx.
  recurringId?: string;
};

export type Categories = {
  income: string[];
  expense: string[];
};

// Starting balances per bucket, set on first run or from Settings. Folded into
// the displayed balances (see src/lib/balance.ts) but never rendered as a
// transaction. May be negative (e.g. an overdrawn account).
export type OpeningBalances = {
  bank: number;
  cash: number;
};

// A monthly recurring rule. Generates one transaction per month on `dayOfMonth`
// (clamped to the month length). Open-ended: recurs until the user deletes it.
export type RecurringRule = {
  id: string;
  type: TxType;
  category: string;
  description: string;
  amount: number;
  bucket: Bucket;
  toBucket?: Bucket; // transfer only
  dayOfMonth: number; // 1–31; clamped to each month's length when generating
  startDate: string; // ISO YYYY-MM-DD — first occurrence
  // Watermark: occurrences on or before this date have already been generated.
  // Advanced as months are materialized so a manually-deleted occurrence never
  // resurrects on the next load.
  lastMaterialized: string;
};

export type AppData = {
  tx: Transaction[];
  cats: Categories;
  recurring: RecurringRule[];
  opening: OpeningBalances;
};

// Fields a user supplies for a recurring rule; the store assigns `id` and the
// `lastMaterialized` watermark.
export type RecurringInput = Omit<RecurringRule, 'id' | 'lastMaterialized'>;

export type SnapshotDescriptor =
  | { kind: 'root' }
  | { kind: 'legacy'; text: string }
  | { kind: 'addIncome'; category: string; amount: number }
  | { kind: 'addExpense'; category: string; amount: number }
  | { kind: 'addTransfer'; from: Bucket; to: Bucket; amount: number }
  | { kind: 'deleteIncome'; category: string; amount: number }
  | { kind: 'deleteExpense'; category: string; amount: number }
  | { kind: 'deleteTransfer'; from: Bucket; to: Bucket; amount: number }
  | { kind: 'deleteUnknown' }
  | { kind: 'editIncome'; category: string; amount: number }
  | { kind: 'editExpense'; category: string; amount: number }
  | { kind: 'editTransfer'; from: Bucket; to: Bucket; amount: number }
  | { kind: 'addCategory'; type: 'income' | 'expense'; name: string }
  | { kind: 'removeCategory'; type: 'income' | 'expense'; name: string }
  | { kind: 'addAttachment'; filename: string }
  | { kind: 'removeAttachment'; filename: string | null }
  | { kind: 'importAppend'; txCount: number; catCount: number }
  | { kind: 'importReplace'; txCount: number; catCount: number }
  | { kind: 'setOpening'; bank: number; cash: number }
  | { kind: 'addRecurring'; ruleType: TxType; category: string; amount: number }
  | { kind: 'updateRecurring'; ruleType: TxType; category: string; amount: number }
  | { kind: 'deleteRecurring'; ruleType: TxType; category: string; amount: number }
  | { kind: 'materializeRecurring'; count: number }
  | { kind: 'restore'; target: SnapshotDescriptor };

export type Snapshot = {
  id: string;
  parentId: string | null;
  childIds: string[];
  createdAt: number;
  label: string;
  descriptor?: SnapshotDescriptor;
  data: AppData;
  // v4 addition. Absent on snapshots authored before the v3→v4 migration; the
  // sync layer treats absent deviceId as "this device" when reconciling.
  deviceId?: string;
};

export type History = {
  rootId: string;
  currentId: string;
  nodes: Record<string, Snapshot>;
};

// Server-state envelope. Absent on disk = local-only mode. Populated when the
// user enables sync from Settings (see docs/sync-architecture.md).
export type ServerState = {
  url: string;
  lastSyncedRev: number;
  pendingPushIds: string[];
};

import type { CurrencyCode } from './lib/currency';

export type DiskFormat = {
  schemaVersion: 7;
  history: History;
  deviceId: string;
  currency: CurrencyCode;
  serverState?: ServerState;
};

export type Screen =
  | 'dashboard'
  | 'transactions'
  | 'categories'
  | 'recurring'
  | 'history'
  | 'import-export'
  | 'settings';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

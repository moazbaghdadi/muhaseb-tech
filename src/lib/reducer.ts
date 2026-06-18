import type {
  AppData,
  Attachment,
  Categories,
  RecurringRule,
  SnapshotDescriptor,
  Transaction,
} from '../types';
import type { MessageKey } from '../i18n/messages';

type TFn = (key: MessageKey) => string;

export type CategoryType = 'income' | 'expense';

export type Action =
  | { kind: 'addTx'; tx: Omit<Transaction, 'id'>; id: string }
  | { kind: 'updateTx'; id: string; tx: Omit<Transaction, 'id'> }
  | { kind: 'deleteTx'; id: string }
  | { kind: 'addCategory'; type: CategoryType; name: string }
  | { kind: 'removeCategory'; type: CategoryType; name: string }
  | { kind: 'addAttachment'; txId: string; attachment: Attachment }
  | { kind: 'removeAttachment'; txId: string; attachmentId: string }
  | {
      kind: 'importData';
      mode: 'append' | 'replace';
      transactions: Transaction[];
      cats: Categories;
    }
  | {
      kind: 'seedOpeningBalances';
      bank: number;
      cash: number;
      bankTxId: string;
      cashTxId: string;
      dateIso: string;
      categoryName: string;
      bankDescription: string;
      cashDescription: string;
    }
  | { kind: 'addRecurring'; rule: RecurringRule; txs: Transaction[] }
  | { kind: 'updateRecurring'; id: string; rule: RecurringRule }
  | { kind: 'deleteRecurring'; id: string }
  | { kind: 'materializeRecurring'; txs: Transaction[]; throughDate: string };

export const INIT_DATA: AppData = {
  cats: { income: [], expense: [] },
  tx: [],
  recurring: [],
};

function trimmedNonEmpty(s: string): string | null {
  const t = s.trim();
  return t.length === 0 ? null : t;
}

export function reduce(state: AppData, action: Action): AppData {
  switch (action.kind) {
    case 'addTx': {
      if (action.tx.type === 'transfer') {
        if (!action.tx.toBucket || action.tx.toBucket === action.tx.bucket) return state;
      }
      const tx: Transaction = { ...action.tx, id: action.id };
      return { ...state, tx: [...state.tx, tx] };
    }
    case 'updateTx': {
      if (action.tx.type === 'transfer') {
        if (!action.tx.toBucket || action.tx.toBucket === action.tx.bucket) return state;
      }
      if (!state.tx.some((t) => t.id === action.id)) return state;
      return {
        ...state,
        tx: state.tx.map((t) => (t.id === action.id ? { ...action.tx, id: action.id } : t)),
      };
    }
    case 'deleteTx': {
      return { ...state, tx: state.tx.filter((t) => t.id !== action.id) };
    }
    case 'addCategory': {
      const name = trimmedNonEmpty(action.name);
      if (!name) return state;
      if (state.cats[action.type].includes(name)) return state;
      return {
        ...state,
        cats: { ...state.cats, [action.type]: [...state.cats[action.type], name] },
      };
    }
    case 'removeCategory': {
      const list = state.cats[action.type];
      if (!list.includes(action.name)) return state;
      return {
        ...state,
        cats: {
          ...state.cats,
          [action.type]: list.filter((c) => c !== action.name),
        },
      };
    }
    case 'addAttachment': {
      const tx = state.tx.find((t) => t.id === action.txId);
      if (!tx) return state;
      if (tx.attachments.some((a) => a.id === action.attachment.id)) return state;
      return {
        ...state,
        tx: state.tx.map((t) =>
          t.id === action.txId
            ? { ...t, attachments: [...t.attachments, action.attachment] }
            : t,
        ),
      };
    }
    case 'removeAttachment': {
      const tx = state.tx.find((t) => t.id === action.txId);
      if (!tx) return state;
      if (!tx.attachments.some((a) => a.id === action.attachmentId)) return state;
      return {
        ...state,
        tx: state.tx.map((t) =>
          t.id === action.txId
            ? { ...t, attachments: t.attachments.filter((a) => a.id !== action.attachmentId) }
            : t,
        ),
      };
    }
    case 'importData': {
      // Import only carries transactions + categories; recurring rules are
      // preserved untouched in both modes.
      if (action.mode === 'replace') {
        return {
          ...state,
          tx: [...action.transactions],
          cats: {
            income: [...action.cats.income],
            expense: [...action.cats.expense],
          },
        };
      }
      return {
        ...state,
        tx: [...state.tx, ...action.transactions],
        cats: {
          income: unionPreserveOrder(state.cats.income, action.cats.income),
          expense: unionPreserveOrder(state.cats.expense, action.cats.expense),
        },
      };
    }
    case 'seedOpeningBalances': {
      if (action.bank <= 0 && action.cash <= 0) return state;
      const newTxs: Transaction[] = [];
      if (action.bank > 0) {
        newTxs.push({
          id: action.bankTxId,
          date: action.dateIso,
          type: 'income',
          category: action.categoryName,
          description: action.bankDescription,
          amount: action.bank,
          attachments: [],
          bucket: 'bank',
        });
      }
      if (action.cash > 0) {
        newTxs.push({
          id: action.cashTxId,
          date: action.dateIso,
          type: 'income',
          category: action.categoryName,
          description: action.cashDescription,
          amount: action.cash,
          attachments: [],
          bucket: 'cash',
        });
      }
      const trimmedCat = action.categoryName.trim();
      const income = trimmedCat && !state.cats.income.includes(trimmedCat)
        ? [...state.cats.income, trimmedCat]
        : state.cats.income;
      return {
        ...state,
        cats: { ...state.cats, income },
        tx: [...state.tx, ...newTxs],
      };
    }
    case 'addRecurring': {
      const r = action.rule;
      if (r.amount <= 0) return state;
      if (r.type === 'transfer') {
        if (!r.toBucket || r.toBucket === r.bucket) return state;
      }
      // The store pre-computes which occurrences are actually due (date <= today)
      // and passes them in, so a future-dated rule never creates a transaction
      // that would skew the current balance. The rule's watermark already
      // reflects these txs.
      return {
        ...state,
        recurring: [...state.recurring, r],
        tx: [...state.tx, ...action.txs],
      };
    }
    case 'updateRecurring': {
      const r = action.rule;
      if (r.amount <= 0) return state;
      if (r.type === 'transfer') {
        if (!r.toBucket || r.toBucket === r.bucket) return state;
      }
      if (!state.recurring.some((x) => x.id === action.id)) return state;
      // Editing a rule never rewrites already-generated transactions.
      return {
        ...state,
        recurring: state.recurring.map((x) =>
          x.id === action.id ? { ...r, id: action.id } : x,
        ),
      };
    }
    case 'deleteRecurring': {
      if (!state.recurring.some((x) => x.id === action.id)) return state;
      // Stops the series; past generated transactions are real and stay.
      return {
        ...state,
        recurring: state.recurring.filter((x) => x.id !== action.id),
      };
    }
    case 'materializeRecurring': {
      // No-op when nothing is due, so apply() creates no snapshot.
      if (action.txs.length === 0) return state;
      const recurring = state.recurring.map((r) =>
        r.lastMaterialized < action.throughDate
          ? { ...r, lastMaterialized: action.throughDate }
          : r,
      );
      return { ...state, tx: [...state.tx, ...action.txs], recurring };
    }
  }
}

function unionPreserveOrder(base: string[], add: string[]): string[] {
  const seen = new Set(base);
  const out = [...base];
  for (const name of add) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function actionToDescriptor(state: AppData, action: Action): SnapshotDescriptor {
  switch (action.kind) {
    case 'addTx': {
      if (action.tx.type === 'transfer' && action.tx.toBucket) {
        return {
          kind: 'addTransfer',
          from: action.tx.bucket,
          to: action.tx.toBucket,
          amount: action.tx.amount,
        };
      }
      if (action.tx.type === 'income') {
        return { kind: 'addIncome', category: action.tx.category, amount: action.tx.amount };
      }
      return { kind: 'addExpense', category: action.tx.category, amount: action.tx.amount };
    }
    case 'updateTx': {
      if (action.tx.type === 'transfer' && action.tx.toBucket) {
        return {
          kind: 'editTransfer',
          from: action.tx.bucket,
          to: action.tx.toBucket,
          amount: action.tx.amount,
        };
      }
      if (action.tx.type === 'income') {
        return { kind: 'editIncome', category: action.tx.category, amount: action.tx.amount };
      }
      return { kind: 'editExpense', category: action.tx.category, amount: action.tx.amount };
    }
    case 'deleteTx': {
      const tx = state.tx.find((x) => x.id === action.id);
      if (!tx) return { kind: 'deleteUnknown' };
      if (tx.type === 'transfer' && tx.toBucket) {
        return { kind: 'deleteTransfer', from: tx.bucket, to: tx.toBucket, amount: tx.amount };
      }
      if (tx.type === 'income') {
        return { kind: 'deleteIncome', category: tx.category, amount: tx.amount };
      }
      return { kind: 'deleteExpense', category: tx.category, amount: tx.amount };
    }
    case 'addCategory':
      return { kind: 'addCategory', type: action.type, name: action.name.trim() };
    case 'removeCategory':
      return { kind: 'removeCategory', type: action.type, name: action.name };
    case 'addAttachment':
      return { kind: 'addAttachment', filename: action.attachment.filename };
    case 'removeAttachment': {
      const tx = state.tx.find((x) => x.id === action.txId);
      const att = tx?.attachments.find((a) => a.id === action.attachmentId);
      return { kind: 'removeAttachment', filename: att?.filename ?? null };
    }
    case 'importData': {
      const txCount = action.transactions.length;
      const catCount = action.cats.income.length + action.cats.expense.length;
      return action.mode === 'replace'
        ? { kind: 'importReplace', txCount, catCount }
        : { kind: 'importAppend', txCount, catCount };
    }
    case 'seedOpeningBalances': {
      return { kind: 'firstRunSeed', bank: action.bank, cash: action.cash };
    }
    case 'addRecurring':
      return {
        kind: 'addRecurring',
        ruleType: action.rule.type,
        category: action.rule.category,
        amount: action.rule.amount,
      };
    case 'updateRecurring':
      return {
        kind: 'updateRecurring',
        ruleType: action.rule.type,
        category: action.rule.category,
        amount: action.rule.amount,
      };
    case 'deleteRecurring': {
      const r = state.recurring.find((x) => x.id === action.id);
      return {
        kind: 'deleteRecurring',
        ruleType: r?.type ?? 'expense',
        category: r?.category ?? '',
        amount: r?.amount ?? 0,
      };
    }
    case 'materializeRecurring':
      return { kind: 'materializeRecurring', count: action.txs.length };
  }
}

function bucketLabel(b: 'bank' | 'cash', t: TFn): string {
  return t(b === 'bank' ? 'bucket.bank' : 'bucket.cash');
}

function recurringLabel(prefix: string, category: string, amount: number): string {
  const parts = [prefix];
  if (category) parts.push(category); // transfers have no category
  parts.push(amount.toLocaleString('en-US'));
  return parts.join(' · ');
}

export function formatDescriptor(d: SnapshotDescriptor, t: TFn): string {
  switch (d.kind) {
    case 'root':
      return t('history.rootLabel');
    case 'legacy':
      return d.text;
    case 'addIncome':
      return `${t('undo.addIncome')} · ${d.category} · ${d.amount.toLocaleString('en-US')}`;
    case 'addExpense':
      return `${t('undo.addExpense')} · ${d.category} · ${d.amount.toLocaleString('en-US')}`;
    case 'addTransfer':
      return `${t('undo.addTransfer')} · ${bucketLabel(d.from, t)} → ${bucketLabel(d.to, t)} · ${d.amount.toLocaleString('en-US')}`;
    case 'deleteIncome':
      return `${t('undo.deleteIncome')} · ${d.category} · ${d.amount.toLocaleString('en-US')}`;
    case 'deleteExpense':
      return `${t('undo.deleteExpense')} · ${d.category} · ${d.amount.toLocaleString('en-US')}`;
    case 'deleteTransfer':
      return `${t('undo.deleteTransfer')} · ${bucketLabel(d.from, t)} → ${bucketLabel(d.to, t)} · ${d.amount.toLocaleString('en-US')}`;
    case 'deleteUnknown':
      return t('undo.deleteTx');
    case 'editIncome':
      return `${t('undo.editIncome')} · ${d.category} · ${d.amount.toLocaleString('en-US')}`;
    case 'editExpense':
      return `${t('undo.editExpense')} · ${d.category} · ${d.amount.toLocaleString('en-US')}`;
    case 'editTransfer':
      return `${t('undo.editTransfer')} · ${bucketLabel(d.from, t)} → ${bucketLabel(d.to, t)} · ${d.amount.toLocaleString('en-US')}`;
    case 'addCategory':
      return `${t(d.type === 'income' ? 'undo.addCatIncome' : 'undo.addCatExpense')} · ${d.name}`;
    case 'removeCategory':
      return `${t(d.type === 'income' ? 'undo.removeCatIncome' : 'undo.removeCatExpense')} · ${d.name}`;
    case 'addAttachment':
      return `${t('undo.addAttachment')} · ${d.filename}`;
    case 'removeAttachment':
      return d.filename === null
        ? t('undo.removeAttachment')
        : `${t('undo.removeAttachment')} · ${d.filename}`;
    case 'importAppend':
      return `${t('undo.importAppend')} · ${d.txCount.toLocaleString('en-US')} ${t('tx.title')}`;
    case 'importReplace':
      return `${t('undo.importReplace')} · ${d.txCount.toLocaleString('en-US')} ${t('tx.title')}`;
    case 'firstRunSeed': {
      const parts: string[] = [];
      if (d.bank > 0)
        parts.push(`${t('bucket.bank')} · ${d.bank.toLocaleString('en-US')}`);
      if (d.cash > 0)
        parts.push(`${t('bucket.cash')} · ${d.cash.toLocaleString('en-US')}`);
      return parts.length === 0
        ? t('undo.firstRunSeed')
        : `${t('undo.firstRunSeed')} · ${parts.join(' · ')}`;
    }
    case 'addRecurring':
      return recurringLabel(t('undo.addRecurring'), d.category, d.amount);
    case 'updateRecurring':
      return recurringLabel(t('undo.editRecurring'), d.category, d.amount);
    case 'deleteRecurring':
      return recurringLabel(t('undo.deleteRecurring'), d.category, d.amount);
    case 'materializeRecurring':
      return `${t('undo.materializeRecurring')} · ${d.count.toLocaleString('en-US')}`;
    case 'restore':
      return `${t('history.restorePrefix')}: ${formatDescriptor(d.target, t)}`;
  }
}

export function describeAction(state: AppData, action: Action, t: TFn): string {
  return formatDescriptor(actionToDescriptor(state, action), t);
}

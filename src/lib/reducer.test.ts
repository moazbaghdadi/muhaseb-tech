import { describe, it, expect } from 'vitest';
import { reduce, describeAction, INIT_DATA, type Action } from './reducer';
import { messages, type MessageKey } from '../i18n/messages';
import type { AppData } from '../types';

const blank: AppData = { tx: [], cats: { income: [], expense: [] }, recurring: [] };

const tAr = (key: MessageKey) => messages.ar[key];

describe('reduce: addTx', () => {
  it('appends a transaction with the provided id', () => {
    const a: Action = {
      kind: 'addTx',
      id: 'abc',
      tx: {
        date: '2026-04-10',
        type: 'income',
        category: 'X',
        description: '',
        amount: 10,
        attachments: [],
        bucket: 'bank',
      },
    };
    const next = reduce(blank, a);
    expect(next.tx).toHaveLength(1);
    expect(next.tx[0].id).toBe('abc');
    expect(next.tx[0].amount).toBe(10);
    expect(next.tx[0].bucket).toBe('bank');
  });

  it('does not mutate the input state', () => {
    const before = JSON.stringify(blank);
    reduce(blank, {
      kind: 'addTx',
      id: 'abc',
      tx: {
        date: '2026-04-10',
        type: 'income',
        category: 'X',
        description: '',
        amount: 10,
        attachments: [],
        bucket: 'bank',
      },
    });
    expect(JSON.stringify(blank)).toBe(before);
  });

  it('appends a transfer with bucket and toBucket preserved', () => {
    const next = reduce(blank, {
      kind: 'addTx',
      id: 'tr1',
      tx: {
        date: '2026-04-10',
        type: 'transfer',
        category: '',
        description: 'cash withdrawal',
        amount: 50,
        attachments: [],
        bucket: 'bank',
        toBucket: 'cash',
      },
    });
    expect(next.tx).toHaveLength(1);
    expect(next.tx[0].type).toBe('transfer');
    expect(next.tx[0].bucket).toBe('bank');
    expect(next.tx[0].toBucket).toBe('cash');
  });

  it('drops a transfer with no toBucket', () => {
    const next = reduce(blank, {
      kind: 'addTx',
      id: 'bad',
      tx: {
        date: '2026-04-10',
        type: 'transfer',
        category: '',
        description: '',
        amount: 50,
        attachments: [],
        bucket: 'bank',
      },
    });
    expect(next).toBe(blank);
  });

  it('drops a transfer where toBucket equals bucket', () => {
    const next = reduce(blank, {
      kind: 'addTx',
      id: 'bad',
      tx: {
        date: '2026-04-10',
        type: 'transfer',
        category: '',
        description: '',
        amount: 50,
        attachments: [],
        bucket: 'cash',
        toBucket: 'cash',
      },
    });
    expect(next).toBe(blank);
  });
});

describe('reduce: deleteTx', () => {
  const seeded: AppData = {
    cats: { income: [], expense: [] },
    recurring: [],
    tx: [
      {
        id: '1',
        date: '2026-04-01',
        type: 'income',
        category: 'X',
        description: '',
        amount: 10,
        attachments: [],
        bucket: 'bank',
      },
      {
        id: '2',
        date: '2026-04-02',
        type: 'expense',
        category: 'Y',
        description: '',
        amount: 20,
        attachments: [],
        bucket: 'bank',
      },
    ],
  };

  it('removes the matching id', () => {
    const next = reduce(seeded, { kind: 'deleteTx', id: '1' });
    expect(next.tx).toHaveLength(1);
    expect(next.tx[0].id).toBe('2');
  });

  it('is a no-op if id is missing', () => {
    const next = reduce(seeded, { kind: 'deleteTx', id: 'nope' });
    expect(next.tx).toHaveLength(2);
  });
});

describe('reduce: updateTx', () => {
  const seeded: AppData = {
    cats: { income: [], expense: [] },
    recurring: [],
    tx: [
      {
        id: '1',
        date: '2026-04-01',
        type: 'expense',
        category: 'Old',
        description: 'old desc',
        amount: 10,
        attachments: [{ id: 'a1', filename: 'old.pdf', ext: 'pdf' }],
        bucket: 'bank',
      },
      {
        id: '2',
        date: '2026-04-02',
        type: 'income',
        category: 'Donations',
        description: '',
        amount: 100,
        attachments: [],
        bucket: 'cash',
      },
    ],
  };

  it('replaces the matching tx wholesale and preserves the id', () => {
    const next = reduce(seeded, {
      kind: 'updateTx',
      id: '1',
      tx: {
        date: '2026-05-09',
        type: 'expense',
        category: 'New',
        description: 'new desc',
        amount: 42,
        attachments: [],
        bucket: 'cash',
      },
    });
    expect(next.tx).toHaveLength(2);
    const updated = next.tx.find((t) => t.id === '1')!;
    expect(updated.id).toBe('1');
    expect(updated.category).toBe('New');
    expect(updated.description).toBe('new desc');
    expect(updated.amount).toBe(42);
    expect(updated.bucket).toBe('cash');
    expect(updated.date).toBe('2026-05-09');
    expect(updated.attachments).toEqual([]);
    const untouched = next.tx.find((t) => t.id === '2')!;
    expect(untouched.category).toBe('Donations');
  });

  it('returns the same state reference when id is missing', () => {
    const next = reduce(seeded, {
      kind: 'updateTx',
      id: 'missing',
      tx: {
        date: '2026-05-09',
        type: 'expense',
        category: 'X',
        description: '',
        amount: 1,
        attachments: [],
        bucket: 'bank',
      },
    });
    expect(next).toBe(seeded);
  });

  it('returns the same state reference for a transfer with no toBucket', () => {
    const next = reduce(seeded, {
      kind: 'updateTx',
      id: '1',
      tx: {
        date: '2026-05-09',
        type: 'transfer',
        category: '',
        description: '',
        amount: 1,
        attachments: [],
        bucket: 'bank',
      },
    });
    expect(next).toBe(seeded);
  });

  it('returns the same state reference when transfer toBucket equals bucket', () => {
    const next = reduce(seeded, {
      kind: 'updateTx',
      id: '1',
      tx: {
        date: '2026-05-09',
        type: 'transfer',
        category: '',
        description: '',
        amount: 1,
        attachments: [],
        bucket: 'cash',
        toBucket: 'cash',
      },
    });
    expect(next).toBe(seeded);
  });

  it('does not mutate the input state', () => {
    const before = JSON.stringify(seeded);
    reduce(seeded, {
      kind: 'updateTx',
      id: '1',
      tx: {
        date: '2026-05-09',
        type: 'expense',
        category: 'New',
        description: '',
        amount: 5,
        attachments: [],
        bucket: 'bank',
      },
    });
    expect(JSON.stringify(seeded)).toBe(before);
  });
});

describe('reduce: addCategory', () => {
  it('appends a trimmed name', () => {
    const next = reduce(blank, { kind: 'addCategory', type: 'income', name: '  مرتبات  ' });
    expect(next.cats.income).toEqual(['مرتبات']);
  });
  it('rejects empty / whitespace-only names', () => {
    expect(reduce(blank, { kind: 'addCategory', type: 'income', name: '' })).toBe(blank);
    expect(reduce(blank, { kind: 'addCategory', type: 'income', name: '   ' })).toBe(blank);
  });
  it('rejects duplicates within the same type', () => {
    const seeded = reduce(blank, { kind: 'addCategory', type: 'income', name: 'A' });
    const again = reduce(seeded, { kind: 'addCategory', type: 'income', name: 'A' });
    expect(again).toBe(seeded);
  });
  it('allows the same name across different types', () => {
    const a = reduce(blank, { kind: 'addCategory', type: 'income', name: 'A' });
    const b = reduce(a, { kind: 'addCategory', type: 'expense', name: 'A' });
    expect(b.cats.income).toEqual(['A']);
    expect(b.cats.expense).toEqual(['A']);
  });
});

describe('reduce: removeCategory', () => {
  it('removes only the matching name from the right type', () => {
    const seeded: AppData = {
      tx: [],
      cats: { income: ['A', 'B'], expense: ['A'] },
      recurring: [],
    };
    const next = reduce(seeded, { kind: 'removeCategory', type: 'income', name: 'A' });
    expect(next.cats.income).toEqual(['B']);
    expect(next.cats.expense).toEqual(['A']);
  });
  it('is a no-op if missing', () => {
    const seeded: AppData = { tx: [], cats: { income: ['A'], expense: [] }, recurring: [] };
    const next = reduce(seeded, { kind: 'removeCategory', type: 'income', name: 'Z' });
    expect(next).toBe(seeded);
  });
});

describe('reduce: addAttachment / removeAttachment', () => {
  const seeded: AppData = {
    cats: { income: [], expense: [] },
    recurring: [],
    tx: [
      {
        id: 't1',
        date: '2026-04-01',
        type: 'expense',
        category: 'X',
        description: '',
        amount: 10,
        attachments: [],
        bucket: 'bank',
      },
    ],
  };

  it('addAttachment appends the attachment to the matching tx', () => {
    const next = reduce(seeded, {
      kind: 'addAttachment',
      txId: 't1',
      attachment: { id: 'a1', filename: 'invoice.pdf', ext: 'pdf' },
    });
    expect(next.tx[0].attachments).toEqual([
      { id: 'a1', filename: 'invoice.pdf', ext: 'pdf' },
    ]);
  });

  it('addAttachment is a no-op when txId is unknown', () => {
    const next = reduce(seeded, {
      kind: 'addAttachment',
      txId: 'missing',
      attachment: { id: 'a1', filename: 'x.pdf', ext: 'pdf' },
    });
    expect(next).toBe(seeded);
  });

  it('addAttachment does not duplicate existing ids', () => {
    const once = reduce(seeded, {
      kind: 'addAttachment',
      txId: 't1',
      attachment: { id: 'a1', filename: 'x.pdf', ext: 'pdf' },
    });
    const twice = reduce(once, {
      kind: 'addAttachment',
      txId: 't1',
      attachment: { id: 'a1', filename: 'x.pdf', ext: 'pdf' },
    });
    expect(twice).toBe(once);
  });

  it('removeAttachment drops the matching attachment', () => {
    const withAtt = reduce(seeded, {
      kind: 'addAttachment',
      txId: 't1',
      attachment: { id: 'a1', filename: 'x.pdf', ext: 'pdf' },
    });
    const after = reduce(withAtt, {
      kind: 'removeAttachment',
      txId: 't1',
      attachmentId: 'a1',
    });
    expect(after.tx[0].attachments).toEqual([]);
  });

  it('removeAttachment is a no-op for an unknown attachment id', () => {
    const next = reduce(seeded, {
      kind: 'removeAttachment',
      txId: 't1',
      attachmentId: 'nope',
    });
    expect(next).toBe(seeded);
  });
});

describe('describeAction', () => {
  it('describes addTx with type, category, and amount (Arabic)', () => {
    const s = describeAction(
      blank,
      {
        kind: 'addTx',
        id: 'x',
        tx: {
          date: '2026-04-10',
          type: 'income',
          category: 'التبرعات',
          description: '',
          amount: 500,
          attachments: [],
          bucket: 'bank',
        },
      },
      tAr,
    );
    expect(s).toContain(messages.ar['undo.addIncome']);
    expect(s).toContain('التبرعات');
    expect(s).toContain('500');
  });

  it('describes addTx in German when given the German translator', () => {
    const tDe = (key: MessageKey) => messages.de[key];
    const s = describeAction(
      blank,
      {
        kind: 'addTx',
        id: 'x',
        tx: {
          date: '2026-04-10',
          type: 'expense',
          category: 'Miete',
          description: '',
          amount: 350,
          attachments: [],
          bucket: 'bank',
        },
      },
      tDe,
    );
    expect(s).toContain(messages.de['undo.addExpense']);
    expect(s).toContain('Miete');
    expect(s).toContain('350');
  });

  it('describes a transfer with both bucket labels and the arrow', () => {
    const s = describeAction(
      blank,
      {
        kind: 'addTx',
        id: 'x',
        tx: {
          date: '2026-04-10',
          type: 'transfer',
          category: '',
          description: '',
          amount: 50,
          attachments: [],
          bucket: 'bank',
          toBucket: 'cash',
        },
      },
      tAr,
    );
    expect(s).toContain(messages.ar['undo.addTransfer']);
    expect(s).toContain(messages.ar['bucket.bank']);
    expect(s).toContain(messages.ar['bucket.cash']);
    expect(s).toContain('→');
  });

  it('describes deleteTx using the existing transaction', () => {
    const seeded: AppData = {
      cats: { income: [], expense: [] },
      recurring: [],
      tx: [
        {
          id: '1',
          date: '2026-04-01',
          type: 'expense',
          category: 'الإيجار',
          description: '',
          amount: 350,
          attachments: [],
          bucket: 'bank',
        },
      ],
    };
    const s = describeAction(seeded, { kind: 'deleteTx', id: '1' }, tAr);
    expect(s).toContain(messages.ar['undo.deleteExpense']);
    expect(s).toContain('الإيجار');
  });

  it('falls back gracefully when deleteTx target is missing', () => {
    const s = describeAction(blank, { kind: 'deleteTx', id: 'missing' }, tAr);
    expect(s).toBe(messages.ar['undo.deleteTx']);
  });

  it('describes addCategory with type-specific verb', () => {
    const s = describeAction(blank, { kind: 'addCategory', type: 'income', name: 'X' }, tAr);
    expect(s).toContain(messages.ar['undo.addCatIncome']);
    expect(s).toContain('X');
  });

  it('describes removeCategory with type-specific verb', () => {
    const s = describeAction(blank, { kind: 'removeCategory', type: 'expense', name: 'Y' }, tAr);
    expect(s).toContain(messages.ar['undo.removeCatExpense']);
    expect(s).toContain('Y');
  });

  it('describes updateTx for income with post-edit category and amount', () => {
    const s = describeAction(
      blank,
      {
        kind: 'updateTx',
        id: '1',
        tx: {
          date: '2026-05-09',
          type: 'income',
          category: 'التبرعات',
          description: '',
          amount: 750,
          attachments: [],
          bucket: 'bank',
        },
      },
      tAr,
    );
    expect(s).toContain(messages.ar['undo.editIncome']);
    expect(s).toContain('التبرعات');
    expect(s).toContain('750');
  });

  it('describes updateTx for transfer with both bucket labels and the arrow', () => {
    const s = describeAction(
      blank,
      {
        kind: 'updateTx',
        id: '1',
        tx: {
          date: '2026-05-09',
          type: 'transfer',
          category: '',
          description: '',
          amount: 25,
          attachments: [],
          bucket: 'bank',
          toBucket: 'cash',
        },
      },
      tAr,
    );
    expect(s).toContain(messages.ar['undo.editTransfer']);
    expect(s).toContain(messages.ar['bucket.bank']);
    expect(s).toContain(messages.ar['bucket.cash']);
    expect(s).toContain('→');
  });
});

describe('INIT_DATA', () => {
  it('starts empty so new users begin from scratch', () => {
    expect(INIT_DATA.tx).toEqual([]);
    expect(INIT_DATA.cats.income).toEqual([]);
    expect(INIT_DATA.cats.expense).toEqual([]);
  });
});

describe('reduce: importData', () => {
  const seeded: AppData = {
    cats: { income: ['Salary'], expense: ['Rent'] },
    recurring: [],
    tx: [
      {
        id: 'old1',
        date: '2026-01-01',
        type: 'income',
        category: 'Salary',
        description: '',
        amount: 100,
        attachments: [],
        bucket: 'bank',
      },
    ],
  };

  const importedTxs = [
    {
      id: 'new1',
      date: '2026-04-01',
      type: 'expense' as const,
      category: 'Rent',
      description: '',
      amount: 350,
      attachments: [],
      bucket: 'bank' as const,
    },
    {
      id: 'new2',
      date: '2026-04-02',
      type: 'expense' as const,
      category: 'Groceries',
      description: '',
      amount: 50,
      attachments: [],
      bucket: 'cash' as const,
    },
  ];

  it('replace mode wipes existing data and uses imported payload exactly', () => {
    const next = reduce(seeded, {
      kind: 'importData',
      mode: 'replace',
      transactions: importedTxs,
      cats: { income: [], expense: ['Rent', 'Groceries'] },
    });
    expect(next.tx).toHaveLength(2);
    expect(next.tx.map((t) => t.id)).toEqual(['new1', 'new2']);
    expect(next.cats.income).toEqual([]);
    expect(next.cats.expense).toEqual(['Rent', 'Groceries']);
  });

  it('append mode concatenates txs and unions categories without duplicates', () => {
    const next = reduce(seeded, {
      kind: 'importData',
      mode: 'append',
      transactions: importedTxs,
      cats: { income: ['Salary', 'Bonus'], expense: ['Rent', 'Groceries'] },
    });
    expect(next.tx.map((t) => t.id)).toEqual(['old1', 'new1', 'new2']);
    expect(next.cats.income).toEqual(['Salary', 'Bonus']);
    expect(next.cats.expense).toEqual(['Rent', 'Groceries']);
  });

  it('does not mutate the input state', () => {
    const before = JSON.stringify(seeded);
    reduce(seeded, {
      kind: 'importData',
      mode: 'replace',
      transactions: importedTxs,
      cats: { income: [], expense: [] },
    });
    expect(JSON.stringify(seeded)).toBe(before);
  });
});

describe('reduce: seedOpeningBalances', () => {
  const baseAction = {
    bankTxId: 'btx',
    cashTxId: 'ctx',
    dateIso: '2026-05-16',
    categoryName: 'Opening balance',
    bankDescription: 'Initial bank balance',
    cashDescription: 'Initial cash balance',
  };

  it('is a no-op when both buckets are zero', () => {
    const next = reduce(blank, {
      kind: 'seedOpeningBalances',
      bank: 0,
      cash: 0,
      ...baseAction,
    });
    expect(next).toBe(blank);
  });

  it('creates one bank income transaction and the category when only bank is non-zero', () => {
    const next = reduce(blank, {
      kind: 'seedOpeningBalances',
      bank: 1000,
      cash: 0,
      ...baseAction,
    });
    expect(next.tx).toHaveLength(1);
    expect(next.tx[0]).toMatchObject({
      id: 'btx',
      type: 'income',
      bucket: 'bank',
      amount: 1000,
      category: 'Opening balance',
      date: '2026-05-16',
    });
    expect(next.cats.income).toEqual(['Opening balance']);
  });

  it('creates one cash income transaction when only cash is non-zero', () => {
    const next = reduce(blank, {
      kind: 'seedOpeningBalances',
      bank: 0,
      cash: 200,
      ...baseAction,
    });
    expect(next.tx).toHaveLength(1);
    expect(next.tx[0]).toMatchObject({ id: 'ctx', bucket: 'cash', amount: 200 });
  });

  it('creates both transactions when both buckets are non-zero', () => {
    const next = reduce(blank, {
      kind: 'seedOpeningBalances',
      bank: 1000,
      cash: 200,
      ...baseAction,
    });
    expect(next.tx).toHaveLength(2);
    expect(next.tx.map((t) => t.bucket)).toEqual(['bank', 'cash']);
    expect(next.cats.income).toEqual(['Opening balance']);
  });

  it('does not duplicate an existing category', () => {
    const seeded: AppData = {
      tx: [],
      cats: { income: ['Opening balance'], expense: [] },
      recurring: [],
    };
    const next = reduce(seeded, {
      kind: 'seedOpeningBalances',
      bank: 1000,
      cash: 0,
      ...baseAction,
    });
    expect(next.cats.income).toEqual(['Opening balance']);
  });

  it('does not mutate the input state', () => {
    const before = JSON.stringify(blank);
    reduce(blank, {
      kind: 'seedOpeningBalances',
      bank: 1000,
      cash: 200,
      ...baseAction,
    });
    expect(JSON.stringify(blank)).toBe(before);
  });
});

describe('describeAction: seedOpeningBalances', () => {
  const baseAction = {
    bankTxId: 'btx',
    cashTxId: 'ctx',
    dateIso: '2026-05-16',
    categoryName: 'رصيد افتتاحي',
    bankDescription: '',
    cashDescription: '',
  };
  it('describes a both-bucket seed with both bucket labels and amounts', () => {
    const s = describeAction(
      blank,
      { kind: 'seedOpeningBalances', bank: 1000, cash: 200, ...baseAction },
      tAr,
    );
    expect(s).toContain(messages.ar['undo.firstRunSeed']);
    expect(s).toContain(messages.ar['bucket.bank']);
    expect(s).toContain(messages.ar['bucket.cash']);
    expect(s).toContain('1,000');
    expect(s).toContain('200');
  });
  it('describes a bank-only seed with just the bank label', () => {
    const s = describeAction(
      blank,
      { kind: 'seedOpeningBalances', bank: 500, cash: 0, ...baseAction },
      tAr,
    );
    expect(s).toContain(messages.ar['bucket.bank']);
    expect(s).not.toContain(messages.ar['bucket.cash']);
  });
});

describe('describeAction: importData', () => {
  it('describes append mode with the transaction count', () => {
    const s = describeAction(
      blank,
      {
        kind: 'importData',
        mode: 'append',
        transactions: [
          {
            id: 'a',
            date: '2026-04-01',
            type: 'income',
            category: 'X',
            description: '',
            amount: 10,
            attachments: [],
            bucket: 'bank',
          },
          {
            id: 'b',
            date: '2026-04-02',
            type: 'expense',
            category: 'Y',
            description: '',
            amount: 20,
            attachments: [],
            bucket: 'bank',
          },
        ],
        cats: { income: [], expense: [] },
      },
      tAr,
    );
    expect(s).toContain(messages.ar['undo.importAppend']);
    expect(s).toContain('2');
  });

  it('describes replace mode with the transaction count', () => {
    const s = describeAction(
      blank,
      {
        kind: 'importData',
        mode: 'replace',
        transactions: [],
        cats: { income: [], expense: [] },
      },
      tAr,
    );
    expect(s).toContain(messages.ar['undo.importReplace']);
    expect(s).toContain('0');
  });
});

describe('reduce: recurring rules', () => {
  const baseRule = {
    id: 'rule-1',
    type: 'expense' as const,
    category: 'Rent',
    description: 'Monthly rent',
    amount: 500,
    bucket: 'bank' as const,
    dayOfMonth: 1,
    startDate: '2026-01-01',
    lastMaterialized: '2026-01-01',
  };

  const firstTx = {
    id: 'tx-1',
    date: '2026-01-01',
    type: 'expense' as const,
    category: 'Rent',
    description: 'Monthly rent',
    amount: 500,
    attachments: [],
    bucket: 'bank' as const,
    recurringId: 'rule-1',
  };

  it('addRecurring stores the rule and appends the supplied due transactions', () => {
    const next = reduce(blank, { kind: 'addRecurring', rule: baseRule, txs: [firstTx] });
    expect(next.recurring).toHaveLength(1);
    expect(next.tx).toHaveLength(1);
    expect(next.tx[0]).toMatchObject({
      id: 'tx-1',
      date: '2026-01-01',
      type: 'expense',
      amount: 500,
      recurringId: 'rule-1',
    });
  });

  it('addRecurring creates no transaction when nothing is due yet (future start)', () => {
    const next = reduce(blank, { kind: 'addRecurring', rule: baseRule, txs: [] });
    expect(next.recurring).toHaveLength(1);
    expect(next.tx).toHaveLength(0);
  });

  it('addRecurring rejects a non-positive amount and an invalid transfer', () => {
    expect(reduce(blank, { kind: 'addRecurring', rule: { ...baseRule, amount: 0 }, txs: [] })).toBe(
      blank,
    );
    const badTransfer = {
      ...baseRule,
      type: 'transfer' as const,
      bucket: 'bank' as const,
      toBucket: 'bank' as const,
    };
    expect(reduce(blank, { kind: 'addRecurring', rule: badTransfer, txs: [] })).toBe(blank);
  });

  it('updateRecurring edits the rule without touching generated transactions', () => {
    const added = reduce(blank, { kind: 'addRecurring', rule: baseRule, txs: [firstTx] });
    const edited = reduce(added, {
      kind: 'updateRecurring',
      id: 'rule-1',
      rule: { ...baseRule, amount: 750 },
    });
    expect(edited.recurring[0].amount).toBe(750);
    // The already-generated transaction keeps its original amount.
    expect(edited.tx[0].amount).toBe(500);
  });

  it('deleteRecurring removes the rule but keeps generated transactions', () => {
    const added = reduce(blank, { kind: 'addRecurring', rule: baseRule, txs: [firstTx] });
    const deleted = reduce(added, { kind: 'deleteRecurring', id: 'rule-1' });
    expect(deleted.recurring).toHaveLength(0);
    expect(deleted.tx).toHaveLength(1);
  });

  it('materializeRecurring appends txs and advances the watermark', () => {
    const added = reduce(blank, { kind: 'addRecurring', rule: baseRule, txs: [firstTx] });
    const generated = {
      id: 'tx-2',
      date: '2026-02-01',
      type: 'expense' as const,
      category: 'Rent',
      description: 'Monthly rent',
      amount: 500,
      attachments: [],
      bucket: 'bank' as const,
      recurringId: 'rule-1',
    };
    const next = reduce(added, {
      kind: 'materializeRecurring',
      txs: [generated],
      throughDate: '2026-02-15',
    });
    expect(next.tx).toHaveLength(2);
    expect(next.recurring[0].lastMaterialized).toBe('2026-02-15');
  });

  it('materializeRecurring with no txs is a no-op (same reference, no snapshot)', () => {
    const added = reduce(blank, { kind: 'addRecurring', rule: baseRule, txs: [firstTx] });
    const next = reduce(added, {
      kind: 'materializeRecurring',
      txs: [],
      throughDate: '2026-12-31',
    });
    expect(next).toBe(added);
  });

  it('describes recurring actions for the undo label', () => {
    expect(
      describeAction(blank, { kind: 'addRecurring', rule: baseRule, txs: [] }, tAr),
    ).toContain(messages.ar['undo.addRecurring']);
    const added = reduce(blank, { kind: 'addRecurring', rule: baseRule, txs: [firstTx] });
    expect(describeAction(added, { kind: 'deleteRecurring', id: 'rule-1' }, tAr)).toContain(
      messages.ar['undo.deleteRecurring'],
    );
  });
});

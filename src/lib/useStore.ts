import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AppData,
  Attachment,
  Categories,
  History,
  RecurringInput,
  RecurringRule,
  Screen,
  Transaction,
} from '../types';
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  current,
  currentData,
  redo,
  redoSnapshot,
  restore,
  undo,
  undoSnapshot,
} from './history';
import {
  actionToDescriptor,
  formatDescriptor,
  INIT_DATA,
  reduce,
  type Action,
  type CategoryType,
} from './reducer';
import { emptyDisk, load, makeDeviceId, save } from './persist';
import { monthlyOccurrences, occurrenceToTx, pendingOccurrences, prevDayIso } from './recurrence';
import { useT } from '../i18n/LangProvider';
import { todayIso } from './format';
import type { CurrencyCode } from './currency';

export type { RecurringInput } from '../types';

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export type Store = {
  ready: boolean;
  data: AppData;
  history: History;
  screen: Screen;
  setScreen: (s: Screen) => void;

  currency: CurrencyCode | null;
  isFirstRun: boolean;
  setCurrency: (code: CurrencyCode) => void;
  completeFirstRun: (input: {
    currency: CurrencyCode;
    bankOpening: number;
    cashOpening: number;
  }) => void;

  addTx: (tx: Omit<Transaction, 'id'>) => void;
  editTx: (id: string, tx: Omit<Transaction, 'id'>) => void;
  deleteTx: (id: string) => void;
  addRecurring: (input: RecurringInput) => void;
  editRecurring: (id: string, input: RecurringInput) => void;
  deleteRecurring: (id: string) => void;
  addCategory: (type: CategoryType, name: string) => void;
  removeCategory: (type: CategoryType, name: string) => void;
  addAttachment: (txId: string, attachment: Attachment) => void;
  removeAttachment: (txId: string, attachmentId: string) => void;
  importData: (
    mode: 'append' | 'replace',
    transactions: Transaction[],
    cats: Categories,
  ) => void;

  undo: () => void;
  redo: () => void;
  restoreSnapshot: (id: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
};

export function useStore(): Store {
  const { t } = useT();
  const [history, setHistory] = useState<History>(() =>
    createHistory(INIT_DATA, { labels: { root: t('history.rootLabel') } }),
  );
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [currency, setCurrencyState] = useState<CurrencyCode | null>(null);
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [screen, setScreen] = useState<Screen>('dashboard');
  const lastSavedRef = useRef<string | null>(null);
  const tRef = useRef(t);
  const deviceIdRef = useRef<string | null>(null);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  // Load from disk once on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await load();
      if (cancelled) return;
      if (loaded) {
        setHistory(loaded.history);
        setDeviceId(loaded.deviceId);
        setCurrencyState(loaded.currency);
        // Deliberately do NOT seed lastSavedRef here. After a load we don't
        // know if parseAndMigrate had to migrate (e.g. v3 → v4 generates
        // deviceId, v4 → v5 backfills currency); seeding the ref would let
        // the save-skip optimisation see "already saved" and leave the disk
        // on the pre-migration schema. Letting the first save effect run
        // unconditionally writes the migrated form to disk; subsequent saves
        // still dedupe normally.
      } else {
        setDeviceId(makeDeviceId());
        setIsFirstRun(true);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced auto-save whenever the history or currency changes.
  // Skipped while currency is null (first-run window pre-modal-completion)
  // so we never persist an incomplete file to disk.
  useEffect(() => {
    if (!ready || !deviceId || !currency) return;
    const handle = window.setTimeout(() => {
      const disk = emptyDisk(history, deviceId, currency);
      const serialized = JSON.stringify(disk);
      if (serialized === lastSavedRef.current) return;
      lastSavedRef.current = serialized;
      void save(disk);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [history, ready, deviceId, currency]);

  // Catch-up materialization: once after load, generate every recurring
  // occurrence that came due while the app was closed (backfilling missed
  // months) as a single undo-tree snapshot. No-op when nothing is due.
  const materializedRef = useRef(false);
  useEffect(() => {
    if (!ready || materializedRef.current) return;
    materializedRef.current = true;
    setHistory((h) => {
      const data = currentData(h);
      if (data.recurring.length === 0) return h;
      const today = todayIso();
      const pending = pendingOccurrences(data.recurring, today);
      if (pending.length === 0) return h;
      const txs = pending.map((p) => occurrenceToTx(p.rule, p.date, newId()));
      const action: Action = { kind: 'materializeRecurring', txs, throughDate: today };
      const next = reduce(data, action);
      if (next === data) return h;
      const descriptor = actionToDescriptor(data, action);
      const label = formatDescriptor(descriptor, tRef.current);
      return commit(
        h,
        next,
        label,
        { deviceId: deviceIdRef.current ?? undefined },
        descriptor,
      );
    });
  }, [ready]);

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
  }, []);

  const completeFirstRun = useCallback(
    ({
      currency: chosen,
      bankOpening,
      cashOpening,
    }: {
      currency: CurrencyCode;
      bankOpening: number;
      cashOpening: number;
    }) => {
      setCurrencyState(chosen);
      setIsFirstRun(false);
      const bank = Number.isFinite(bankOpening) && bankOpening > 0 ? bankOpening : 0;
      const cash = Number.isFinite(cashOpening) && cashOpening > 0 ? cashOpening : 0;
      if (bank === 0 && cash === 0) return;
      setHistory((h) => {
        const data = currentData(h);
        const action: Action = {
          kind: 'seedOpeningBalances',
          bank,
          cash,
          bankTxId: newId(),
          cashTxId: newId(),
          dateIso: todayIso(),
          categoryName: tRef.current('category.openingBalance'),
          bankDescription: tRef.current('tx.openingBalance.bank'),
          cashDescription: tRef.current('tx.openingBalance.cash'),
        };
        const next = reduce(data, action);
        if (next === data) return h;
        const descriptor = actionToDescriptor(data, action);
        const label = formatDescriptor(descriptor, tRef.current);
        return commit(
          h,
          next,
          label,
          { deviceId: deviceIdRef.current ?? undefined },
          descriptor,
        );
      });
    },
    [],
  );

  const apply = useCallback((action: Action) => {
    setHistory((h) => {
      const data = currentData(h);
      const next = reduce(data, action);
      if (next === data) return h;
      const descriptor = actionToDescriptor(data, action);
      const label = formatDescriptor(descriptor, tRef.current);
      return commit(
        h,
        next,
        label,
        { deviceId: deviceIdRef.current ?? undefined },
        descriptor,
      );
    });
  }, []);

  const data = current(history).data;
  const undoSnap = undoSnapshot(history);
  const redoSnap = redoSnapshot(history);
  const undoLabel = undoSnap
    ? undoSnap.descriptor
      ? formatDescriptor(undoSnap.descriptor, t)
      : undoSnap.label
    : null;
  const redoLabel = redoSnap
    ? redoSnap.descriptor
      ? formatDescriptor(redoSnap.descriptor, t)
      : redoSnap.label
    : null;

  return {
    ready,
    data,
    history,
    screen,
    setScreen,
    currency,
    isFirstRun,
    setCurrency,
    completeFirstRun,
    addTx: (tx) => apply({ kind: 'addTx', tx, id: newId() }),
    editTx: (id, tx) => apply({ kind: 'updateTx', id, tx }),
    deleteTx: (id) => apply({ kind: 'deleteTx', id }),
    addRecurring: (input) => {
      const id = newId();
      const today = todayIso();
      // Occurrences already due (startDate..today). A future startDate yields
      // none — those get backfilled later, so the balance is never skewed by a
      // not-yet-happened entry.
      const dueDates = monthlyOccurrences(input.dayOfMonth, prevDayIso(input.startDate), today);
      const lastMaterialized = dueDates.length > 0 ? today : prevDayIso(input.startDate);
      const rule: RecurringRule = { ...input, id, lastMaterialized };
      const txs = dueDates.map((date) => occurrenceToTx(rule, date, newId()));
      apply({ kind: 'addRecurring', rule, txs });
    },
    editRecurring: (id, input) => {
      const existing = data.recurring.find((r) => r.id === id);
      if (!existing) return;
      // Preserve the watermark and original start so an edit never re-backfills.
      const rule: RecurringRule = {
        ...existing,
        ...input,
        id,
        startDate: existing.startDate,
        lastMaterialized: existing.lastMaterialized,
      };
      apply({ kind: 'updateRecurring', id, rule });
    },
    deleteRecurring: (id) => apply({ kind: 'deleteRecurring', id }),
    addCategory: (type, name) => apply({ kind: 'addCategory', type, name }),
    removeCategory: (type, name) => apply({ kind: 'removeCategory', type, name }),
    addAttachment: (txId, attachment) => apply({ kind: 'addAttachment', txId, attachment }),
    removeAttachment: (txId, attachmentId) =>
      apply({ kind: 'removeAttachment', txId, attachmentId }),
    importData: (mode, transactions, cats) =>
      apply({ kind: 'importData', mode, transactions, cats }),
    undo: () => setHistory((h) => undo(h)),
    redo: () => setHistory((h) => redo(h)),
    restoreSnapshot: (id) =>
      setHistory((h) =>
        restore(h, id, { labels: { restorePrefix: tRef.current('history.restorePrefix') } }),
      ),
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    undoLabel,
    redoLabel,
  };
}

export type Cats = Categories;

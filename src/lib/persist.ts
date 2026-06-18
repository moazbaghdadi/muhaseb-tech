import type { DiskFormat, History } from '../types';
import { loadTauri, saveTauri } from './persist-tauri';
import { loadWeb, saveWeb } from './persist-web';
import { DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode } from './currency';

const SCHEMA_VERSION = 7 as const;

// v5 → v6: the AppData inside every snapshot gained a `recurring` array.
// Backfill it to [] on any node that predates the field so downstream code can
// rely on `data.recurring` always being present. Idempotent; safe to run on
// already-migrated history too.
function backfillRecurring(history: History): History {
  let changed = false;
  const nodes: History['nodes'] = {};
  for (const [id, node] of Object.entries(history.nodes)) {
    const data = node.data as { recurring?: unknown };
    if (Array.isArray(data.recurring)) {
      nodes[id] = node;
    } else {
      changed = true;
      nodes[id] = { ...node, data: { ...node.data, recurring: [] } };
    }
  }
  return changed ? { ...history, nodes } : history;
}

// v6 → v7: the AppData inside every snapshot gained an `opening` field
// ({ bank, cash } starting balances). Backfill it to zeros on any node that
// predates the field. Existing opening-balance *transactions* (seeded by the
// old first-run flow) are deliberately left untouched. Idempotent.
function backfillOpening(history: History): History {
  let changed = false;
  const nodes: History['nodes'] = {};
  for (const [id, node] of Object.entries(history.nodes)) {
    const data = node.data as { opening?: { bank?: unknown; cash?: unknown } };
    const o = data.opening;
    if (o && typeof o.bank === 'number' && typeof o.cash === 'number') {
      nodes[id] = node;
    } else {
      changed = true;
      nodes[id] = { ...node, data: { ...node.data, opening: { bank: 0, cash: 0 } } };
    }
  }
  return changed ? { ...history, nodes } : history;
}

// Bring an on-disk history's snapshots up to the current AppData shape. Each
// backfill is idempotent, so this is safe on already-current data.
function migrateHistory(history: History): History {
  return backfillOpening(backfillRecurring(history));
}

export const FILE = 'data.json';
export const TMP_FILE = 'data.json.tmp';
export const APP_DIR = 'muhaseb-tech';
export const WEB_KEY = 'muhaseb-tech:data';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function makeDeviceId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function load(): Promise<DiskFormat | null> {
  return isTauri() ? loadTauri() : loadWeb();
}

export async function save(d: DiskFormat): Promise<void> {
  return isTauri() ? saveTauri(d) : saveWeb(d);
}

export function emptyDisk(
  history: DiskFormat['history'],
  deviceId: string,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): DiskFormat {
  return { schemaVersion: SCHEMA_VERSION, history, deviceId, currency };
}

export function parseAndMigrate(parsed: unknown): DiskFormat | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as {
    schemaVersion?: unknown;
    history?: unknown;
    deviceId?: unknown;
    currency?: unknown;
    serverState?: unknown;
  };
  if (!obj.history || typeof obj.history !== 'object') return null;

  // v3 → v4: generate a deviceId. Pre-v4 snapshots stay unauthored; the sync
  // layer treats them as authored by this device on first push.
  // v4 → v5: default currency to EUR (preserves current behavior).
  // v5 → v6: backfill `recurring: []` into every snapshot (backfillRecurring).
  // v6 → v7: backfill `opening: { bank: 0, cash: 0 }` (backfillOpening).
  // migrateHistory runs both backfills (idempotent) for every source version.
  if (obj.schemaVersion === 3) {
    return {
      schemaVersion: SCHEMA_VERSION,
      history: migrateHistory(obj.history as History),
      deviceId: makeDeviceId(),
      currency: DEFAULT_CURRENCY,
    };
  }

  if (obj.schemaVersion === 4) {
    const deviceId =
      typeof obj.deviceId === 'string' && obj.deviceId ? obj.deviceId : makeDeviceId();
    return {
      schemaVersion: SCHEMA_VERSION,
      history: migrateHistory(obj.history as History),
      deviceId,
      currency: DEFAULT_CURRENCY,
      ...(obj.serverState ? { serverState: obj.serverState as DiskFormat['serverState'] } : {}),
    };
  }

  if (obj.schemaVersion === 5 || obj.schemaVersion === 6) {
    const deviceId =
      typeof obj.deviceId === 'string' && obj.deviceId ? obj.deviceId : makeDeviceId();
    const currency = isCurrencyCode(obj.currency) ? obj.currency : DEFAULT_CURRENCY;
    return {
      schemaVersion: SCHEMA_VERSION,
      history: migrateHistory(obj.history as History),
      deviceId,
      currency,
      ...(obj.serverState ? { serverState: obj.serverState as DiskFormat['serverState'] } : {}),
    };
  }

  if (obj.schemaVersion === SCHEMA_VERSION) {
    const v7 = parsed as DiskFormat;
    const patch: Partial<DiskFormat> = {};
    if (typeof v7.deviceId !== 'string' || !v7.deviceId) {
      patch.deviceId = makeDeviceId();
    }
    if (!isCurrencyCode(v7.currency)) {
      patch.currency = DEFAULT_CURRENCY;
    }
    const history = migrateHistory(v7.history);
    if (history !== v7.history) patch.history = history;
    return Object.keys(patch).length === 0 ? v7 : { ...v7, ...patch };
  }
  return null;
}

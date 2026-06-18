import { describe, it, expect, vi, beforeEach } from 'vitest';

const fsState = {
  files: new Map<string, string>(),
};

vi.mock('@tauri-apps/plugin-fs', () => {
  const exists = vi.fn(async (p: string) => fsState.files.has(p));
  const mkdir = vi.fn(async () => {});
  const readTextFile = vi.fn(async (p: string) => {
    const v = fsState.files.get(p);
    if (v === undefined) throw new Error('ENOENT');
    return v;
  });
  const writeTextFile = vi.fn(async (p: string, contents: string) => {
    fsState.files.set(p, contents);
  });
  const remove = vi.fn(async (p: string) => {
    fsState.files.delete(p);
  });
  const rename = vi.fn(async (oldP: string, newP: string) => {
    const v = fsState.files.get(oldP);
    if (v === undefined) throw new Error('ENOENT');
    fsState.files.set(newP, v);
    fsState.files.delete(oldP);
  });
  return {
    BaseDirectory: { AppConfig: 'AppConfig' },
    exists,
    mkdir,
    readTextFile,
    writeTextFile,
    remove,
    rename,
  };
});

import { loadTauri as load, saveTauri as save } from './persist-tauri';
import { FILE, TMP_FILE, APP_DIR, emptyDisk } from './persist';
import { createHistory } from './history';
import type { DiskFormat } from '../types';

const FULL_PATH = `${APP_DIR}/${FILE}`;
const TMP_PATH = `${APP_DIR}/${TMP_FILE}`;

beforeEach(() => {
  fsState.files.clear();
  vi.clearAllMocks();
});

describe('load', () => {
  it('returns null when the file is missing', async () => {
    expect(await load()).toBeNull();
  });

  it('returns null on invalid JSON', async () => {
    fsState.files.set(FULL_PATH, '{not json');
    expect(await load()).toBeNull();
  });

  it('returns null on an unknown schema version', async () => {
    fsState.files.set(FULL_PATH, JSON.stringify({ schemaVersion: 99, history: {} }));
    expect(await load()).toBeNull();
  });

  it('returns null when history is missing', async () => {
    fsState.files.set(FULL_PATH, JSON.stringify({ schemaVersion: 3 }));
    expect(await load()).toBeNull();
  });

  it('returns null on a pre-v3 payload — no migrator from v2 (or earlier)', async () => {
    const v2 = { schemaVersion: 2, history: { rootId: 'r', currentId: 'r', nodes: {} } };
    fsState.files.set(FULL_PATH, JSON.stringify(v2));
    expect(await load()).toBeNull();
  });

  it('migrates v3 → v6 by generating a deviceId and defaulting currency to EUR', async () => {
    const v3 = { schemaVersion: 3, history: { rootId: 'r', currentId: 'r', nodes: {} } };
    fsState.files.set(FULL_PATH, JSON.stringify(v3));
    const loaded = await load();
    expect(loaded).not.toBeNull();
    expect(loaded?.schemaVersion).toBe(6);
    expect(loaded?.history).toEqual(v3.history);
    expect(typeof loaded?.deviceId).toBe('string');
    expect(loaded?.deviceId).not.toHaveLength(0);
    expect(loaded?.currency).toBe('EUR');
  });

  it('migrates v4 → v6 by defaulting currency to EUR and preserving deviceId', async () => {
    const v4 = {
      schemaVersion: 4,
      history: { rootId: 'r', currentId: 'r', nodes: {} },
      deviceId: 'existing-device',
    };
    fsState.files.set(FULL_PATH, JSON.stringify(v4));
    const loaded = await load();
    expect(loaded?.schemaVersion).toBe(6);
    expect(loaded?.deviceId).toBe('existing-device');
    expect(loaded?.currency).toBe('EUR');
  });

  it('backfills a missing deviceId during v4 → v6 migration', async () => {
    const incomplete = { schemaVersion: 4, history: { rootId: 'r', currentId: 'r', nodes: {} } };
    fsState.files.set(FULL_PATH, JSON.stringify(incomplete));
    const loaded = await load();
    expect(loaded?.schemaVersion).toBe(6);
    expect(typeof loaded?.deviceId).toBe('string');
    expect(loaded?.deviceId).not.toHaveLength(0);
    expect(loaded?.currency).toBe('EUR');
  });

  it('preserves serverState during v4 → v6 migration', async () => {
    const v4 = {
      schemaVersion: 4,
      history: { rootId: 'r', currentId: 'r', nodes: {} },
      deviceId: 'd',
      serverState: { url: 'https://s', lastSyncedRev: 7, pendingPushIds: ['a'] },
    };
    fsState.files.set(FULL_PATH, JSON.stringify(v4));
    const loaded = await load();
    expect(loaded?.serverState).toEqual(v4.serverState);
    expect(loaded?.currency).toBe('EUR');
  });

  it('backfills an unknown currency on a v5 file to EUR', async () => {
    const broken = {
      schemaVersion: 5,
      history: { rootId: 'r', currentId: 'r', nodes: {} },
      deviceId: 'd',
      currency: 'ZZZ',
    };
    fsState.files.set(FULL_PATH, JSON.stringify(broken));
    const loaded = await load();
    expect(loaded?.schemaVersion).toBe(6);
    expect(loaded?.currency).toBe('EUR');
  });

  it('migrates v5 → v6, backfilling recurring:[] into every snapshot', async () => {
    const v5 = {
      schemaVersion: 5,
      history: {
        rootId: 'r',
        currentId: 'r',
        nodes: {
          r: {
            id: 'r',
            parentId: null,
            childIds: [],
            createdAt: 0,
            label: 'root',
            data: { tx: [], cats: { income: [], expense: [] } },
          },
        },
      },
      deviceId: 'd',
      currency: 'USD',
    };
    fsState.files.set(FULL_PATH, JSON.stringify(v5));
    const loaded = await load();
    expect(loaded?.schemaVersion).toBe(6);
    expect(loaded?.deviceId).toBe('d');
    expect(loaded?.currency).toBe('USD');
    expect(loaded?.history.nodes.r.data.recurring).toEqual([]);
  });

  it('passes through a valid v6 file unchanged', async () => {
    const v6 = {
      schemaVersion: 6,
      history: {
        rootId: 'r',
        currentId: 'r',
        nodes: {
          r: {
            id: 'r',
            parentId: null,
            childIds: [],
            createdAt: 0,
            label: 'root',
            data: { tx: [], cats: { income: [], expense: [] }, recurring: [] },
          },
        },
      },
      deviceId: 'd',
      currency: 'USD',
    };
    fsState.files.set(FULL_PATH, JSON.stringify(v6));
    const loaded = await load();
    expect(loaded).toEqual(v6);
  });

  it('returns the parsed payload on success', async () => {
    const d: DiskFormat = emptyDisk(
      createHistory(
        { tx: [], cats: { income: [], expense: [] }, recurring: [] },
        { idGen: () => 'fixed-id', now: () => 0 },
      ),
      'device-test',
    );
    fsState.files.set(FULL_PATH, JSON.stringify(d));
    const loaded = await load();
    expect(loaded).toEqual(d);
  });
});

describe('save', () => {
  it('writes to tmp first, then renames to the final path (atomic)', async () => {
    const d: DiskFormat = emptyDisk(
      createHistory(
        { tx: [], cats: { income: [], expense: [] }, recurring: [] },
        { idGen: () => 'fixed-id', now: () => 0 },
      ),
      'device-test',
    );
    await save(d);
    // Final file exists, tmp is gone (rename consumed it).
    expect(fsState.files.has(FULL_PATH)).toBe(true);
    expect(fsState.files.has(TMP_PATH)).toBe(false);
    expect(JSON.parse(fsState.files.get(FULL_PATH) as string)).toEqual(d);
  });

  it('overwrites an existing file safely', async () => {
    const a: DiskFormat = emptyDisk(
      createHistory(
        { tx: [], cats: { income: [], expense: [] }, recurring: [] },
        { idGen: () => 'a', now: () => 0 },
      ),
      'device-a',
    );
    const b: DiskFormat = emptyDisk(
      createHistory(
        { tx: [], cats: { income: ['x'], expense: [] }, recurring: [] },
        { idGen: () => 'b', now: () => 0 },
      ),
      'device-b',
    );
    await save(a);
    await save(b);
    expect(fsState.files.has(FULL_PATH)).toBe(true);
    expect(fsState.files.has(TMP_PATH)).toBe(false);
    expect(JSON.parse(fsState.files.get(FULL_PATH) as string)).toEqual(b);
  });
});

describe('round-trip', () => {
  it('save then load returns the same payload', async () => {
    const d: DiskFormat = emptyDisk(
      createHistory(
        { tx: [], cats: { income: ['A'], expense: ['B'] }, recurring: [] },
        { idGen: () => 'rt', now: () => 0 },
      ),
      'device-rt',
    );
    await save(d);
    const loaded = await load();
    expect(loaded).toEqual(d);
  });
});

describe('emptyDisk', () => {
  it('wraps a History with the current schemaVersion and the given deviceId, defaulting currency to EUR', () => {
    const h = createHistory(
      { tx: [], cats: { income: [], expense: [] }, recurring: [] },
      { idGen: () => 'r', now: () => 0 },
    );
    const d = emptyDisk(h, 'device-x');
    expect(d.schemaVersion).toBe(6);
    expect(d.history).toBe(h);
    expect(d.deviceId).toBe('device-x');
    expect(d.currency).toBe('EUR');
  });

  it('accepts an explicit currency', () => {
    const h = createHistory(
      { tx: [], cats: { income: [], expense: [] }, recurring: [] },
      { idGen: () => 'r', now: () => 0 },
    );
    const d = emptyDisk(h, 'device-x', 'SAR');
    expect(d.currency).toBe('SAR');
  });
});

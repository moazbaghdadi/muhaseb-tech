import { describe, it, expect } from 'vitest';
import {
  HISTORY_CAP,
  canRedo,
  canUndo,
  commit,
  createHistory,
  current,
  currentData,
  listChronological,
  redo,
  redoLabel,
  restore,
  size,
  undo,
  undoLabel,
  type HistoryDeps,
} from './history';
import type { AppData } from '../types';

const empty: AppData = {
  tx: [],
  cats: { income: [], expense: [] },
  recurring: [],
  opening: { bank: 0, cash: 0 },
};

function withTx(label: string): AppData {
  return {
    tx: [
      {
        id: label,
        date: '2026-04-01',
        type: 'income',
        category: 'X',
        description: '',
        amount: 1,
        attachments: [],
        bucket: 'bank',
      },
    ],
    cats: { income: [], expense: [] },
    recurring: [],
    opening: { bank: 0, cash: 0 },
  };
}

/** Deterministic deps: monotonically increasing ids and timestamps. */
function deterministicDeps(): HistoryDeps {
  let i = 0;
  return {
    idGen: () => `n${++i}`,
    now: () => i * 1000,
  };
}

describe('createHistory', () => {
  it('starts with one root snapshot that is current', () => {
    const d = deterministicDeps();
    const h = createHistory(empty, d);
    expect(h.rootId).toBe('n1');
    expect(h.currentId).toBe('n1');
    expect(size(h)).toBe(1);
    expect(current(h).data).toBe(empty);
    expect(current(h).parentId).toBeNull();
  });
});

describe('commit', () => {
  it('appends a child of the current node and advances currentId', () => {
    const d = deterministicDeps();
    let h = createHistory(empty, d);
    h = commit(h, withTx('a'), 'add a', d);
    expect(h.currentId).toBe('n2');
    expect(h.nodes['n1'].childIds).toEqual(['n2']);
    expect(h.nodes['n2'].parentId).toBe('n1');
    expect(currentData(h).tx).toHaveLength(1);
  });

  it('does not mutate the prior history object', () => {
    const d = deterministicDeps();
    const h0 = createHistory(empty, d);
    const before = JSON.stringify(h0);
    commit(h0, withTx('a'), 'add a', d);
    expect(JSON.stringify(h0)).toBe(before);
  });
});

describe('undo / redo on a linear chain', () => {
  it('walks back and forward, preserving data identity', () => {
    const d = deterministicDeps();
    let h = createHistory(empty, d);
    const a = withTx('a');
    const b = withTx('b');
    h = commit(h, a, 'add a', d);
    h = commit(h, b, 'add b', d);
    expect(currentData(h)).toBe(b);
    expect(canUndo(h)).toBe(true);
    expect(canRedo(h)).toBe(false);

    h = undo(h);
    expect(currentData(h)).toBe(a);

    h = undo(h);
    expect(currentData(h)).toBe(empty);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(true);

    // undo at root is a no-op
    const same = undo(h);
    expect(same).toBe(h);

    h = redo(h);
    expect(currentData(h)).toBe(a);
    h = redo(h);
    expect(currentData(h)).toBe(b);
    // redo at leaf is a no-op
    expect(redo(h)).toBe(h);
  });
});

describe('branching after editing post-undo', () => {
  it('creates a sibling branch and preserves the older branch', () => {
    const d = deterministicDeps();
    let h = createHistory(empty, d);
    const a = withTx('a');
    const b = withTx('b');
    const c = withTx('c');
    const dData = withTx('d');

    h = commit(h, a, 'a', d); // n2
    h = commit(h, b, 'b', d); // n3
    h = commit(h, c, 'c', d); // n4
    expect(currentData(h)).toBe(c);

    // Walk back two snapshots to "after a"
    h = undo(h);
    h = undo(h);
    expect(currentData(h)).toBe(a);

    // Edit while not at a leaf → new sibling branch from a
    h = commit(h, dData, 'd', d); // n5

    // a now has TWO children: the older b and the new d
    const aNode = h.nodes['n2'];
    expect(aNode.childIds).toContain('n3');
    expect(aNode.childIds).toContain('n5');
    // The new branch is the most recent — appended last
    expect(aNode.childIds[aNode.childIds.length - 1]).toBe('n5');

    // Older branch is still walkable
    expect(h.nodes['n3'].data).toBe(b);
    expect(h.nodes['n4'].data).toBe(c);

    // Redo from a now follows the most-recent branch (d)
    let h2 = undo(h); // back to a
    expect(currentData(h2)).toBe(a);
    h2 = redo(h2);
    expect(currentData(h2)).toBe(dData);
  });
});

describe('restore', () => {
  it('creates a NEW snapshot that points at the chosen data; old nodes stay intact', () => {
    const d = deterministicDeps();
    let h = createHistory(empty, d);
    const a = withTx('a');
    const b = withTx('b');
    h = commit(h, a, 'a', d); // n2
    h = commit(h, b, 'b', d); // n3
    const sizeBefore = size(h);

    h = restore(h, 'n2', d); // creates n4 with data=a
    expect(size(h)).toBe(sizeBefore + 1);
    expect(currentData(h)).toBe(a);
    // Old snapshots untouched
    expect(h.nodes['n2'].data).toBe(a);
    expect(h.nodes['n3'].data).toBe(b);
    // The restore is a child of where we were (n3), not of the target (n2)
    expect(h.nodes['n4'].parentId).toBe('n3');
    expect(h.nodes['n4'].label).toContain('استرجاع');
  });

  it('is a no-op when restoring the current snapshot', () => {
    const d = deterministicDeps();
    let h = createHistory(empty, d);
    h = commit(h, withTx('a'), 'a', d);
    const before = h;
    h = restore(h, h.currentId, d);
    expect(h).toBe(before);
  });

  it('is a no-op when the snapshot id is unknown', () => {
    const d = deterministicDeps();
    const h = createHistory(empty, d);
    expect(restore(h, 'does-not-exist', d)).toBe(h);
  });
});

describe('undoLabel / redoLabel', () => {
  it('return the label of what would be undone / redone, or null', () => {
    const d = deterministicDeps();
    let h = createHistory(empty, d);
    expect(undoLabel(h)).toBeNull();
    expect(redoLabel(h)).toBeNull();

    h = commit(h, withTx('a'), 'add a', d);
    h = commit(h, withTx('b'), 'add b', d);
    expect(undoLabel(h)).toBe('add b');
    expect(redoLabel(h)).toBeNull();

    h = undo(h);
    expect(undoLabel(h)).toBe('add a');
    expect(redoLabel(h)).toBe('add b');
  });
});

describe('prune', () => {
  it('keeps a long linear chain connected by re-parenting children of dropped nodes', () => {
    const d = deterministicDeps();
    let h = createHistory(empty, d);
    for (let i = 0; i < HISTORY_CAP + 3; i++) {
      h = commit(h, withTx(`t${i}`), `t${i}`, d);
    }
    expect(size(h)).toBe(HISTORY_CAP);
    // Walking back from current still terminates at root and visits every kept node.
    let walked = 0;
    let cur = h.nodes[h.currentId];
    while (cur.parentId) {
      walked++;
      cur = h.nodes[cur.parentId];
    }
    expect(cur.id).toBe(h.rootId);
    expect(walked).toBe(HISTORY_CAP - 1);
  });

  it('keeps the tree at HISTORY_CAP by dropping the oldest leaves', () => {
    const d = deterministicDeps();
    let h = createHistory(empty, d);
    for (let i = 0; i < HISTORY_CAP + 5; i++) {
      h = commit(h, withTx(`t${i}`), `t${i}`, d);
    }
    expect(size(h)).toBe(HISTORY_CAP);
    // root must remain
    expect(h.nodes[h.rootId]).toBeDefined();
    // current must remain
    expect(h.nodes[h.currentId]).toBeDefined();
  });

  it('never drops the current node even if it is the oldest leaf', () => {
    const d = deterministicDeps();
    let h = createHistory(empty, d);
    // Build a long chain
    for (let i = 0; i < HISTORY_CAP + 5; i++) {
      h = commit(h, withTx(`t${i}`), `t${i}`, d);
    }
    // Walk back to a much-earlier snapshot
    for (let i = 0; i < 50; i++) h = undo(h);
    const currentBefore = h.currentId;
    // Add a sibling branch — triggers prune again
    h = commit(h, withTx('extra'), 'extra', d);
    // The previously-current node is still a parent in the tree
    expect(h.nodes[currentBefore]).toBeDefined();
    expect(h.nodes[h.currentId]).toBeDefined();
  });
});

describe('commit + deviceId', () => {
  it('stamps the new snapshot with deviceId when provided in deps', () => {
    const d: HistoryDeps = { ...deterministicDeps(), deviceId: 'device-A' };
    let h = createHistory(empty, d);
    h = commit(h, withTx('a'), 'a', d);
    expect(h.nodes['n2'].deviceId).toBe('device-A');
  });

  it('omits deviceId when none is provided', () => {
    const d = deterministicDeps();
    let h = createHistory(empty, d);
    h = commit(h, withTx('a'), 'a', d);
    expect(h.nodes['n2'].deviceId).toBeUndefined();
  });
});

describe('listChronological', () => {
  it('returns snapshots oldest-first', () => {
    const d = deterministicDeps();
    let h = createHistory(empty, d);
    h = commit(h, withTx('a'), 'a', d);
    h = commit(h, withTx('b'), 'b', d);
    const list = listChronological(h);
    expect(list.map((n) => n.id)).toEqual(['n1', 'n2', 'n3']);
  });
});

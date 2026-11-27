// Операции на устройстве (IndexedDB) и их синхронизация с базой
import { sb } from './supabase.js';
import { createOpsSync } from './sync.js';
import { OP_COLS } from './opcols.js';

const DB = 'aurum.ops', BOX = 'state', KEY = 'ops';

function run(mode, action) {
  return new Promise((ok, fail) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(BOX);
    open.onerror = () => fail(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction(BOX, mode);
      const req = action(tx.objectStore(BOX));
      tx.oncomplete = () => { db.close(); ok(req.result); };
      tx.onerror = tx.onabort = () => { db.close(); fail(tx.error); };
    };
  });
}

export const idbStore = {
  read: () => run('readonly', (s) => s.get(KEY)),
  write: (v) => run('readwrite', (s) => s.put(v, KEY)),
  clear: () => run('readwrite', (s) => s.delete(KEY))
};

const ops = createOpsSync({ sb, store: idbStore, columns: OP_COLS });
export const syncOps = ops.sync;
export const opsRows = ops.rows;
export const clearOps = ops.clear;

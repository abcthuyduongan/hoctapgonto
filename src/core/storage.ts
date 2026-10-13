import type { ContentPack, LearningEvent, PlaySession } from './contracts';
import { packKey } from './validation';
import { sameAttempt } from './sdk';

const DB_NAME = 'bao-an-learning-v3-alpha';
const DB_VERSION = 1;

type SavedPack = { key: string; pack: ContentPack };
let opening: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('Trình duyệt không hỗ trợ IndexedDB.'));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('packs')) db.createObjectStore('packs', {keyPath: 'key'});
        if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', {keyPath: 'sessionId'});
        if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', {keyPath: 'eventId'});
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Không mở được IndexedDB.'));
      request.onblocked = () => reject(new Error('Cơ sở dữ liệu đang bị một tab khác chặn nâng cấp.'));
    }).catch(error => {
      opening = undefined;
      throw error;
    });
  }
  return opening!;
}

async function transact<T>(store: 'packs' | 'sessions' | 'events', mode: IDBTransactionMode, execute: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = execute(tx.objectStore(store));
    let value: T;
    request.onsuccess = () => { value = request.result; };
    request.onerror = () => { /* tx.onerror will reject */ };
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error ?? request.error ?? new Error('Không thể lưu dữ liệu.'));
    tx.onabort = () => reject(tx.error ?? new Error('Giao dịch đã bị hủy.'));
  });
}

export const storage = {
  async savePack(pack: ContentPack): Promise<void> {
    await transact('packs','readwrite',s => s.add({key:packKey(pack),pack} satisfies SavedPack));
  },
  /** Import selected material as one atomic transaction. Existing pack versions are never overwritten. */
  async savePacks(packs: ContentPack[]): Promise<void> {
    if (packs.length === 0) return;
    const db = await openDatabase();
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('packs','readwrite');
      const store=tx.objectStore('packs');
      packs.forEach(pack=>store.add({key:packKey(pack),pack} satisfies SavedPack));
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error??new Error('Không thể nhập bộ học liệu.'));
      tx.onabort=()=>reject(tx.error??new Error('Tệp học liệu có phiên bản trùng, dữ liệu cũ không bị ghi đè.'));
    });
  },
  async listPacks(): Promise<ContentPack[]> {
    const rows = await transact<SavedPack[]>('packs','readonly',s => s.getAll());
    return rows.map(row => row.pack);
  },
  async createSession(session: PlaySession): Promise<void> {
    await transact('sessions','readwrite',s => s.add(session));
  },
  async endSession(sessionId: string, status: 'completed' | 'abandoned'): Promise<void> {
    const db = await openDatabase();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sessions','readwrite');
      const store = tx.objectStore('sessions');
      let failure: Error | undefined;
      const abort = (message: string) => {failure = new Error(message);tx.abort();};
      const req = store.get(sessionId);
      req.onsuccess = () => {
        const current = req.result as PlaySession | undefined;
        if (!current) return abort('Không tìm thấy phiên chơi.');
        if (current.status === status) return; // idempotent same-state completion
        if (current.status !== 'active') return abort('Phiên đã kết thúc với trạng thái khác.');
        store.put({...current, status, endedAt:new Date().toISOString()} satisfies PlaySession);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(failure ?? tx.error ?? new Error('Không thể hoàn tất phiên.'));
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Phiên bị hủy.'));
    });
  },
  async listSessions(): Promise<PlaySession[]> {
    return transact<PlaySession[]>('sessions','readonly',s => s.getAll());
  },
  async addEvent(event: LearningEvent): Promise<void> {
    // Atomic, cross-tab consistency: session must still be active and eventId is idempotent.
    const db = await openDatabase();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['sessions','events'],'readwrite');
      const sessions = tx.objectStore('sessions');
      const events = tx.objectStore('events');
      let failure: Error | undefined;
      const abort = (message:string) => {failure=new Error(message);tx.abort();};
      const prior = events.get(event.eventId);
      prior.onsuccess = () => {
        const existing = prior.result as LearningEvent | undefined;
        if (existing) {
          if (!sameAttempt(existing,event)) abort('Trùng khóa lượt thử nhưng kết quả khác nhau.');
          return; // identical retry: no additional record
        }
        const request = sessions.get(event.sessionId);
        request.onsuccess = () => {
          const session = request.result as PlaySession | undefined;
          if (!session || session.status !== 'active') return abort('Phiên không hoạt động, không thể ghi lượt thử.');
          if (session.packId !== event.packId || session.contentVersion !== event.contentVersion
              || session.moduleId !== event.moduleId || session.moduleVersion !== event.moduleVersion) {
            return abort('Metadata lượt thử không khớp phiên.');
          }
          events.add(event);
        };
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(failure ?? tx.error ?? new Error('Không thể lưu lượt thử.'));
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Giao dịch lượt thử bị hủy.'));
    });
  },
  async listEvents(): Promise<LearningEvent[]> {
    return transact<LearningEvent[]>('events','readonly',s => s.getAll());
  }
};

export interface ChatMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const DB_NAME = 'jiki-claude-coding';
const STORE_NAME = 'messages';
const PAGE_SIZE = 50;

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveMessage(msg: ChatMessageRecord): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(msg);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadRecentMessages(limit: number = PAGE_SIZE): Promise<ChatMessageRecord[]> {
  const db = await openDB();
  return new Promise<ChatMessageRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('timestamp');
    const request = index.openCursor(null, 'prev');
    const results: ChatMessageRecord[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value as ChatMessageRecord);
        cursor.continue();
      } else {
        resolve(results.reverse());
      }
    };

    request.onerror = () => reject(request.error);
  });
}

export async function loadMessagesBefore(
  timestamp: number,
  limit: number = PAGE_SIZE,
): Promise<ChatMessageRecord[]> {
  const db = await openDB();
  return new Promise<ChatMessageRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('timestamp');
    const range = IDBKeyRange.upperBound(timestamp, true);
    const request = index.openCursor(range, 'prev');
    const results: ChatMessageRecord[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value as ChatMessageRecord);
        cursor.continue();
      } else {
        resolve(results.reverse());
      }
    };

    request.onerror = () => reject(request.error);
  });
}

export async function clearAllMessages(): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLastAssistantCode(): Promise<string | null> {
  const db = await openDB();
  return new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('timestamp');
    const request = index.openCursor(null, 'prev');

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(null);
        return;
      }
      const msg = cursor.value as ChatMessageRecord;
      if (msg.role === 'assistant') {
        const codeMatch = msg.content.match(/```(?:jsx|tsx)?\n([\s\S]*?)```/);
        resolve(codeMatch ? codeMatch[1] : null);
      } else {
        cursor.continue();
      }
    };

    request.onerror = () => reject(request.error);
  });
}

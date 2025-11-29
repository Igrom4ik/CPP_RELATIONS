
import { GraphData } from '../types';

const DB_NAME = 'CPP_RELATIONS_DB';
const STORE_NAME = 'projects';
const KEY = 'current_project';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
        reject(new Error("IndexedDB not supported"));
        return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

export const saveGraphData = async (data: GraphData): Promise<void> => {
  try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(data, KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
  } catch (error) {
      console.error("Failed to save to IndexedDB", error);
      throw error;
  }
};

export const loadGraphData = async (): Promise<GraphData | null> => {
  try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
  } catch (error) {
      console.error("Failed to load from IndexedDB", error);
      return null;
  }
};

export const clearGraphData = async (): Promise<void> => {
  try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
  } catch (error) {
      console.error("Failed to clear IndexedDB", error);
  }
};

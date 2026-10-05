const DB_NAME = "umaFactorChecker";
const DB_VERSION = 1;
const ENTRY_STORE = "factorEntries";
const IMAGE_STORE = "factorImages";

function openFactorLibraryDb(indexedDb = globalThis.indexedDB) {
  if (!indexedDb) return Promise.reject(new Error("IndexedDB is not available"));
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ENTRY_STORE)) db.createObjectStore(ENTRY_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE, { keyPath: "imageId" });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function runStoreRequest(db, storeName, mode, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = operation(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putFactorEntry(entry, indexedDb) { const db = await openFactorLibraryDb(indexedDb); try { await runStoreRequest(db, ENTRY_STORE, "readwrite", store => store.put(entry)); } finally { db.close(); } }
async function getFactorEntry(id, indexedDb) { const db = await openFactorLibraryDb(indexedDb); try { return await runStoreRequest(db, ENTRY_STORE, "readonly", store => store.get(id)); } finally { db.close(); } }
async function listFactorEntries(indexedDb) { const db = await openFactorLibraryDb(indexedDb); try { return await runStoreRequest(db, ENTRY_STORE, "readonly", store => store.getAll()); } finally { db.close(); } }
async function deleteFactorEntry(id, indexedDb) { const db = await openFactorLibraryDb(indexedDb); try { await runStoreRequest(db, ENTRY_STORE, "readwrite", store => store.delete(id)); } finally { db.close(); } }
async function putFactorImage(imageRecord, indexedDb) { const db = await openFactorLibraryDb(indexedDb); try { await runStoreRequest(db, IMAGE_STORE, "readwrite", store => store.put(imageRecord)); } finally { db.close(); } }
async function getFactorImage(imageId, indexedDb) { const db = await openFactorLibraryDb(indexedDb); try { return await runStoreRequest(db, IMAGE_STORE, "readonly", store => store.get(imageId)); } finally { db.close(); } }


function txDone(tx) { return new Promise((resolve,reject)=>{ tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error||new Error("transaction aborted")); }); }
async function listFactorImages(indexedDb) { const db=await openFactorLibraryDb(indexedDb); try{return await runStoreRequest(db,IMAGE_STORE,"readonly",s=>s.getAll());} finally{db.close();} }
async function clearFactorLibrary(indexedDb) { const db=await openFactorLibraryDb(indexedDb); try { const tx=db.transaction([ENTRY_STORE,IMAGE_STORE],"readwrite"); tx.objectStore(ENTRY_STORE).clear(); tx.objectStore(IMAGE_STORE).clear(); await txDone(tx); } finally { db.close(); } }

async function saveFactorEntryWithImages(entry, images = [], indexedDb) {
  const db = await openFactorLibraryDb(indexedDb);
  try {
    const tx = db.transaction([ENTRY_STORE, IMAGE_STORE], "readwrite");
    tx.objectStore(ENTRY_STORE).put(entry);
    const imageStore = tx.objectStore(IMAGE_STORE);
    images.forEach(image => imageStore.put(image));
    await txDone(tx);
  } finally {
    db.close();
  }
}
async function importFactorLibraryRecords(entries=[],images=[],{replace=false,indexedDb}={}) { const db=await openFactorLibraryDb(indexedDb); try { const tx=db.transaction([ENTRY_STORE,IMAGE_STORE],"readwrite"); const es=tx.objectStore(ENTRY_STORE), is=tx.objectStore(IMAGE_STORE); if(replace){es.clear();is.clear();} entries.forEach(e=>es.put(e)); images.forEach(i=>is.put(i)); await txDone(tx); } finally { db.close(); } }

export { DB_NAME, DB_VERSION, ENTRY_STORE, IMAGE_STORE, openFactorLibraryDb, putFactorEntry, getFactorEntry, listFactorEntries, deleteFactorEntry, putFactorImage, getFactorImage, listFactorImages, clearFactorLibrary, importFactorLibraryRecords, saveFactorEntryWithImages };

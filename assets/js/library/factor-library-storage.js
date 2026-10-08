const DB_NAME = "umaFactorChecker";
const DB_VERSION = 2;
const ENTRY_STORE = "factorEntries";
const IMAGE_STORE = "factorImages";
const TAG_STORE = "factorTags";
const FACTOR_LIBRARY_CHANGED_EVENT = "factor-library-changed";

function notifyFactorLibraryChanged() {
  if (typeof document !== "undefined" && typeof Event !== "undefined") document.dispatchEvent(new Event(FACTOR_LIBRARY_CHANGED_EVENT));
}

function openFactorLibraryDb(indexedDb = globalThis.indexedDB) {
  if (!indexedDb) return Promise.reject(new Error("IndexedDB is not available"));
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ENTRY_STORE)) db.createObjectStore(ENTRY_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE, { keyPath: "imageId" });
      if (!db.objectStoreNames.contains(TAG_STORE)) db.createObjectStore(TAG_STORE, { keyPath: "name" });
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

async function putFactorEntry(entry, indexedDb) { const db = await openFactorLibraryDb(indexedDb); try { await runStoreRequest(db, ENTRY_STORE, "readwrite", store => store.put(entry)); } finally { db.close(); } notifyFactorLibraryChanged(); }
async function getFactorEntry(id, indexedDb) { const db = await openFactorLibraryDb(indexedDb); try { return await runStoreRequest(db, ENTRY_STORE, "readonly", store => store.get(id)); } finally { db.close(); } }
async function listFactorEntries(indexedDb) { const db = await openFactorLibraryDb(indexedDb); try { return await runStoreRequest(db, ENTRY_STORE, "readonly", store => store.getAll()); } finally { db.close(); } }
async function deleteFactorEntry(id, indexedDb) { const db = await openFactorLibraryDb(indexedDb); try { await runStoreRequest(db, ENTRY_STORE, "readwrite", store => store.delete(id)); } finally { db.close(); } notifyFactorLibraryChanged(); }
async function putFactorImage(imageRecord, indexedDb) { const db = await openFactorLibraryDb(indexedDb); try { await runStoreRequest(db, IMAGE_STORE, "readwrite", store => store.put(imageRecord)); } finally { db.close(); } }
async function getFactorImage(imageId, indexedDb) { const db = await openFactorLibraryDb(indexedDb); try { return await runStoreRequest(db, IMAGE_STORE, "readonly", store => store.get(imageId)); } finally { db.close(); } }
async function putFactorTag(name, indexedDb) { const tag=String(name||"").trim(); if(!tag)return; const db=await openFactorLibraryDb(indexedDb); try { await runStoreRequest(db,TAG_STORE,"readwrite",store=>store.put({name:tag})); } finally { db.close(); } notifyFactorLibraryChanged(); }
async function listFactorTags(indexedDb) { const db=await openFactorLibraryDb(indexedDb); try { const rows=await runStoreRequest(db,TAG_STORE,"readonly",store=>store.getAll()); const entries=await runStoreRequest(db,ENTRY_STORE,"readonly",store=>store.getAll()); const names=[...new Set([...rows.map(row=>row.name),...entries.flatMap(entry=>entry.tags||[])] .filter(Boolean))]; const stored=new Set(rows.map(row=>row.name)); const missing=names.filter(name=>!stored.has(name)); if(missing.length){const tx=db.transaction(TAG_STORE,"readwrite");const store=tx.objectStore(TAG_STORE);missing.forEach(name=>store.put({name}));await txDone(tx);} return names; } finally { db.close(); } }
async function deleteFactorTag(name,indexedDb) { const db=await openFactorLibraryDb(indexedDb); try { await runStoreRequest(db,TAG_STORE,"readwrite",store=>store.delete(name)); } finally { db.close(); } notifyFactorLibraryChanged(); }

function txDone(tx) { return new Promise((resolve,reject)=>{ tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error||new Error("transaction aborted")); }); }
async function listFactorImages(indexedDb) { const db=await openFactorLibraryDb(indexedDb); try{return await runStoreRequest(db,IMAGE_STORE,"readonly",s=>s.getAll());} finally{db.close();} }
async function clearFactorLibrary(indexedDb) { const db=await openFactorLibraryDb(indexedDb); try { const tx=db.transaction([ENTRY_STORE,IMAGE_STORE,TAG_STORE],"readwrite"); tx.objectStore(ENTRY_STORE).clear(); tx.objectStore(IMAGE_STORE).clear(); tx.objectStore(TAG_STORE).clear(); await txDone(tx); } finally { db.close(); } notifyFactorLibraryChanged(); }

async function saveFactorEntryWithImages(entry, images = [], indexedDb) {
  const db = await openFactorLibraryDb(indexedDb);
  try {
    const tx = db.transaction([ENTRY_STORE, IMAGE_STORE, TAG_STORE], "readwrite");
    tx.objectStore(ENTRY_STORE).put(entry);
    const imageStore = tx.objectStore(IMAGE_STORE);
    images.forEach(image => imageStore.put(image));
    const tagStore=tx.objectStore(TAG_STORE);
    (entry.tags||[]).forEach(name=>tagStore.put({name}));
    await txDone(tx);
  } finally {
    db.close();
  }
  notifyFactorLibraryChanged();
}
async function importFactorLibraryRecords(entries=[],images=[],{replace=false,indexedDb,tags=[]}={}) { const db=await openFactorLibraryDb(indexedDb); try { const tx=db.transaction([ENTRY_STORE,IMAGE_STORE,TAG_STORE],"readwrite"); const es=tx.objectStore(ENTRY_STORE), is=tx.objectStore(IMAGE_STORE), ts=tx.objectStore(TAG_STORE); if(replace){es.clear();is.clear();ts.clear();} entries.forEach(e=>{es.put(e);(e.tags||[]).forEach(name=>ts.put({name}));}); tags.forEach(name=>ts.put({name})); images.forEach(i=>is.put(i)); await txDone(tx); } finally { db.close(); } notifyFactorLibraryChanged(); }

export { DB_NAME, DB_VERSION, ENTRY_STORE, IMAGE_STORE, TAG_STORE, FACTOR_LIBRARY_CHANGED_EVENT, openFactorLibraryDb, putFactorEntry, getFactorEntry, listFactorEntries, deleteFactorEntry, putFactorImage, getFactorImage, putFactorTag, listFactorTags, deleteFactorTag, listFactorImages, clearFactorLibrary, importFactorLibraryRecords, saveFactorEntryWithImages };

const DB_NAME="umaFactorCheckerFactorSets", DB_VERSION=1, STORE="factorSets";
function openDb(indexedDb=globalThis.indexedDB){return new Promise((resolve,reject)=>{if(!indexedDb){reject(new Error("IndexedDB is not available"));return;}const r=indexedDb.open(DB_NAME,DB_VERSION);r.onerror=()=>reject(r.error);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:"id"});};r.onsuccess=()=>resolve(r.result);});}
function request(db,mode,fn){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),r=fn(tx.objectStore(STORE));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function listFactorSets(indexedDb){const db=await openDb(indexedDb);try{return await request(db,"readonly",s=>s.getAll());}finally{db.close();}}
async function putFactorSet(value,indexedDb){const db=await openDb(indexedDb);try{await request(db,"readwrite",s=>s.put(value));}finally{db.close();}}
async function deleteFactorSet(id,indexedDb){const db=await openDb(indexedDb);try{await request(db,"readwrite",s=>s.delete(id));}finally{db.close();}}
export { DB_NAME, STORE, listFactorSets, putFactorSet, deleteFactorSet };

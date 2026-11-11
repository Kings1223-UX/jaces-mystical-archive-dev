/** Jace's Mystical Archive - shared database service, v1.3. */
// Keep normalization and face indexing compatible with the approved v1.2 app.
export function norm(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s*\/\/\s*/g,' // ').replace(/\s+/g,' ').trim()}
function compactCard(c){const fields=['name','type_line','oracle_text','mana_cost','power','toughness','colors'];const o={};for(const k of fields)if(c[k]!==undefined)o[k]=c[k];if(c.card_faces?.length)o.card_faces=c.card_faces.map(f=>{const face={};for(const k of fields)if(f[k]!==undefined)face[k]=f[k];return face});return o}
function addIndexed(map,c){if(!c||!c.name)return;const card=compactCard(c);map.set(norm(card.name),card);if(card.card_faces?.length)for(const face of card.card_faces)if(face.name&&!map.has(norm(face.name)))map.set(norm(face.name),card)}
export function indexCards(data){const map=new Map();for(const c of data)addIndexed(map,c);return map}

export async function loadHostedCards(base = './') {
  const response = await fetch(new URL('cards.json', new URL(base, document.baseURI)), {cache:'no-cache'});
  if (!response.ok) throw Error('Hosted database HTTP ' + response.status);
  const data = await response.json();
  if (!Array.isArray(data) || data.length < 1000) throw Error('Hosted database is missing or incomplete');
  return data;
}
export async function loadDatabaseVersion(base = './') {
  const response = await fetch(new URL('database-version.json', new URL(base, document.baseURI)), {cache:'no-cache'});
  if (!response.ok) throw Error('Database version HTTP ' + response.status);
  return response.json();
}
export function openDb() {
  return new Promise((resolve,reject)=>{
    if (!('indexedDB' in window)) {reject(Error('IndexedDB unavailable'));return;}
    const req=indexedDB.open('mtg-proxy-studio-v05',1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('cards'))req.result.createObjectStore('cards')};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
export async function restoreSavedCards() {
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('cards');const req=tx.objectStore('cards').get('oracle');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
export async function saveCards(map) {
  const db=await openDb();const unique=[...new Set(map.values())];
  await new Promise((resolve,reject)=>{
    const tx=db.transaction('cards','readwrite');tx.objectStore('cards').put(unique,'oracle');
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
export async function clearSavedCards() {
  const db=await openDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction('cards','readwrite');tx.objectStore('cards').delete('oracle');
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
export function searchIndexedCards(map, query, limit=9) {
  const q=norm(query);if(!q)return [];
  const names=new Map();
  for(const [key,c] of map) if(c.name) names.set(key,c.card_faces?.find(f=>norm(f.name)===key)?.name||c.name);
  return [...names.values()].filter(x=>norm(x).includes(q))
    .sort((a,b)=>Number(norm(b).startsWith(q))-Number(norm(a).startsWith(q))||a.length-b.length||a.localeCompare(b)).slice(0,limit);
}

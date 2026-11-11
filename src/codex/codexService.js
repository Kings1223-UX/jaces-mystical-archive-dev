import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from '../config/supabase.js';
let clientPromise;
export function codexClient(){
 if(!clientPromise) clientPromise=import('https://esm.sh/@supabase/supabase-js@2').then(({createClient})=>createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY));
 return clientPromise;
}
async function requireUser(){const client=await codexClient();const {data,error}=await client.auth.getUser();if(error||!data.user)throw Error('Sign in using the Account button first.');return {client,user:data.user};}
export async function listDecks(){const {client,user}=await requireUser();const {data,error}=await client.from('decks').select('id,name,format,commander,updated_at').eq('user_id',user.id).order('updated_at',{ascending:false});if(error)throw error;return data;}
export async function loadDeck(id){const {client}=await requireUser();const {data:deck,error}=await client.from('decks').select('id,name,format,commander').eq('id',id).single();if(error)throw error;const {data:versions,error:ve}=await client.from('deck_versions').select('id,version_number,notes,created_at').eq('deck_id',id).order('version_number',{ascending:false});if(ve)throw ve;const current=versions[0];let cards=[];if(current){const r=await client.from('deck_cards').select('card_name,quantity,board,oracle_id,scryfall_id').eq('deck_version_id',current.id);if(r.error)throw r.error;cards=r.data;}return {deck,versions,cards};}
export async function saveDeck({id,name,format,commander,cards,notes}){const {client}=await requireUser();const {data,error}=await client.rpc('save_codex_deck',{p_deck_id:id||null,p_name:name,p_format:format||'',p_commander:commander||'',p_cards:cards.map(c=>({name:c.name,quantity:c.quantity,board:c.board||'main',oracle_id:c.oracle_id||null,scryfall_id:c.scryfall_id||null})),p_notes:notes||null});if(error)throw error;return data;}
export async function deleteDeck(id){const {client}=await requireUser();const {data,error}=await client.from('decks').delete().eq('id',id).select('id');if(error)throw error;if(!data.length)throw Error('Deck not found or access denied');}

/** Read one immutable snapshot. RLS on both tables enforces deck ownership. */
export async function loadDeckVersion(deckId, versionId){
 const {client}=await requireUser();
 const {data:deck,error:de}=await client.from('decks').select('id,name,format,commander').eq('id',deckId).single();
 if(de)throw de;
 const {data:version,error:ve}=await client.from('deck_versions').select('id,deck_id,version_number,notes,created_at').eq('id',versionId).eq('deck_id',deckId).single();
 if(ve)throw ve;
 const {data:cards,error:ce}=await client.from('deck_cards').select('card_name,quantity,board,oracle_id,scryfall_id').eq('deck_version_id',versionId).order('card_name');
 if(ce)throw ce;
 return {deck,version,cards:cards||[]};
}

/** Compare immutable snapshots. Every lookup is subject to existing RLS. */
export async function compareDeckVersions(deckId, firstVersionId, secondVersionId){
 if(!firstVersionId || !secondVersionId || firstVersionId===secondVersionId) throw Error('Choose two different versions.');
 const [first,second]=await Promise.all([
  loadDeckVersion(deckId,firstVersionId),loadDeckVersion(deckId,secondVersionId)
 ]);
 const identity=c=>`${c.board||'main'}\u0000${(c.card_name||'').normalize('NFKC').toLowerCase()}`;
 const index=list=>{
  const map=new Map();
  for(const c of list){const key=identity(c);const old=map.get(key);if(old)old.quantity+=Number(c.quantity)||0;else map.set(key,{name:c.card_name,board:c.board||'main',quantity:Number(c.quantity)||0});}
  return map;
 };
 const before=index(first.cards),after=index(second.cards);
 const rows=[];
 for(const key of new Set([...before.keys(),...after.keys()])){
  const a=before.get(key),b=after.get(key),from=a?.quantity||0,to=b?.quantity||0;
  if(from!==to)rows.push({name:(b||a).name,board:(b||a).board,from,to,change:to-from});
 }
 rows.sort((a,b)=>a.board.localeCompare(b.board)||a.name.localeCompare(b.name));
 return {first:first.version,second:second.version,rows};
}

/** Restores cards by saving a NEW version through the existing atomic RPC. */
export async function restoreDeckVersion(deckId,versionId){
 const snapshot=await loadDeckVersion(deckId,versionId);
 // Fetch the latest metadata immediately before saving, not historical metadata.
 const {deck}=await loadDeck(deckId);
 const restoredCards=snapshot.cards.map(c=>({name:c.card_name,quantity:c.quantity,board:c.board||'main',oracle_id:c.oracle_id,scryfall_id:c.scryfall_id}));
 const result=await saveDeck({
  id:deckId,name:deck.name,format:deck.format,commander:deck.commander,
  cards:restoredCards,notes:`Restored card list from version ${snapshot.version.version_number}`
 });
 return {result,sourceVersion:snapshot.version.version_number};
}

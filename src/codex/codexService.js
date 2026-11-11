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

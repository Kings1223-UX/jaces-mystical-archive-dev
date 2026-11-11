import {codexClient} from '../codex/codexService.js';
async function session(){const client=await codexClient();const {data,error}=await client.auth.getUser();if(error||!data.user)throw Error('Sign in using the Account button first.');return {client,user:data.user};}
export async function getDeckOptions(){const {client,user}=await session();const {data,error}=await client.from('decks').select('id,name,format,commander').eq('user_id',user.id).order('name');if(error)throw error;return data||[];}
export async function getVersionOptions(deckId){const {client}=await session();const {data,error}=await client.from('deck_versions').select('id,version_number,created_at').eq('deck_id',deckId).order('version_number',{ascending:false});if(error)throw error;return data||[];}
export async function getReports(){const {client,user}=await session();const {data,error}=await client.from('game_reports').select('id,deck_version_id,result,game_format,player_count,turn_count,play_order,mulligans,problems,opponents,notes,played_at').eq('user_id',user.id).order('played_at',{ascending:false}).limit(200);if(error)throw error;return data||[];}
export async function createReport(report){const {client,user}=await session();const payload={...report,user_id:user.id};const {data,error}=await client.from('game_reports').insert(payload).select('id').single();if(error)throw error;return data;}
export async function removeReport(id){const {client,user}=await session();const {data,error}=await client.from('game_reports').delete().eq('id',id).eq('user_id',user.id).select('id');if(error)throw error;if(!data?.length)throw Error('Report not found or access denied.');}

export async function updateReport(id, changes){
  const {client,user}=await session();
  const allowed=['deck_version_id','result','game_format','player_count','turn_count','play_order','mulligans','problems','opponents','notes','played_at'];
  const payload=Object.fromEntries(allowed.filter(k=>Object.prototype.hasOwnProperty.call(changes,k)).map(k=>[k,changes[k]]));
  if(!Object.keys(payload).length)throw Error('No report changes supplied.');
  const {data,error}=await client.from('game_reports').update(payload).eq('id',id).eq('user_id',user.id).select('id').single();
  if(error)throw error;
  return data;
}

export async function getReportDeckLabels(reports){
  const {client,user}=await session();
  const ids=[...new Set(reports.map(r=>r.deck_version_id).filter(Boolean))];
  const labels=new Map();
  if(!ids.length)return labels;
  const {data:versions,error:versionError}=await client.from('deck_versions').select('id,deck_id,version_number').in('id',ids);
  if(versionError)throw versionError;
  const deckIds=[...new Set((versions||[]).map(v=>v.deck_id))];
  if(!deckIds.length)return labels;
  const {data:decks,error:deckError}=await client.from('decks').select('id,name').eq('user_id',user.id).in('id',deckIds);
  if(deckError)throw deckError;
  const byDeck=new Map((decks||[]).map(d=>[d.id,d.name]));
  for(const v of versions||[])if(byDeck.has(v.deck_id))labels.set(v.id,`${byDeck.get(v.deck_id)} — Version ${v.version_number}`);
  return labels;
}

/** Analytics v1.2 Stage B: read-only, version-scoped historical analysis.
 * This module never substitutes the current deck for a missing snapshot.
 */
import {listDecks,loadDeckVersion} from '../codex/codexService.js';
import {loadStatsCatalog,analyzeDeck} from '../codex/deckStats.js';
import {analyzeCardRoles} from '../codex/cardRoles.js';
import {detectGameplayPatterns} from './patternDetection.js';

const OUTCOMES=new Set(['win','loss','draw']);
const validId=id=>typeof id==='string'&&id.trim().length>0;

/** Pure grouping; invalid outcomes are retained for exclusion reporting. */
export function groupReportsByVersion(reports=[]){
 if(!Array.isArray(reports))throw new TypeError('Reports must be an array.');
 const groups=new Map();
 for(const r of reports){
  if(!r||!validId(r.deck_version_id))continue;
  const id=r.deck_version_id;
  if(!groups.has(id))groups.set(id,[]);
  groups.get(id).push(r);
 }
 return groups;
}

/**
 * Analyze reports against immutable deck-version snapshots.
 * Dependencies may be injected for deterministic testing; default calls use RLS-protected Codex services.
 * Returns a row per version, including inaccessible or deleted versions as unavailable.
 */
export async function analyzeHistoricalDecks(reports=[],options={}){
 const groups=groupReportsByVersion(reports);
 const getDecks=options.listDecks||listDecks;
 const getSnapshot=options.loadDeckVersion||loadDeckVersion;
 const getCatalog=options.loadStatsCatalog||loadStatsCatalog;
 const deckAnalyzer=options.analyzeDeck||analyzeDeck;
 const roleAnalyzer=options.analyzeCardRoles||analyzeCardRoles;
 const patternAnalyzer=options.detectGameplayPatterns||detectGameplayPatterns;
 const decks=await getDecks();
 const ownedDecks=new Map((decks||[]).map(d=>[d.id,d]));
 // Resolve only versions belonging to decks visible to this account.
 const lookup=options.lookupVersions||defaultVersionLookup;
 const versionToDeck=await lookup([...groups.keys()],ownedDecks);
 let catalogPromise;
 const catalog=()=>catalogPromise??(catalogPromise=Promise.resolve().then(getCatalog));
 const rows=[];
 for(const [versionId,versionReports] of groups){
  const patterns=patternAnalyzer(versionReports,options.patternOptions||{});
  const deckId=versionToDeck.get(versionId);
  const base={deckVersionId:versionId,deckId:deckId||null,games:patterns.games,patterns,
   reportCount:versionReports.length,invalidOutcomes:versionReports.filter(r=>!OUTCOMES.has(r.result)).length};
  if(!deckId||!ownedDecks.has(deckId)){
   rows.push({...base,status:'unavailable',warning:'Historical deck version unavailable or inaccessible. No current deck substituted.',snapshot:null,statistics:null,roles:null});
   continue;
  }
  try{
   const snapshot=await getSnapshot(deckId,versionId);
   if(!snapshot?.version||snapshot.version.id!==versionId||!Array.isArray(snapshot.cards))throw Error('Invalid historical snapshot');
   const entries=snapshot.cards.map(c=>({name:c.card_name,quantity:Number(c.quantity)||0,board:c.board||'main',oracle_id:c.oracle_id,scryfall_id:c.scryfall_id}));
   const cardCatalog=await catalog();
   rows.push({...base,status:'available',warning:'Deck name, format, and commander may reflect current metadata, not historical values.',
    snapshot:{versionNumber:snapshot.version.version_number,createdAt:snapshot.version.created_at,
     cards:entries,cardCount:entries.reduce((n,c)=>n+c.quantity,0)},
    statistics:deckAnalyzer(entries,cardCatalog),roles:roleAnalyzer(entries,cardCatalog)});
  }catch(error){
   rows.push({...base,status:'unavailable',warning:'Historical snapshot could not be analyzed: '+(error?.message||String(error)),snapshot:null,statistics:null,roles:null});
  }
 }
 return {versions:rows,unlinkedReports:reports.filter(r=>r&&!validId(r.deck_version_id)).length,
  methodology:'Each game is analyzed against its saved deck version. Missing snapshots are not replaced with current deck data. Associations are not causal.'};
}

/** Lookup uses the same authenticated Supabase client as Codex, and limits results to owned decks. */
async function defaultVersionLookup(versionIds,ownedDecks){
 const result=new Map();
 if(!versionIds.length||!ownedDecks.size)return result;
 const {codexClient}=await import('../codex/codexService.js');
 const client=await codexClient();
 const {data:auth,error:authError}=await client.auth.getUser();
 if(authError||!auth?.user)throw Error('Sign in first.');
 for(let offset=0;offset<versionIds.length;offset+=100){
  const {data,error}=await client.from('deck_versions').select('id,deck_id').in('id',versionIds.slice(offset,offset+100));
  if(error)throw error;
  for(const v of data||[])if(ownedDecks.has(v.deck_id))result.set(v.id,v.deck_id);
 }
 return result;
}

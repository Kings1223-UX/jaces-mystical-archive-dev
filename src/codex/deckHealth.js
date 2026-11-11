import {analyzeDeck} from './deckStats.js';
import {analyzeCardRoles,ROLE_LABELS} from './cardRoles.js';

const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().trim();
const COLORS=['W','U','B','R','G','C'];

/** Read-only summary; no performance score or inferred win probability. */
export function analyzeDeckHealth(entries,catalog){
  const stats=analyzeDeck(entries,catalog);
  const roles=analyzeCardRoles(entries,catalog);
  const identity=Object.fromEntries(COLORS.map(c=>[c,0]));
  const demand=Object.fromEntries(COLORS.map(c=>[c,0]));
  const supply=Object.fromEntries(COLORS.map(c=>[c,0]));
  const sources={lands:0,artifacts:0,creatures:0,enchantments:0,other:0,conditional:0};
  const details={sources:[],unknown:[],roles:roles.details};
  for(const entry of entries){
    const q=Number(entry.quantity)||0;
    if(q<=0)continue;
    const card=catalog.get(normalize(entry.name));
    if(!card){details.unknown.push(entry.name);continue;}
    const faces=card.card_faces?.length?card.card_faces:[card];
    const type=card.type_line||faces[0].type_line||'';
    const text=faces.map(f=>f.oracle_text||'').join('\n')||card.oracle_text||'';
    for(const c of card.color_identity||[])if(c in identity)identity[c]+=q;
    const costs=card.mana_cost||faces.map(f=>f.mana_cost||'').join(' ');
    for(const token of costs.matchAll(/\{([^}]+)\}/g)){
      const found=[...new Set(token[1].match(/[WUBRG]/g)||[])];
      for(const c of found)demand[c]+=q;
    }
    const produced=card.produced_mana||[];
    if(!produced.length)continue;
    const group=/\bLand\b/.test(type)?'lands':/\bArtifact\b/.test(type)?'artifacts':/\bCreature\b/.test(type)?'creatures':/\bEnchantment\b/.test(type)?'enchantments':'other';
    sources[group]+=q;
    const conditional=/if |only to cast|spend this mana only|unless |for each|where |opponent controls|choose a color|any color in your commander's color identity/i.test(text);
    if(conditional)sources.conditional+=q;
    for(const c of produced)if(c in supply)supply[c]+=q;
    details.sources.push({name:entry.name,quantity:q,group,colors:produced,conditional});
  }
  const warnings=[];
  if(details.unknown.length)warnings.push(`${details.unknown.length} unmatched card name(s) excluded from some statistics.`);
  if(stats.total&&stats.total!==100)warnings.push(`Deck contains ${stats.total} cards; Commander typically requires 100 including commander(s). Verify board assignments.`);
  warnings.push('Mana production is potential availability, not guaranteed on-curve access. Multi-color sources may count in multiple columns.');
  return {stats,roles,identity,demand,supply,sources,details,warnings,roleLabels:ROLE_LABELS,method:'Descriptive analysis using Scryfall Oracle data and heuristic card roles.'};
}

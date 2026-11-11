/** JMA v1.6.1 Stage B: read-only, conservative Scryfall Oracle analysis. */
let catalogPromise;
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().trim();
const COLORS=['W','U','B','R','G'];
export function loadStatsCatalog(){
  if(!catalogPromise)catalogPromise=fetch('./cards.json').then(r=>{if(!r.ok)throw Error('Card catalog unavailable (HTTP '+r.status+')');return r.json()}).then(cards=>{
    const map=new Map();
    for(const c of cards){if(c.name)map.set(normalize(c.name),c);for(const f of c.card_faces||[])if(f.name&&!map.has(normalize(f.name)))map.set(normalize(f.name),c);}
    return map;
  }).catch(err=>{catalogPromise=null;throw err;});
  return catalogPromise;
}
function cardType(card){return card.type_line||card.card_faces?.[0]?.type_line||'';}
function manaCost(card){return card.mana_cost||card.card_faces?.[0]?.mana_cost||'';}
function colorsOf(card){const c=card.color_identity||[];return c.length?c.filter(x=>COLORS.includes(x)):['C'];}
function coloredSymbols(cost){const out=[];for(const match of String(cost).matchAll(/\{([^}]+)\}/g)){
  const token=match[1].toUpperCase();const parts=token.split('/');
  for(const part of parts)if(COLORS.includes(part))out.push(part);
}return out;}
function produced(card){const p=card.produced_mana||[];return [...new Set(p.filter(x=>COLORS.includes(x)||x==='C'))];}
function isBasicLand(card){return /\bBasic Land\b/i.test(cardType(card));}
function validCmc(card){const v=card.cmc;return typeof v==='number'&&Number.isFinite(v)&&v>=0;}
export function analyzeDeck(entries,catalog,options={}){
 const out={total:0,unique:0,lands:0,nonlands:0,unknown:[],curve:[0,0,0,0,0,0,0,0],curveKnown:0,
  types:{Creature:0,Instant:0,Sorcery:0,Artifact:0,Enchantment:0,Planeswalker:0,Battle:0,Land:0,Other:0},
  colors:{W:0,U:0,B:0,R:0,G:0,C:0},manaRequirements:{W:0,U:0,B:0,R:0,G:0},
  manaSources:{W:0,U:0,B:0,R:0,G:0,C:0},manaProducers:0,averageManaValue:null,validation:[]};
 let weighted=0,seen=0;const grouped=new Map();const commanderName=normalize(options.commander);
 const commander=commanderName?catalog.get(commanderName):null;
 const commanderIdentity=commander?new Set((commander.color_identity||[]).filter(x=>COLORS.includes(x))):null;
 const isCommander=String(options.format||'').trim().toLowerCase()==='commander';
 for(const entry of entries){const q=Number(entry.quantity);if(!Number.isInteger(q)||q<=0)continue;
  out.total+=q;out.unique++;const name=String(entry.name||entry.card_name||'');const card=catalog.get(normalize(name));
  if(!card){out.unknown.push(name);continue;}
  const type=cardType(card);const land=/\bLand\b/.test(type);
  const category=land?'Land':(['Creature','Instant','Sorcery','Artifact','Enchantment','Planeswalker','Battle'].find(t=>type.includes(t))||'Other');
  out.types[category]+=q;if(land)out.lands+=q;else out.nonlands+=q;
  for(const c of colorsOf(card))out.colors[c]+=q;
  for(const c of coloredSymbols(manaCost(card)))out.manaRequirements[c]+=q;
  const p=produced(card);if(p.length){out.manaProducers+=q;for(const c of p)out.manaSources[c]+=q;}
  if(!land&&validCmc(card)){out.curve[Math.min(7,Math.floor(card.cmc))]+=q;out.curveKnown+=q;weighted+=card.cmc*q;seen+=q;}
  const key=normalize(card.oracle_id||card.name||name);const prev=grouped.get(key)||{count:0,card,name};prev.count+=q;grouped.set(key,prev);
  if(isCommander){
    if(card.legalities?.commander==='not_legal'||card.legalities?.commander==='banned')out.validation.push({severity:'error',message:`${name} is not legal in Commander according to the catalog.`});
    if(commanderIdentity&&[...(card.color_identity||[])].some(c=>!commanderIdentity.has(c)))out.validation.push({severity:'error',message:`${name} falls outside the commander's color identity.`});
  }
 }
 out.averageManaValue=seen?weighted/seen:null;
 if(isCommander){
  if(out.total!==100)out.validation.push({severity:'warning',message:`Commander decks normally require 100 cards including commander; current list has ${out.total}. Check whether the commander is included.`});
  if(!commanderName)out.validation.push({severity:'warning',message:'No commander specified; color-identity checks are incomplete.'});
  else if(!commander)out.validation.push({severity:'warning',message:'Commander was not found in the catalog; color-identity checks are incomplete.'});
  for(const {count,card,name} of grouped.values())if(count>1&&!isBasicLand(card))out.validation.push({severity:'warning',message:`${name} has ${count} copies; verify singleton exceptions (e.g., card-specific rules).`});
  out.validation.push({severity:'info',message:'Commander eligibility, partner rules, sideboard handling, and all special exceptions are not fully validated.'});
 }
 return out;
}

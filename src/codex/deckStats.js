/** JMA Stage C1: read-only, conservative mana-source classification. */
let catalogPromise;
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().trim();
const COLORS=['W','U','B','R','G'];
export function loadStatsCatalog(){
 if(!catalogPromise)catalogPromise=fetch('./cards.json').then(r=>{if(!r.ok)throw Error('Card catalog unavailable: '+r.status);return r.json()}).then(cards=>{
  const map=new Map();for(const c of cards){if(c.name)map.set(normalize(c.name),c);for(const f of c.card_faces||[])if(f.name&&!map.has(normalize(f.name)))map.set(normalize(f.name),c)}return map;
 }).catch(e=>{catalogPromise=null;throw e});return catalogPromise;
}
const isType=(s,t)=>new RegExp('\\b'+t+'\\b','i').test(s);
const manaValue=cost=>{let n=0;for(const m of String(cost||'').matchAll(/\{([^}]+)\}/g)){const x=m[1].toUpperCase();if(/^\d+$/.test(x))n+=+x;else if(['X','Y','Z'].includes(x)){}else if(/^2\//.test(x))n+=2;else if(x==='P'){}else n+=1;}return n};
function manaInfo(card){
 const faces=card.card_faces?.length?card.card_faces:[card];
 const type=card.type_line||faces.map(f=>f.type_line||'').join(' // ');
 const text=faces.map(f=>f.oracle_text||'').join('\n')||card.oracle_text||'';
 const land=isType(type,'Land'),artifact=isType(type,'Artifact'),creature=isType(type,'Creature'),enchantment=isType(type,'Enchantment');
 const produced=Array.isArray(card.produced_mana)?card.produced_mana.filter(x=>COLORS.includes(x)||x==='C'):[];
 // Scryfall produced_mana is an indication of potential production, not guaranteed access.
 const hasProduction=produced.length>0 || /add (?:\{[WUBRGC]\}|(?:one|two|three|any|an amount of) mana)/i.test(text);
 const temporary=!land && /add (?:\{[WUBRGC]\}|(?:one|two|three|any|an amount of) mana)/i.test(text) && !/\{T\}\s*:\s*add/i.test(text) && !/whenever .*add .*mana/i.test(text);
 const conditional= /only to cast|spend this mana only|if |unless |for each|where X|opponent controls|choose a color|any color in your commander's color identity|any type that a land/i.test(text);
 let category='other';
 if(hasProduction){if(land)category='lands';else if(artifact)category='rocks';else if(creature)category='creatures';else if(enchantment)category='enchantments';else category='otherSpells';}
 // Acceleration is deliberately a candidate count, not a definitive game-rules conclusion.
 const accelerationCandidate=hasProduction&&!land&&(category==='rocks'||category==='creatures'||category==='enchantments'||temporary);
 return {hasProduction,produced,category,temporary:temporary&&!land,conditional,accelerationCandidate};
}
export function analyzeDeck(cards,catalog){
 const out={total:0,unique:0,lands:0,nonlands:0,unknown:[],curve:Array(8).fill(0),types:{Creature:0,Instant:0,Sorcery:0,Artifact:0,Enchantment:0,Planeswalker:0,Battle:0,Land:0,Other:0},colors:{W:0,U:0,B:0,R:0,G:0,C:0},averageManaValue:null,
  manaSources:{total:0,lands:0,rocks:0,creatures:0,enchantments:0,otherSpells:0,temporary:0,conditional:0,accelerationCandidates:0,byColor:{W:0,U:0,B:0,R:0,G:0,C:0},unknownColor:0},manaNotes:[]};
 let weighted=0,knownNonlands=0;
 for(const entry of cards){const q=Number(entry.quantity)||0;if(q<=0)continue;out.total+=q;out.unique++;const card=catalog.get(normalize(entry.name));if(!card){out.unknown.push(entry.name);continue;}
  const face=card.card_faces?.[0]||card;const type=card.type_line||face.type_line||'';const land=isType(type,'Land');const primary=['Creature','Instant','Sorcery','Artifact','Enchantment','Planeswalker','Battle'].find(t=>isType(type,t))||(land?'Land':'Other');out.types[primary]+=q;
  const info=manaInfo(card);if(info.hasProduction){const m=out.manaSources;m.total+=q;m[info.category]+=q;if(info.temporary)m.temporary+=q;if(info.conditional)m.conditional+=q;if(info.accelerationCandidate)m.accelerationCandidates+=q;if(!info.produced.length)m.unknownColor+=q;else for(const c of new Set(info.produced))m.byColor[c]+=q;}
  if(land){out.lands+=q;continue;}out.nonlands+=q;
  const cost=card.mana_cost||face.mana_cost||'';const mv=typeof card.cmc==='number'?card.cmc:(cost?manaValue(cost):null);if(mv!==null){out.curve[Math.min(7,Math.floor(mv))]+=q;weighted+=mv*q;knownNonlands+=q;}
  const colors=card.colors?.length?card.colors:(face.colors||[]);if(colors.length){for(const c of colors)if(c in out.colors)out.colors[c]+=q;}else out.colors.C+=q;
 }
 out.averageManaValue=knownNonlands?weighted/knownNonlands:null;out.curveKnown=knownNonlands;
 out.manaNotes=['Potential sources are counted by cards, not activations or mana quantity.','Color production reflects Scryfall produced_mana; flexible and conditional sources may be counted in multiple colors.','Temporary and conditional source counts overlap other categories. Acceleration is a candidate classification, not a rules guarantee.'];
 return out;
}

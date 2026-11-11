/** Read-only deck statistics. Uses hosted Oracle card data, never writes deck records. */
let catalogPromise;
export function loadStatsCatalog(){
  if(!catalogPromise) catalogPromise=fetch('./cards.json').then(r=>{if(!r.ok)throw Error('Card catalog unavailable');return r.json()}).then(cards=>{
    const map=new Map();
    for(const c of cards){if(c.name)map.set(normalize(c.name),c);for(const f of c.card_faces||[])if(f.name&&!map.has(normalize(f.name)))map.set(normalize(f.name),c)}
    return map;
  }).catch(err=>{catalogPromise=null;throw err});
  return catalogPromise;
}
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().trim();
const manaValue=cost=>{let total=0;for(const token of String(cost||'').matchAll(/\{([^}]+)\}/g)){const t=token[1].toUpperCase();if(/^\d+$/.test(t))total+=Number(t);else if(t==='X'||t==='Y'||t==='Z'||t==='C'||t==='S'||t==='P')total+=t==='C'||t==='S'?1:0;else if(t.includes('/'))total+=/^2\//.test(t)?2:1;else total+=1;}return total};
export function analyzeDeck(cards,catalog){
 const out={total:0,unique:0,lands:0,nonlands:0,unknown:[],curve:[0,0,0,0,0,0,0,0],types:{Creature:0,Instant:0,Sorcery:0,Artifact:0,Enchantment:0,Planeswalker:0,Battle:0,Land:0,Other:0},colors:{W:0,U:0,B:0,R:0,G:0,C:0},averageManaValue:null};
 let weighted=0,knownNonlands=0;
 for(const entry of cards){const q=Number(entry.quantity)||0;if(q<=0)continue;out.total+=q;out.unique++;const card=catalog.get(normalize(entry.name));if(!card){out.unknown.push(entry.name);continue;}
 const face=card.card_faces?.[0]||card;const type=card.type_line||face.type_line||'';const isLand=/\bLand\b/.test(type);const primary=['Creature','Instant','Sorcery','Artifact','Enchantment','Planeswalker','Battle'].find(t=>type.includes(t))||(isLand?'Land':'Other');out.types[primary]+=q;
 if(isLand){out.lands+=q;continue;}out.nonlands+=q;const cost=card.mana_cost||face.mana_cost||'';if(!cost){continue;}const mv=manaValue(cost);out.curve[Math.min(7,Math.floor(mv))]+=q;weighted+=mv*q;knownNonlands+=q;
 const colors=card.colors?.length?card.colors:(face.colors||[]);if(colors.length){for(const c of colors)if(c in out.colors)out.colors[c]+=q;}else out.colors.C+=q;
 }
 out.averageManaValue=knownNonlands?weighted/knownNonlands:null;out.curveKnown=knownNonlands;return out;
}

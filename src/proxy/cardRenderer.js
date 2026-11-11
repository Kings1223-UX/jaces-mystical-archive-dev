// Stage A: extracted without visual or typography redesign.
const typeSymbols=[['Artifact','A'],['Creature','C'],['Enchantment','E'],['Instant','I'],['Sorcery','S'],['Planeswalker','P'],['Battle','B'],['Land','L']];
function symbolFor(type){for(const [t,s] of typeSymbols)if(type.includes(t))return s;return '?'}
function el(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n}
function addMana(target,cost){const parts=(cost||'').match(/\{[^}]+\}/g)||[];for(const part of parts){const val=part.slice(1,-1);const token=el('span','mana-token'+(val.length>2?' long-token':''),val);token.title=part;target.append(token)}}
const INKS={C:'#808080',W:'#ffffff',U:'#0040ff',B:'#B89AD9',R:'#8f0000',G:'#008f00'}; // RGB previews calculated from supplied CMYK (device conversion may vary)
function inkColors(data){let cs=Array.isArray(data.colors)?data.colors:[];if(!cs.length&&data.card_faces)cs=[...new Set(data.card_faces.flatMap(f=>f.colors||[]))];if(!cs.length){const cost=(data.mana_cost||data.card_faces?.map(f=>f.mana_cost||'').join('')||'');cs=[...new Set((cost.match(/\{[^}]+\}/g)||[]).flatMap(x=>x.match(/[WUBRG]/g)||[]))]}return cs.length?['W','U','B','R','G'].filter(c=>cs.includes(c)):['C']}
function rimFor(data,printMode){if(printMode==='bw')return '#999';const cs=inkColors(data);if(cs.length===1)return INKS[cs[0]];const stops=[];const width=100/cs.length;const transition=Math.min(6,width*.24);cs.forEach((c,i)=>{const start=i*width;const end=(i+1)*width;stops.push(`${INKS[c]} ${Math.max(0,start+(i?transition/2:0)).toFixed(3)}%`);stops.push(`${INKS[c]} ${Math.min(100,end-(i===cs.length-1?0:transition/2)).toFixed(3)}%`)});return `linear-gradient(90deg, ${stops.join(', ')})`}
function fitText(node,base,min){node.style.fontSize=base+'pt';node.style.letterSpacing='0';node.dataset.fitBase=base;node.dataset.fitMin=min;}
// Measure the rendered element, including styled spans and wrapped lines.
export function fitAll(){document.querySelectorAll('#pages [data-fit-base]').forEach(node=>{
 const base=Number(node.dataset.fitBase), min=Number(node.dataset.fitMin);
 node.style.fontSize=base+'pt';node.style.letterSpacing='0';
 const isRules=node.classList.contains('rules');
 const over=()=>node.scrollWidth>node.clientWidth+1||node.scrollHeight>node.clientHeight+1;
 let size=base;
 while(size>min&&over()){size=Math.max(min,Math.round((size-.2)*100)/100);node.style.fontSize=size+'pt';}
 // For long unbreakable names, apply a small horizontal compression only as a last resort.
 if(!isRules&&over()){
   const inner=node.scrollWidth, outer=node.clientWidth;
   if(inner>outer&&outer>0){node.style.fontSize=Math.max(2.4,size*(outer-2)/inner).toFixed(2)+'pt';}
 }
 if(over())node.title=node.textContent;
});}
// Bold keyword-ability labels, italicize reminder text and ability words.
// Oracle text is used verbatim; formatting never rewrites card rules.
const ABILITY_WORDS=new Set(['landfall','magecraft','morbid','revolt','raid','ferocious','formidable','delirium','threshold','metalcraft','constellation','heroic','inspired','battalion','bloodrush','channel','domain','enrage','imprint','join forces','parley','radiance','spectacle','adamant','coven','pack tactics','alliance','corrupted','descend','fateful hour','hellbent','kinship','lieutenant','sweep','undergrowth','will of the council']);
const KEYWORD_ABILITIES=['first strike','double strike','flying','trample','vigilance','haste','deathtouch','lifelink','reach','hexproof','indestructible','menace','defender','flash','ward','prowess','equip','cycling','kicker','multikicker','flashback','escape','embalm','eternalize','affinity','cascade','convoke','delve','dredge','exploit','fabricate','fear','intimidate','landwalk','persist','undying','reconfigure','suspend','toxic','backup','bargain','discover','plot','offspring','impending','mobilize'];
function styledRules(target,raw){
 const lines=String(raw||'').split('\n');
 lines.forEach((line,i)=>{
  if(i)target.append(document.createTextNode('\n'));
  const match=line.match(/^([^—\n]{2,55})\s+—\s+/);
  let offset=0;
  if(match&&ABILITY_WORDS.has(match[1].trim().toLowerCase())){
   const em=document.createElement('em');em.textContent=match[1];target.append(em,document.createTextNode(' — '));offset=match[0].length;
  }
  const rest=line.slice(offset);
  const chunks=rest.split(/(\([^)]*\))/g);
  chunks.forEach((chunk,j)=>{
   if(!chunk)return;
   if(chunk.startsWith('(')&&chunk.endsWith(')')){const em=document.createElement('em');em.textContent=chunk;target.append(em);return;}
   // Only style keywords when they appear as a standalone ability or a comma-separated ability list.
   const plain=chunk.trim().replace(/[.,]$/,'').toLowerCase();
   const segments=plain.split(/,\s*/);
   const isKeywords=segments.length>0&&segments.every(x=>KEYWORD_ABILITIES.includes(x)||KEYWORD_ABILITIES.some(k=>x.startsWith(k+' ')));
   if(isKeywords){const strong=document.createElement('strong');strong.textContent=chunk;target.append(strong)}else target.append(document.createTextNode(chunk));
  });
 });
}
export function buildCard(data,printMode="bw"){const face=data.card_faces?.[0]||data;const name=face.name||data.name||'Unknown';const type=face.type_line||data.type_line||'Unknown';const rules=face.oracle_text||data.oracle_text||'';const card=el('article','card');card.style.setProperty('--rim',rimFor(data,printMode));const title=el('div','name');const nameText=el('span','card-title',name);nameText.title=name;const mana=el('span','mana');addMana(mana,face.mana_cost||data.mana_cost||'');title.append(nameText,mana);const symbol=el('div','symbol',symbolFor(type));const line=el('div','typeline',type);const text=el('div','rules');styledRules(text,rules);card.append(title,symbol,line,text);fitText(nameText,10,2.4);fitText(line,9,3);fitText(text,9,3.2);if(face.power!==undefined&&face.toughness!==undefined)card.append(el('span','pt',face.power+'/'+face.toughness));return card}

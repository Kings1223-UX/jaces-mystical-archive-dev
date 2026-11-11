import {loadStatsCatalog} from './deckStats.js';
import {analyzeDeckHealth} from './deckHealth.js';

const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
function metric(label,value){const n=el('div','jma-health-metric');n.append(el('small','',label),el('strong','',value));return n;}
function section(title){const s=el('section','jma-health-section');s.append(el('h4','',title));return s;}
function breakdown(parent,values,labels={}){const wrap=el('div','jma-health-breakdown');for(const [key,val] of Object.entries(values)){if(!val)continue;const item=el('div','jma-health-chip',`${labels[key]||key}: ${val}`);wrap.append(item);}if(!wrap.childNodes.length)wrap.append(el('p','jma-health-muted','No matches identified.'));parent.append(wrap);}
function disclosure(parent,label,items){const d=el('details','jma-health-details');d.append(el('summary','',label));const list=el('ul');for(const item of items)list.append(el('li','',item));if(!items.length)list.append(el('li','','None identified.'));d.append(list);parent.append(d);}
export function createDeckHealthDashboard(entries){
  const root=el('section','jma-health');
  root.append(el('h3','','Deck Health Overview'),el('p','jma-health-muted','Descriptive statistics · No overall deck score'));
  const state=el('p','jma-health-muted','Loading card catalog…');root.append(state);
  loadStatsCatalog().then(catalog=>{
    if(!root.isConnected)return;
    const h=analyzeDeckHealth(entries,catalog),s=h.stats;
    state.remove();
    const overview=section('Deck overview');const tiles=el('div','jma-health-metrics');
    for(const [label,value] of [['Cards',s.total],['Unique entries',s.unique],['Lands',s.lands],['Average mana value',s.averageManaValue===null?'N/A':s.averageManaValue.toFixed(2)]])tiles.append(metric(label,value));
    overview.append(tiles);breakdown(overview,s.types);root.append(overview);
    const mana=section('Mana health');mana.append(el('p','jma-health-muted','Nonland mana curve (0 through 7+)'));
    const bars=el('div','jma-health-bars');const max=Math.max(1,...s.curve);
    s.curve.forEach((v,i)=>{const col=el('div','jma-health-col');col.append(el('small','',v));const bar=el('div','jma-health-bar');bar.style.height=`${Math.max(2,Math.round(v/max*90))}px`;col.append(bar,el('small','',i===7?'7+':i));bars.append(col);});mana.append(bars);
    mana.append(el('h5','','Potential mana sources'));breakdown(mana,h.sources,{lands:'Lands',artifacts:'Artifacts',creatures:'Creatures',enchantments:'Enchantments',other:'Other',conditional:'Conditional (overlapping)'});
    mana.append(el('h5','','Potential mana colors'));breakdown(mana,h.supply,{W:'White',U:'Blue',B:'Black',R:'Red',G:'Green',C:'Colorless'});
    mana.append(el('h5','','Colored mana symbols in costs'));breakdown(mana,h.demand,{W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'});
    disclosure(mana,'Show identified mana-producing cards',h.details.sources.map(x=>`${x.quantity} × ${x.name} — ${x.group}; ${x.colors.join(', ')||'unknown'}${x.conditional?' (conditional)':''}`));root.append(mana);
    const roles=section('Functional card roles (experimental)');breakdown(roles,h.roles.totals,h.roleLabels);
    disclosure(roles,'Show classified cards',h.details.roles.map(x=>`${x.quantity} × ${x.name}: ${x.roles.map(r=>`${h.roleLabels[r.role]} (${r.confidence})`).join(', ')}`));
    roles.append(el('p','jma-health-muted','Roles overlap and are heuristic, not definitive judgments.'));root.append(roles);
    const validation=section('Validation & data quality');
    const messages=[...h.warnings];
    if(h.roles.unmatched.length)messages.push(`${h.roles.unmatched.length} card(s) unavailable for role classification.`);
    disclosure(validation,'Show notes and limitations',messages);
    validation.append(el('p','jma-health-muted','Full Commander legality and commander identity validation are not performed by this dashboard.'));
    root.append(validation);
  }).catch(err=>{state.textContent=`Dashboard unavailable: ${err.message}`;});
  return root;
}

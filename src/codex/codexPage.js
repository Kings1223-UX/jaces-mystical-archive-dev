import {listDecks,loadDeck,saveDeck,deleteDeck,loadDeckVersion,compareDeckVersions,restoreDeckVersion,codexClient} from './codexService.js';
const e=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
export function initializeCodex({navigate,sendToProxy}){
 const root=document.getElementById('other-page');let active=null,cards=[],busy=false;
 const status=(msg,bad=false)=>{const s=root.querySelector('#codex-status');if(s){s.textContent=msg;s.style.color=bad?'#a32945':'#42648a';}};
 function btn(label,fn,cls='secondary'){const b=e('button',cls,label);b.type='button';b.onclick=fn;return b;}
 function field(label,value='',type='text'){const wrap=e('label','codex-field');wrap.append(e('span','fieldlabel',label));const inp=e('input','textinput');inp.type=type;inp.value=value;wrap.append(inp);return {wrap,input:inp};}
 function parse(raw){return raw.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!/^\s*(commander|deck|sideboard|maybeboard|mainboard):?\s*$/i.test(x)).map(line=>{const m=line.match(/^(\d+)\s*x?\s+(.+?)\s*$/i);return {name:(m?m[2]:line).replace(/\s*\([^)]*\)\s*\d*\s*$/,'').trim(),quantity:m?Number(m[1]):1,board:'main'};}).filter(x=>x.name&&x.quantity>0&&x.quantity<=999);}
 function renderCards(box){box.replaceChildren();if(!cards.length)box.append(e('p','muted','No cards added yet.'));cards.forEach((c,i)=>{const row=e('div','codex-card-row');row.append(e('span','',c.name));const qty=e('input','textinput');qty.type='number';qty.min=1;qty.max=999;qty.value=c.quantity;qty.setAttribute('aria-label','Quantity for '+c.name);qty.onchange=()=>{c.quantity=Math.max(1,Math.min(999,Number(qty.value)||1));qty.value=c.quantity;};row.append(qty,btn('×',()=>{cards.splice(i,1);renderCards(box)},'secondary'));box.append(row);});}
 async function library(){active=null;root.replaceChildren();root.append(e('h2','','Codex'),e('p','muted','Your saved decklists and version history.'));const toolbar=e('div','codex-actions');toolbar.append(btn('+ New deck',()=>editor(null),'primary'),btn('Refresh',library));root.append(toolbar);const list=e('div','codex-library');root.append(list,e('p','help','Loading…'));root.lastChild.id='codex-status';try{const decks=await listDecks();list.replaceChildren();if(!decks.length)list.append(e('p','muted','No saved decks. Create your first deck.'));for(const d of decks){const row=e('div','codex-deck');const info=e('div');info.append(e('strong','',d.name),e('p','muted',[d.format,d.commander].filter(Boolean).join(' · ')||'Unspecified format'));row.append(info,btn('Open',()=>openDeck(d.id)));list.append(row);}status(`${decks.length} saved deck(s).`);}catch(err){status(err.message,true);}}
 async function viewVersion(deckId,versionId){
  root.replaceChildren(e('h2','','Loading historical version…'));
  try{
   const {deck,version,cards:snapshot}=await loadDeckVersion(deckId,versionId);
   root.replaceChildren();
   root.append(e('h2','',`${deck.name} — Version ${version.version_number}`));
   root.append(e('p','muted',`Saved ${new Date(version.created_at).toLocaleString()} · Read-only historical snapshot`));
   const details=e('div','codex-grid');
   details.append(e('p','',`Format: ${deck.format||'Not specified'}`),e('p','',`Current commander field: ${deck.commander||'Not specified'}`));
   root.append(details);
   if(version.notes)root.append(e('p','muted',`Version notes: ${version.notes}`));
   root.append(e('h3','',`Saved cards (${snapshot.reduce((n,c)=>n+c.quantity,0)} total)`));
   const list=e('div','codex-card-list');
   if(!snapshot.length)list.append(e('p','muted','No cards were saved in this version.'));
   for(const c of snapshot){const row=e('div','codex-card-row');row.append(e('span','',`${c.quantity} × ${c.card_name}`),e('span','muted',c.board||'main'));list.append(row);}
   root.append(list);
   const actions=e('div','codex-actions');actions.append(btn('Back to current deck',()=>openDeck(deckId),'primary'),btn('Back to Codex',library));root.append(actions);
   root.append(e('p','help','Historical cards and quantities are read-only. Deck name, format, and commander are shown from the current deck record because earlier versions did not store separate copies of those fields.'));
  }catch(err){root.replaceChildren(e('p','help',`Unable to load version: ${err.message}`),btn('Back to current deck',()=>openDeck(deckId)));}
 }
 async function compareVersions(deckId,versions){
  root.replaceChildren();root.append(e('h2','','Compare deck versions'),e('p','muted','Compare saved card quantities. Changes are calculated from the first version to the second.'));
  if(versions.length<2){root.append(e('p','muted','Save at least two versions to compare.'),btn('Back to current deck',()=>openDeck(deckId)));return;}
  const controls=e('div','codex-grid');
  function versionPicker(label,selected){
   const wrap=e('label','codex-field');wrap.append(e('span','fieldlabel',label));const select=e('select','textinput');
   for(const v of versions){const option=e('option','',`Version ${v.version_number}`);option.value=v.id;select.append(option);}
   select.value=selected;wrap.append(select);return {wrap,select};
  }
  const first=versionPicker('From version',versions[versions.length-1].id);
  const second=versionPicker('To version',versions[0].id);
  controls.append(first.wrap,second.wrap);root.append(controls);
  const results=e('div','codex-card-list');
  const message=e('p','help','');root.append(btn('Compare selected versions',async()=>{
   if(first.select.value===second.select.value){message.textContent='Choose two different versions.';return;}
   results.replaceChildren();message.textContent='Loading comparison…';
   try{
    const comparison=await compareDeckVersions(deckId,first.select.value,second.select.value);
    message.textContent=`Version ${comparison.first.version_number} → Version ${comparison.second.version_number}: ${comparison.rows.length} changed card entries.`;
    if(!comparison.rows.length)results.append(e('p','muted','No card or quantity changes.'));
    for(const row of comparison.rows){
     const line=e('div','codex-card-row');const direction=row.change>0?'+':'';
     line.append(e('span','',`${row.name} (${row.board})`),e('strong','',`${row.from} → ${row.to} (${direction}${row.change})`));results.append(line);
    }
   }catch(err){message.textContent='Comparison failed: '+err.message;}
  },'primary'),results,message);
  root.append(btn('Back to current deck',()=>openDeck(deckId)));
 }
 async function restoreVersion(deckId,version){
  const ok=confirm(`Restore the cards from Version ${version.version_number}? This will create a NEW version and keep all previous versions. Current deck name, format and commander will be retained.`);
  if(!ok)return;
  root.replaceChildren(e('h2','','Restoring historical cards…'));
  try{
   const {result,sourceVersion}=await restoreDeckVersion(deckId,version.id);
   await openDeck(deckId);
   status(`Restored Version ${sourceVersion} as new Version ${result.version_number}. All previous versions were preserved.`);
  }catch(err){root.replaceChildren(e('p','help',`Restore failed: ${err.message}`),btn('Back to current deck',()=>openDeck(deckId)));}
 }
 async function openDeck(id){root.replaceChildren();root.append(e('h2','','Loading deck…'));try{const result=await loadDeck(id);editor(result);}catch(err){root.replaceChildren();root.append(e('p','help',err.message),btn('Back to Codex',library));}}
 function editor(data){active=data?.deck?.id||null;cards=(data?.cards||[]).map(c=>({name:c.card_name,quantity:c.quantity,board:c.board,oracle_id:c.oracle_id,scryfall_id:c.scryfall_id}));root.replaceChildren();root.append(e('h2','',active?'Edit deck':'New deck'));
 const grid=e('div','codex-grid');const name=field('Deck name',data?.deck?.name||'');const format=field('Format',data?.deck?.format||'Commander');const commander=field('Commander (optional)',data?.deck?.commander||'');grid.append(name.wrap,format.wrap,commander.wrap);root.append(grid);
 const addLabel=e('label','fieldlabel','Search card names');root.append(addLabel);const search=e('input','textinput');search.placeholder='Type a card name…';search.autocomplete='off';root.append(search);const suggestions=e('div','codex-suggestions');root.append(suggestions);
 search.oninput=()=>{suggestions.replaceChildren();const q=search.value.trim().toLowerCase();if(q.length<2)return;const results=window.jmaCardNames?.()||[];for(const n of results.filter(x=>x.toLowerCase().includes(q)).slice(0,8)){suggestions.append(btn(n,()=>{const found=cards.find(c=>c.name.toLowerCase()===n.toLowerCase());if(found)found.quantity++;else cards.push({name:n,quantity:1,board:'main'});search.value='';suggestions.replaceChildren();renderCards(cardBox);},'secondary'));}};
 const importLabel=e('label','fieldlabel','Paste a decklist');const textarea=e('textarea');textarea.placeholder='1 Sol Ring\n1 Arcane Signet';textarea.rows=4;root.append(importLabel,textarea,btn('Import cards',()=>{const entries=parse(textarea.value);for(const c of entries){const old=cards.find(x=>x.name.toLowerCase()===c.name.toLowerCase());if(old)old.quantity+=c.quantity;else cards.push(c);}renderCards(cardBox);textarea.value='';status(`Imported ${entries.length} entries.`);}));
 root.append(e('h3','','Cards'));const cardBox=e('div','codex-card-list');root.append(cardBox);renderCards(cardBox);const notes=field('Version notes (optional)');root.append(notes.wrap);const actions=e('div','codex-actions');const save=btn('Save new version',async()=>{if(busy)return;if(!name.input.value.trim()){status('Deck name is required.',true);return;}busy=true;save.disabled=true;status('Saving deck and card snapshot…');try{const result=await saveDeck({id:active,name:name.input.value,format:format.input.value,commander:commander.input.value,cards,notes:notes.input.value});active=result.deck_id;await openDeck(active);status(`Saved version ${result.version_number} successfully.`);}catch(err){status(err.message,true)}finally{busy=false;save.disabled=false;}},'primary');actions.append(save,btn('Send to Proxy',()=>{if(!cards.length){status('Add cards first.',true);return;}sendToProxy(cards);navigate('proxy');}),btn('Back to Codex',library));if(active)actions.append(btn('Delete deck',async()=>{if(!confirm('Delete this deck and all its versions?'))return;try{await deleteDeck(active);library();}catch(err){status(err.message,true)}},'secondary'));root.append(actions);
 if(data?.versions?.length){root.append(e('h3','','Version history'));const history=e('div','codex-history');for(const v of data.versions){const row=e('div','codex-deck');row.append(e('span','muted',`v${v.version_number} · ${new Date(v.created_at).toLocaleString()}${v.notes?' · '+v.notes:''}`),btn('View version',()=>viewVersion(active,v.id)),btn('Restore',()=>restoreVersion(active,v)));history.append(row);}root.append(history);if(data.versions.length>1)root.append(btn('Compare versions',()=>compareVersions(active,data.versions),'secondary'));}const message=e('p','help','');message.id='codex-status';root.append(message);
 }
 async function show(){root.classList.remove('hidden');await library();}
 return {show};
}


import {loadStatsCatalog,analyzeDeck} from './deckStats.js';
import {listDecks,loadDeck,saveDeck,deleteDeck,loadDeckVersion,compareDeckVersions,restoreDeckVersion} from './codexService.js';

const e=(tag,cls,text)=>{
  const x=document.createElement(tag);
  if(cls)x.className=cls;
  if(text!==undefined)x.textContent=text;
  return x;
};

export function initializeCodex({navigate,sendToProxy}){
  const root=document.getElementById('other-page');
  let active=null,cards=[],busy=false;

  const status=(msg,bad=false)=>{
    const s=root.querySelector('#codex-status');
    if(s){
      s.textContent=msg;
      s.style.color=bad?'#a32945':'#42648a';
    }
  };

  function btn(label,fn,cls='secondary'){
    const b=e('button',cls,label);
    b.type='button';
    b.onclick=fn;
    return b;
  }

  function field(label,value='',type='text'){
    const wrap=e('label','codex-field');
    wrap.append(e('span','fieldlabel',label));
    const inp=e('input','textinput');
    inp.type=type;
    inp.value=value;
    wrap.append(inp);
    return {wrap,input:inp};
  }

  function parse(raw){
    return raw.split(/\r?\n/)
      .map(x=>x.trim())
      .filter(x=>x&&!/^\s*(commander|deck|sideboard|maybeboard|mainboard):?\s*$/i.test(x))
      .map(line=>{
        const m=line.match(/^(\d+)\s*x?\s+(.+?)\s*$/i);
        return {
          name:(m?m[2]:line).replace(/\s*\([^)]*\)\s*\d*\s*$/,'').trim(),
          quantity:m?Number(m[1]):1,
          board:'main'
        };
      })
      .filter(x=>x.name&&x.quantity>0&&x.quantity<=999);
  }

  function renderCards(box){
    box.replaceChildren();
    if(!cards.length)box.append(e('p','muted','No cards added yet.'));
    cards.forEach((c,i)=>{
      const row=e('div','codex-card-row');
      row.append(e('span','',c.name));
      const qty=e('input','textinput');
      qty.type='number';
      qty.min=1;
      qty.max=999;
      qty.value=c.quantity;
      qty.setAttribute('aria-label','Quantity for '+c.name);
      qty.onchange=()=>{
        c.quantity=Math.max(1,Math.min(999,Number(qty.value)||1));
        qty.value=c.quantity;
      };
      row.append(qty,btn('×',()=>{
        cards.splice(i,1);
        renderCards(box);
      }));
      box.append(row);
    });
  }

  function statisticsPanel(currentCards){
    const box=e('section','');
    box.append(e('h3','','Deck composition & mana curve'));
    const message=e('p','muted','Analyzing cards from the hosted catalog…');
    box.append(message);

    loadStatsCatalog().then(catalog=>{
      if(!box.isConnected)return;
      const stats=analyzeDeck(currentCards,catalog);
      box.replaceChildren(e('h3','','Deck composition & mana curve'));

      const summary=e('div','codex-v16-summary');
      for(const [label,value] of [
        ['Total cards',stats.total],
        ['Unique cards',stats.unique],
        ['Lands',stats.lands],
        ['Avg. mana value',stats.averageManaValue===null?'—':stats.averageManaValue.toFixed(2)]
      ]){
        const item=e('div','codex-v16-stat');
        item.append(e('strong','',String(value)),e('small','',label));
        summary.append(item);
      }
      box.append(summary);

      const detail=e('div','codex-v16-list');
      for(const [type,count] of Object.entries(stats.types)){
        if(count)detail.append(e('span','codex-v16-chip',`${type}: ${count}`));
      }
      box.append(detail);

      box.append(e('p','muted',`Mana curve · ${stats.curveKnown} nonland cards with known costs`));
      const chart=e('div','codex-v16-chart');
      const max=Math.max(1,...stats.curve);
      stats.curve.forEach((count,i)=>{
        const col=e('div','codex-v16-col');
        col.append(e('div','',String(count)));
        const bar=e('div','codex-v16-bar');
        bar.style.height=`${Math.max(2,Math.round(75*count/max))}px`;
        col.append(bar,e('div','',i===7?'7+':String(i)));
        chart.append(col);
      });
      box.append(chart);

      if(stats.unknown.length){
        box.append(e('p','codex-v16-warning',
          `${stats.unknown.length} unmatched card name(s): ${stats.unknown.slice(0,8).join(', ')}. Statistics exclude unmatched cards.`
        ));
      }
      const mana=stats.manaSources;
      box.append(e('h3','','Mana source breakdown'));
      const sourceSummary=e('div','codex-v16-summary');
      for(const [label,value] of [
        ['Potential sources',mana.total],['Lands producing mana',mana.lands],
        ['Mana rocks',mana.rocks],['Mana creatures',mana.creatures],
        ['Mana enchantments',mana.enchantments],['Other mana spells',mana.otherSpells],
        ['Temporary sources',mana.temporary],['Conditional sources',mana.conditional],
        ['Acceleration candidates',mana.accelerationCandidates]
      ]){
        const item=e('div','codex-v16-stat');
        item.append(e('strong','',String(value)),e('small','',label));
        sourceSummary.append(item);
      }
      box.append(sourceSummary);
      box.append(e('h3','','Potential mana colors'));
      const sourceColors=e('div','codex-v16-list');
      for(const [color,label] of [['W','White'],['U','Blue'],['B','Black'],['R','Red'],['G','Green'],['C','Colorless']]){
        sourceColors.append(e('span','codex-v16-chip',`${label}: ${mana.byColor[color]}`));
      }
      box.append(sourceColors);
      if(mana.unknownColor)box.append(e('p','codex-v16-warning',`${mana.unknownColor} potential source(s) lack specific production-color data.`));
      for(const note of stats.manaNotes)box.append(e('p','muted',note));
      box.append(e('p','muted','Mana values use Scryfall CMC when available; unusual layouts require review.'));

    }).catch(err=>{
      message.textContent='Statistics unavailable: '+err.message;
    });
    return box;
  }

  async function library(){
    active=null;
    root.replaceChildren();
    root.append(e('h2','','Codex'),e('p','muted','Your saved decklists and version history.'));
    const toolbar=e('div','codex-actions');
    toolbar.append(btn('+ New deck',()=>editor(null),'primary'),btn('Refresh',library));
    root.append(toolbar);

    const filters=e('div','codex-v16-tools');
    const find=e('input','textinput');
    find.placeholder='Search saved decks…';
    find.setAttribute('aria-label','Search saved decks');
    const formatFilter=e('select','textinput');
    const order=e('select','textinput');

    for(const [value,label] of [
      ['recent','Recently updated'],
      ['name','Name A–Z'],
      ['oldest','Oldest updated']
    ]){
      const o=e('option','',label);
      o.value=value;
      order.append(o);
    }
    filters.append(find,formatFilter,order);
    root.append(filters);
    const list=e('div','codex-library');
    const message=e('p','help','Loading…');
    message.id='codex-status';
    root.append(list,message);

    try{
      const decks=await listDecks();
      const formats=[...new Set(decks.map(d=>d.format||'Unspecified'))].sort();
      for(const f of ['All formats',...formats]){
        const o=e('option','',f);
        o.value=f;
        formatFilter.append(o);
      }

      const display=()=>{
        list.replaceChildren();
        const query=find.value.trim().toLowerCase();
        let visible=decks.filter(d=>
          (formatFilter.value==='All formats'||(d.format||'Unspecified')===formatFilter.value)&&
          [d.name,d.format,d.commander].some(x=>String(x||'').toLowerCase().includes(query))
        );
        if(order.value==='name')visible.sort((a,b)=>a.name.localeCompare(b.name));
        else if(order.value==='oldest')visible.sort((a,b)=>new Date(a.updated_at)-new Date(b.updated_at));

        if(!visible.length)list.append(e('p','muted','No matching decks.'));
        for(const d of visible){
          const row=e('div','codex-deck');
          const info=e('div');
          info.append(e('strong','',d.name),e('p','muted',[d.format,d.commander].filter(Boolean).join(' · ')||'Unspecified format'));
          row.append(info,btn('Open',()=>openDeck(d.id)));
          list.append(row);
        }
        status(`${visible.length} of ${decks.length} saved deck(s).`);
      };
      find.oninput=display;
      formatFilter.onchange=display;
      order.onchange=display;
      display();
    }catch(err){status(err.message,true);}
  }

  async function openDeck(id){
    root.replaceChildren(e('h2','','Loading deck…'));
    try{
      const result=await loadDeck(id);
      editor(result);
    }catch(err){
      root.replaceChildren(e('p','help',err.message),btn('Back to Codex',library));
    }
  }

  async function viewVersion(deckId,versionId){
    root.replaceChildren(e('h2','','Loading historical version…'));
    try{
      const {deck,version,cards:snapshot}=await loadDeckVersion(deckId,versionId);
      root.replaceChildren();
      root.append(e('h2','',`${deck.name} — Version ${version.version_number}`));
      root.append(e('p','muted',`Saved ${new Date(version.created_at).toLocaleString()} · Read-only historical snapshot`));
      const details=e('div','codex-grid');
      details.append(e('p','',`Format: ${deck.format||'Not specified'}`),
        e('p','',`Current commander: ${deck.commander||'Not specified'}`));
      root.append(details);
      if(version.notes)root.append(e('p','muted',`Version notes: ${version.notes}`));
      root.append(e('h3','',`Saved cards (${snapshot.reduce((n,c)=>n+c.quantity,0)} total)`));
      const list=e('div','codex-card-list');
      if(!snapshot.length)list.append(e('p','muted','No cards were saved in this version.'));
      for(const c of snapshot){
        const row=e('div','codex-card-row');
        row.append(e('span','',`${c.quantity} × ${c.card_name}`),e('span','muted',c.board||'main'));
        list.append(row);
      }
      root.append(list);
      const actions=e('div','codex-actions');
      actions.append(btn('Back to current deck',()=>openDeck(deckId),'primary'),btn('Back to Codex',library));
      root.append(actions);
      root.append(e('p','help','Historical cards are read-only. Deck metadata comes from the current deck record.'));
    }catch(err){
      root.replaceChildren(e('p','help',`Unable to load version: ${err.message}`),btn('Back to current deck',()=>openDeck(deckId)));
    }
  }

  async function compareVersions(deckId,versions){
    root.replaceChildren();
    root.append(e('h2','','Compare deck versions'),e('p','muted','Compare saved card quantities.'));
    if(versions.length<2){
      root.append(e('p','muted','Save at least two versions to compare.'),btn('Back to current deck',()=>openDeck(deckId)));
      return;
    }
    const controls=e('div','codex-grid');
    function picker(label,selected){
      const wrap=e('label','codex-field');
      wrap.append(e('span','fieldlabel',label));
      const select=e('select','textinput');
      for(const v of versions){
        const o=e('option','',`Version ${v.version_number}`);
        o.value=v.id;
        select.append(o);
      }
      select.value=selected;
      wrap.append(select);
      return {wrap,select};
    }
    const first=picker('From version',versions[versions.length-1].id);
    const second=picker('To version',versions[0].id);
    controls.append(first.wrap,second.wrap);
    root.append(controls);
    const results=e('div','codex-card-list');
    const message=e('p','help','');
    root.append(btn('Compare selected versions',async()=>{
      if(first.select.value===second.select.value){
        message.textContent='Choose two different versions.';
        return;
      }
      results.replaceChildren();
      message.textContent='Loading comparison…';
      try{
        const comparison=await compareDeckVersions(deckId,first.select.value,second.select.value);
        message.textContent=`Version ${comparison.first.version_number} → Version ${comparison.second.version_number}: ${comparison.rows.length} changed card entries.`;
        if(!comparison.rows.length)results.append(e('p','muted','No card or quantity changes.'));
        for(const row of comparison.rows){
          const line=e('div','codex-card-row');
          line.append(e('span','',`${row.name} (${row.board})`),
            e('strong','',`${row.from} → ${row.to} (${row.change>0?'+':''}${row.change})`));
          results.append(line);
        }
      }catch(err){message.textContent='Comparison failed: '+err.message;}
    },'primary'),results,message);
    root.append(btn('Back to current deck',()=>openDeck(deckId)));
  }

  async function restoreVersion(deckId,version){
    if(!confirm(`Restore Version ${version.version_number}? This creates a NEW version and preserves all history.`))return;
    root.replaceChildren(e('h2','','Restoring historical cards…'));
    try{
      const {result,sourceVersion}=await restoreDeckVersion(deckId,version.id);
      await openDeck(deckId);
      status(`Restored Version ${sourceVersion} as Version ${result.version_number}.`);
    }catch(err){
      root.replaceChildren(e('p','help',`Restore failed: ${err.message}`),btn('Back to current deck',()=>openDeck(deckId)));
    }
  }

  function editor(data){
    active=data?.deck?.id||null;
    cards=(data?.cards||[]).map(c=>({
      name:c.card_name,quantity:c.quantity,board:c.board,
      oracle_id:c.oracle_id,scryfall_id:c.scryfall_id
    }));
    root.replaceChildren();
    root.append(e('h2','',active?'Edit deck':'New deck'));
    const grid=e('div','codex-grid');
    const name=field('Deck name',data?.deck?.name||'');
    const format=field('Format',data?.deck?.format||'Commander');
    const commander=field('Commander (optional)',data?.deck?.commander||'');
    grid.append(name.wrap,format.wrap,commander.wrap);
    root.append(grid);

    root.append(e('label','fieldlabel','Search card names'));
    const search=e('input','textinput');
    search.placeholder='Type a card name…';
    root.append(search);
    const suggestions=e('div','codex-suggestions');
    root.append(suggestions);

    search.oninput=()=>{
      suggestions.replaceChildren();
      const q=search.value.trim().toLowerCase();
      if(q.length<2)return;
      const names=window.jmaCardNames?.()||[];
      for(const n of names.filter(x=>x.toLowerCase().includes(q)).slice(0,8)){
        suggestions.append(btn(n,()=>{
          const found=cards.find(c=>c.name.toLowerCase()===n.toLowerCase());
          if(found)found.quantity++;
          else cards.push({name:n,quantity:1,board:'main'});
          search.value='';
          suggestions.replaceChildren();
          renderCards(cardBox);
        }));
      }
    };

    root.append(e('label','fieldlabel','Paste a decklist'));
    const textarea=e('textarea');
    textarea.placeholder='1 Sol Ring\n1 Arcane Signet';
    textarea.rows=4;
    root.append(textarea,btn('Import cards',()=>{
      const entries=parse(textarea.value);
      for(const c of entries){
        const old=cards.find(x=>x.name.toLowerCase()===c.name.toLowerCase());
        if(old)old.quantity+=c.quantity;
        else cards.push(c);
      }
      renderCards(cardBox);
      textarea.value='';
      status(`Imported ${entries.length} entries.`);
    }));

    root.append(e('h3','','Cards'));
    const cardBox=e('div','codex-card-list');
    root.append(cardBox);
    renderCards(cardBox);

    const editTools=e('div','codex-v16-tools');
    const sort=e('select','textinput');
    for(const [value,label] of [
      ['name','Sort cards: Name'],
      ['quantity','Sort cards: Quantity'],
      ['board','Sort cards: Board']
    ]){
      const o=e('option','',label);
      o.value=value;
      sort.append(o);
    }
    sort.onchange=()=>{
      cards.sort((a,b)=>
        sort.value==='quantity'?b.quantity-a.quantity||a.name.localeCompare(b.name):
        sort.value==='board'?(a.board||'main').localeCompare(b.board||'main')||a.name.localeCompare(b.name):
        a.name.localeCompare(b.name)
      );
      renderCards(cardBox);
    };
    editTools.append(sort);
    let statsPanel;
    editTools.append(btn('Analyze current cards',()=>{
      if(statsPanel)statsPanel.remove();
      statsPanel=statisticsPanel(cards);
      editTools.after(statsPanel);
    }));
    root.append(editTools);
    statsPanel=statisticsPanel(cards);
    root.append(statsPanel);

    const notes=field('Version notes (optional)');
    root.append(notes.wrap);
    const actions=e('div','codex-actions');
    const save=btn('Save new version',async()=>{
      if(busy)return;
      if(!name.input.value.trim()){status('Deck name is required.',true);return;}
      busy=true;
      save.disabled=true;
      status('Saving deck and card snapshot…');
      try{
        const result=await saveDeck({
          id:active,name:name.input.value,format:format.input.value,
          commander:commander.input.value,cards,notes:notes.input.value
        });
        active=result.deck_id;
        await openDeck(active);
        status(`Saved version ${result.version_number} successfully.`);
      }catch(err){status(err.message,true);}
      finally{busy=false;save.disabled=false;}
    },'primary');
    actions.append(save,
      btn('Send to Proxy',()=>{
        if(!cards.length){status('Add cards first.',true);return;}
        sendToProxy(cards);
        navigate('proxy');
      }),
      btn('Back to Codex',library)
    );
    if(active)actions.append(btn('Delete deck',async()=>{
      if(!confirm('Delete this deck and all its versions?'))return;
      try{await deleteDeck(active);library();}
      catch(err){status(err.message,true);}
    }));
    root.append(actions);

    if(data?.versions?.length){
      root.append(e('h3','','Version history'));
      const history=e('div','codex-history');
      for(const v of data.versions){
        const row=e('div','codex-deck');
        row.append(
          e('span','muted',`v${v.version_number} · ${new Date(v.created_at).toLocaleString()}${v.notes?' · '+v.notes:''}`),
          btn('View version',()=>viewVersion(active,v.id)),
          btn('Restore',()=>restoreVersion(active,v))
        );
        history.append(row);
      }
      root.append(history);
      if(data.versions.length>1){
        root.append(btn('Compare versions',()=>compareVersions(active,data.versions)));
      }
    }
    const message=e('p','help','');
    message.id='codex-status';
    root.append(message);
  }

  async function show(){
    root.classList.remove('hidden');
    await library();
  }
  return {show};
}

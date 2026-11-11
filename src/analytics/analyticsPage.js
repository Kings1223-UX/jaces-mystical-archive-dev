import {getDeckOptions,getVersionOptions,getReports,createReport,removeReport} from './analyticsService.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const problems=[['mana_shortage','Mana shortage'],['mana_flood','Mana flood'],['card_draw','Insufficient card draw'],['interaction','Insufficient interaction'],['slow_start','Slow early game'],['closing','Difficulty closing the game']];
export function initializeAnalytics(){
 const root=document.getElementById('other-page');let generation=0;
 const button=(text,fn,cls='secondary')=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};
 const field=(title,type='text')=>{const label=el('label','analytics-field');label.append(el('span','fieldlabel',title));const input=el('input','textinput');input.type=type;label.append(input);return {label,input};};
 const selectField=title=>{const label=el('label','analytics-field');label.append(el('span','fieldlabel',title));const input=el('select','textinput');label.append(input);return {label,input};};
 const option=(value,text)=>{const o=el('option','',text);o.value=value;return o;};
 async function show(){const token=++generation;root.classList.remove('hidden');root.replaceChildren(el('h2','','Analytics'),el('p','muted','Log games against an exact saved Codex deck version.'));const msg=el('p','help','Loading account data…');msg.setAttribute('role','status');const area=el('div','analytics-layout');root.append(area,msg);
 try{const [decks,reports]=await Promise.all([getDeckOptions(),getReports()]);if(token!==generation)return;area.replaceChildren();
    const versionsById=new Map();
    // Resolve only versions belonging to decks visible to the current user.
    // If metadata cannot be loaded, reports remain viewable by ID.
    await Promise.all(decks.map(async d=>{
      try{const versions=await getVersionOptions(d.id);
        for(const v of versions)versionsById.set(v.id,{deckName:d.name,versionNumber:v.version_number});
      }catch(err){console.warn('Version label unavailable:',err.message);}
    }));
    if(token!==generation)return;
    const form=el('form','analytics-form');form.append(el('h3','','New game report'));
 const deck=selectField('Deck');deck.input.append(option('','Select a deck'));decks.forEach(d=>deck.input.append(option(d.id,d.name)));
 const version=selectField('Saved deck version');version.input.append(option('','Select a deck first'));
 deck.input.onchange=async()=>{const selected=deck.input.value;version.input.replaceChildren(option('','Loading versions…'));version.input.disabled=true;if(!selected){version.input.replaceChildren(option('','Select a deck first'));return;}try{const rows=await getVersionOptions(selected);if(deck.input.value!==selected)return;version.input.replaceChildren(option('','Select a version'));rows.forEach(v=>version.input.append(option(v.id,`Version ${v.version_number}`)));version.input.disabled=false;}catch(err){msg.textContent=err.message;}};
 const result=selectField('Result');[['','Select result'],['win','Win'],['loss','Loss'],['draw','Draw']].forEach(x=>result.input.append(option(...x)));
 const format=field('Game format');format.input.value='Commander';const players=field('Player count','number');players.input.min='2';players.input.max='20';players.input.value='4';const turns=field('Turn count','number');turns.input.min='1';const order=field('Play order','number');order.input.min='1';const mulligans=field('Mulligans','number');mulligans.input.min='0';mulligans.input.max='20';mulligans.input.value='0';const opponents=field('Opponents (optional)');const date=field('Game date','date');date.input.value=new Date().toLocaleDateString('en-CA');
 const issues=el('fieldset','analytics-issues');issues.append(el('legend','','Problems encountered (optional)'));const boxes=problems.map(([value,label])=>{const wrapper=el('label','analytics-check');const c=el('input');c.type='checkbox';c.value=value;wrapper.append(c,document.createTextNode(label));issues.append(wrapper);return c;});
 const notes=el('label','analytics-field');notes.append(el('span','fieldlabel','Notes (optional)'));const noteInput=el('textarea','textinput');noteInput.rows=4;notes.append(noteInput);
 const grid=el('div','analytics-fields');[deck,version,result,format,players,turns,order,mulligans,opponents,date].forEach(x=>grid.append(x.label));form.append(grid,issues,notes);
 const submit=el('button','primary','Save game report');submit.type='submit';form.append(submit);form.onsubmit=async ev=>{ev.preventDefault();if(!deck.input.value||!version.input.value||!result.input.value){msg.textContent='Choose a deck, version, and result.';return;}const num=(input)=>input.value===''?null:Number(input.value);const count=num(players.input),place=num(order.input);if(count===null||count<2||count>20||place!==null&&(place<1||place>count)){msg.textContent='Player count or play order is invalid.';return;}submit.disabled=true;msg.textContent='Saving report…';try{await createReport({deck_version_id:version.input.value,result:result.input.value,game_format:format.input.value.trim()||null,player_count:count,turn_count:num(turns.input),play_order:place,mulligans:num(mulligans.input),problems:boxes.filter(b=>b.checked).map(b=>b.value),opponents:opponents.input.value.trim()||null,notes:noteInput.value.trim()||null,played_at:date.input.value?new Date(date.input.value+'T12:00:00').toISOString():new Date().toISOString()});await show();}catch(err){msg.textContent='Save failed: '+err.message;submit.disabled=false;}};
 const history=el('section','analytics-history');history.append(el('h3','','Recent game reports'));if(!reports.length)history.append(el('p','muted','No games recorded yet.'));for(const r of reports){const item=el('div','analytics-report');const summary=el('div');summary.append(el('strong','',`${(r.result||'Unknown').toUpperCase()} · ${new Date(r.played_at).toLocaleDateString()}`),el('p','muted',`${r.game_format||'Game'} · ${r.player_count??'?'} players · ${r.turn_count??'?'} turns`));if(r.notes)summary.append(el('p','',r.notes));item.append(summary,button('View Report',()=>viewReport(r,decks,versionsById),'primary'),button('Delete',async()=>{if(!confirm('Delete this game report?'))return;try{await removeReport(r.id);await show();}catch(err){msg.textContent=err.message;}}));history.append(item);}area.append(form,history);msg.textContent=`${reports.length} recent report(s) loaded.`;
 }catch(err){if(token===generation)msg.textContent='Analytics unavailable: '+err.message;}}
 return {show};
}

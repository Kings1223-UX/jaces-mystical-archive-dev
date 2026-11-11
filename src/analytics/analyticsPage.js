import {getDeckOptions,getVersionOptions,getReports,createReport,updateReport,removeReport,getReportDeckLabels} from './analyticsService.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const problems=[['mana_shortage','Mana shortage'],['mana_flood','Mana flood'],['card_draw','Insufficient card draw'],['interaction','Insufficient interaction'],['slow_start','Slow early game'],['closing','Difficulty closing the game']];
const dateValue=iso=>{if(!iso)return '';const d=new Date(iso);return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function initializeAnalytics(){
 const root=document.getElementById('other-page');let generation=0;
 const button=(text,fn,cls='secondary')=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};
 const field=(title,type='text')=>{const label=el('label','analytics-field');label.append(el('span','fieldlabel',title));const input=el('input','textinput');input.type=type;label.append(input);return {label,input};};
 const selectField=title=>{const label=el('label','analytics-field');label.append(el('span','fieldlabel',title));const input=el('select','textinput');label.append(input);return {label,input};};
 const option=(value,text)=>{const o=el('option','',text);o.value=value;return o;};
 const heading=(title,sub)=>{root.classList.remove('hidden');root.replaceChildren(el('h2','',title),el('p','muted',sub));};
 function viewReport(report,labels){
  ++generation;heading('Game Report','Read-only saved game details.');
  const box=el('section','analytics-form');box.append(el('h3','',labels.get(report.deck_version_id)||'Deck version unavailable'));
  const grid=el('div','analytics-fields');
  for(const [name,value] of [['Result',report.result],['Game date',dateValue(report.played_at)],['Game format',report.game_format],['Players',report.player_count],['Turns',report.turn_count],['Play order',report.play_order],['Mulligans',report.mulligans],['Opponents',report.opponents]]){
   const item=el('div','analytics-field');item.append(el('span','fieldlabel',name),el('p','',value===null||value===undefined||value===''?'Not recorded':String(value)));grid.append(item);
  }
  box.append(grid,el('h3','','Problems encountered'));
  const issues=(report.problems||[]).map(code=>problems.find(p=>p[0]===code)?.[1]||code);
  box.append(el('p','',issues.join(', ')||'None recorded'),el('h3','','Notes'),el('p','',report.notes||'No notes recorded.'));
  const actions=el('div','codex-actions');actions.append(button('Edit Report',()=>reportForm(report,labels),'primary'),button('Back to Reports',show));
  root.append(box,actions);
 }
 async function reportForm(existing=null,labels=new Map()){
  const token=++generation;heading(existing?'Edit Game Report':'Analytics',existing?'Update this report without creating a duplicate.':'Log games against an exact saved Codex deck version.');
  const msg=el('p','help','Loading account data…');msg.setAttribute('role','status');const area=el('div','analytics-layout');root.append(area,msg);
  try{
   const [decks,reports]=await Promise.all([getDeckOptions(),existing?Promise.resolve([]):getReports()]);if(token!==generation)return;
   if(!existing)labels=await getReportDeckLabels(reports);if(token!==generation)return;
   const form=el('form','analytics-form');form.append(el('h3','',existing?'Edit game report':'New game report'));
   const deck=selectField('Deck');deck.input.append(option('','Select a deck'));decks.forEach(d=>deck.input.append(option(d.id,d.name)));
   const version=selectField('Saved deck version');version.input.append(option('','Select a deck first'));
   const loadVersions=async selected=>{version.input.disabled=true;version.input.replaceChildren(option('','Loading versions…'));if(!selected){version.input.replaceChildren(option('','Select a deck first'));return;}try{const rows=await getVersionOptions(selected);if(token!==generation||deck.input.value!==selected)return;version.input.replaceChildren(option('','Select a version'));rows.forEach(v=>version.input.append(option(v.id,`Version ${v.version_number}`)));version.input.disabled=false;}catch(err){msg.textContent=err.message;}};
   deck.input.onchange=()=>loadVersions(deck.input.value);
   const result=selectField('Result');[['','Select result'],['win','Win'],['loss','Loss'],['draw','Draw']].forEach(x=>result.input.append(option(...x)));
   const format=field('Game format'),players=field('Player count','number'),turns=field('Turn count','number'),order=field('Play order','number'),mulligans=field('Mulligans','number'),opponents=field('Opponents (optional)'),date=field('Game date','date');
   players.input.min='2';players.input.max='20';turns.input.min='1';order.input.min='1';mulligans.input.min='0';mulligans.input.max='20';
   const issues=el('fieldset','analytics-issues');issues.append(el('legend','','Problems encountered (optional)'));
   const boxes=problems.map(([value,label])=>{const wrapper=el('label','analytics-check'),c=el('input');c.type='checkbox';c.value=value;wrapper.append(c,document.createTextNode(label));issues.append(wrapper);return c;});
   const notes=el('label','analytics-field');notes.append(el('span','fieldlabel','Notes (optional)'));const noteInput=el('textarea','textinput');noteInput.rows=4;notes.append(noteInput);
   const grid=el('div','analytics-fields');[deck,version,result,format,players,turns,order,mulligans,opponents,date].forEach(x=>grid.append(x.label));form.append(grid,issues,notes);
   format.input.value=existing?.game_format||'Commander';players.input.value=existing?.player_count??4;turns.input.value=existing?.turn_count??'';order.input.value=existing?.play_order??'';mulligans.input.value=existing?.mulligans??0;opponents.input.value=existing?.opponents||'';date.input.value=existing?dateValue(existing.played_at):dateValue(new Date().toISOString());noteInput.value=existing?.notes||'';result.input.value=existing?.result||'';
   boxes.forEach(b=>b.checked=!!existing?.problems?.includes(b.value));
   if(existing){
    // Do not change a report's deck-version association in this editing release.
    deck.input.replaceChildren(option('',labels.get(existing.deck_version_id)||'Original saved deck version'));deck.input.disabled=true;
    version.input.replaceChildren(option(existing.deck_version_id||'',labels.get(existing.deck_version_id)||'Original version'));version.input.disabled=true;
   }
   const submit=el('button','primary',existing?'Save changes':'Save game report');submit.type='submit';form.append(submit);
   if(existing)form.append(button('Cancel',()=>viewReport(existing,labels)));
   form.onsubmit=async ev=>{ev.preventDefault();if(!existing&&(!deck.input.value||!version.input.value)||!result.input.value){msg.textContent='Choose a deck, version, and result.';return;}
    const num=input=>input.value===''?null:Number(input.value),count=num(players.input),place=num(order.input),turnCount=num(turns.input),mulls=num(mulligans.input);
    if(count===null||!Number.isInteger(count)||count<2||count>20||place!==null&&(!Number.isInteger(place)||place<1||place>count)||turnCount!==null&&(!Number.isInteger(turnCount)||turnCount<1)||mulls!==null&&(!Number.isInteger(mulls)||mulls<0||mulls>20)){msg.textContent='Check player count, play order, turns, and mulligans.';return;}
    const payload={result:result.input.value,game_format:format.input.value.trim()||null,player_count:count,turn_count:turnCount,play_order:place,mulligans:mulls,problems:boxes.filter(b=>b.checked).map(b=>b.value),opponents:opponents.input.value.trim()||null,notes:noteInput.value.trim()||null,played_at:date.input.value?new Date(date.input.value+'T12:00:00').toISOString():new Date().toISOString()};
    if(!existing)payload.deck_version_id=version.input.value;
    submit.disabled=true;msg.textContent='Saving report…';try{if(existing)await updateReport(existing.id,payload);else await createReport(payload);await show();}catch(err){msg.textContent='Save failed: '+err.message;submit.disabled=false;}
   };
   area.replaceChildren(form);
   if(!existing){const history=el('section','analytics-history');history.append(el('h3','','Recent game reports'));if(!reports.length)history.append(el('p','muted','No games recorded yet.'));
    for(const r of reports){const item=el('div','analytics-report'),summary=el('div');summary.append(el('strong','',`${(r.result||'Unknown').toUpperCase()} · ${new Date(r.played_at).toLocaleDateString()}`),el('p','muted',labels.get(r.deck_version_id)||'Deck version unavailable'),el('p','muted',`${r.game_format||'Game'} · ${r.player_count??'?'} players · ${r.turn_count??'?'} turns`));
     item.append(summary,button('View Report',()=>viewReport(r,labels),'primary'),button('Edit',()=>reportForm(r,labels)),button('Delete',async()=>{if(!confirm('Delete this game report?'))return;try{await removeReport(r.id);await show();}catch(err){msg.textContent=err.message;}}));history.append(item);
    }area.append(history);
   }
   msg.textContent=existing?'Editing saved report.':`${reports.length} recent report(s) loaded.`;
  }catch(err){if(token===generation)msg.textContent='Analytics unavailable: '+err.message;}
 }
 async function show(){return reportForm();}
 return {show};
}

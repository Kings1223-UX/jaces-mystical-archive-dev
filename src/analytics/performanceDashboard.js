import {summarizePerformance,groupPerformance,filterPerformanceReports} from './performanceStats.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const pct=n=>n===null?'—':`${n.toFixed(1)}%`;
const avg=n=>n===null?'—':n.toFixed(2);
const issueLabels={mana_shortage:'Mana shortage',mana_flood:'Mana flood',card_draw:'Insufficient card draw',interaction:'Insufficient interaction',slow_start:'Slow early game',closing:'Difficulty closing'};
export function renderPerformanceDashboard(root,reports,labels=new Map()){
 root.replaceChildren();
 const tools=el('div','analytics-dash-tools');
 const version=el('select','textinput'),format=el('select','textinput'),players=el('select','textinput');
 const add=(select,value,label)=>{const o=el('option','',label);o.value=value;select.append(o);};
 add(version,'','All deck versions');
 for(const id of [...new Set(reports.map(r=>r.deck_version_id).filter(Boolean))].sort())add(version,id,labels.get(id)||`Version ${id.slice(0,8)}…`);
 add(format,'','All formats');for(const f of [...new Set(reports.map(r=>r.game_format).filter(Boolean))].sort())add(format,f,f);
 add(players,'','All player counts');for(const n of [...new Set(reports.map(r=>r.player_count).filter(x=>x!=null))].sort((a,b)=>a-b))add(players,String(n),`${n} players`);
 tools.append(version,format,players);root.append(tools);
 const body=el('div','analytics-dash-body');root.append(body);
 function draw(){
  const filtered=filterPerformanceReports(reports,{deckVersionId:version.value||undefined,format:format.value||undefined,playerCount:players.value===''?undefined:Number(players.value)});
  const st=summarizePerformance(filtered);body.replaceChildren();
  const grid=el('div','analytics-dash-metrics');
  for(const [label,value,detail] of [['Games',st.games,`${st.excludedReports} invalid outcomes excluded`],['Wins / Losses / Draws',`${st.wins} / ${st.losses} / ${st.draws}`,'Recorded outcomes'],['Win rate',pct(st.winRate),`${st.games} games, draws included`],['Decisive win rate',pct(st.decisiveWinRate),`${st.wins+st.losses} decisive games`],['Average turns',avg(st.averageTurns),`${st.turnsSample} games with turn data`],['Average mulligans',avg(st.averageMulligans),`${st.mulligansSample} games with mulligan data`]]){const card=el('div','analytics-dash-metric');card.append(el('small','',label),el('strong','',String(value)),el('small','',detail));grid.append(card);}
  body.append(grid,el('h3','','Reported gameplay problems'));
  if(!st.problems.length)body.append(el('p','muted','No problems reported for this selection.'));
  for(const p of st.problems){const row=el('div','analytics-dash-problem');row.append(el('span','',issueLabels[p.key]||p.key),el('span','',`${p.count} games · ${pct(p.percentage)}`));const bar=el('div','analytics-dash-track');const fill=el('div','analytics-dash-fill');fill.style.width=`${Math.min(100,p.percentage)}%`;bar.append(fill);body.append(row,bar);}
  body.append(el('h3','','Performance by deck version'));
  const groups=groupPerformance(filtered,'deck_version_id');
  if(!groups.length)body.append(el('p','muted','No reports available.'));
  for(const g of groups){const row=el('div','analytics-dash-version');row.append(el('span','',labels.get(g.key)||g.key),el('span','',`${g.games} games · ${pct(g.winRate)} wins`));body.append(row);}
  body.append(el('p','muted','Statistics are descriptive. Small samples, differing player counts, and missing values limit comparisons.'));
 }
 version.onchange=draw;format.onchange=draw;players.onchange=draw;draw();
}

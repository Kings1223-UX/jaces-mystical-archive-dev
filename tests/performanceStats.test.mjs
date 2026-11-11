import assert from 'node:assert/strict';
import {summarizePerformance,groupPerformance,filterPerformanceReports} from '../src/analytics/performanceStats.js';
const rows=[
 {result:'win',deck_version_id:'v1',game_format:'Commander',player_count:4,turn_count:8,mulligans:0,problems:['mana_shortage','mana_shortage','card_draw']},
 {result:'loss',deck_version_id:'v1',game_format:'Commander',player_count:4,turn_count:12,mulligans:2,problems:['mana_shortage']},
 {result:'draw',deck_version_id:'v2',game_format:'Commander',player_count:4,turn_count:null,mulligans:null,problems:[]},
 {result:'win',deck_version_id:'v2',game_format:'Modern',player_count:2,turn_count:6,mulligans:1,problems:['interaction']},
 {result:'unknown',deck_version_id:'v2',turn_count:100,mulligans:99,problems:['invalid']}
];
const s=summarizePerformance(rows);
assert.equal(s.games,4);assert.equal(s.wins,2);assert.equal(s.losses,1);assert.equal(s.draws,1);
assert.equal(s.excludedReports,1);assert.equal(s.winRate,50);
assert.equal(s.decisiveWinRate,2/3*100);
assert.equal(s.averageTurns,26/3);assert.equal(s.turnsSample,3);
assert.equal(s.averageMulligans,1);assert.equal(s.mulligansSample,3);
assert.equal(s.problems.find(p=>p.key==='mana_shortage').count,2);
assert.equal(groupPerformance(rows,'deck_version_id').find(x=>x.key==='v1').games,2);
assert.equal(filterPerformanceReports(rows,{deckVersionId:'v1'}).length,2);
assert.equal(summarizePerformance([]).winRate,null);
assert.equal(summarizePerformance([{result:'draw'}]).decisiveWinRate,null);
console.log('PASS — 16 Analytics Stage A assertions');

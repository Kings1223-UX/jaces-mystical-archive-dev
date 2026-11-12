import assert from 'node:assert/strict';
import {summarizePerformance,performanceDataQuality,sampleSizeLabel,filterPerformanceReports} from '../src/analytics/performanceStats.js';
const rows=[
 {result:'win',turn_count:10,mulligans:0,deck_version_id:'v1',problems:['mana','mana']},
 {result:'loss',turn_count:null,mulligans:1,deck_version_id:'v1',problems:['mana','draw']},
 {result:'draw',turn_count:12,mulligans:null,deck_version_id:'v2',problems:[]},
 {result:'unknown',turn_count:99,mulligans:5,deck_version_id:'v2'}
];
const x=performanceDataQuality(rows);
assert.equal(x.games,3);assert.equal(x.excludedReports,1);assert.equal(x.wins,1);
assert.equal(x.turnsSample,2);assert.equal(x.mulligansSample,2);
assert.equal(x.missingTurns,1);assert.equal(x.missingMulligans,1);
assert.equal(x.problems.find(p=>p.key==='mana').count,2);
assert.equal(x.sampleLabel,'Very limited sample');
assert.equal(sampleSizeLabel(0),'No data');assert.equal(sampleSizeLabel(100),'Larger sample');
assert.equal(filterPerformanceReports(rows,{deckVersionId:'v1'}).length,2);
assert.equal(summarizePerformance([]).winRate,null);
console.log('Stage C statistics tests passed');

import assert from 'node:assert/strict';
import {analyzeHistoricalDecks,groupReportsByVersion} from '../src/analytics/historicalDeckAnalysis.js';
const reports=[{result:'loss',deck_version_id:'v1',problems:['mana_shortage']},{result:'loss',deck_version_id:'v1',problems:['mana_shortage']},{result:'win',deck_version_id:'v2',problems:[]},{result:'draw',deck_version_id:'missing',problems:[]},{result:'win',deck_version_id:null}];
const groups=groupReportsByVersion(reports);
assert.equal(groups.size,3);
assert.equal(groups.get('v1').length,2);
let calls=0;
const result=await analyzeHistoricalDecks(reports,{
 listDecks:async()=>[{id:'deck1',name:'Test'}],
 lookupVersions:async()=>new Map([['v1','deck1'],['v2','deck1']]),
 loadDeckVersion:async(_deck,id)=>{calls++;return {version:{id,version_number:id==='v1'?1:2},cards:id==='v1'?[{card_name:'Sol Ring',quantity:2,board:'main'}]:[{card_name:'Island',quantity:1,board:'main'}]};},
 loadStatsCatalog:async()=>new Map(),
 analyzeDeck:entries=>({count:entries.reduce((n,e)=>n+e.quantity,0)}),
 analyzeCardRoles:()=>({totals:{}})
});
assert.equal(calls,2);
assert.equal(result.versions.length,3);
assert.equal(result.unlinkedReports,1);
assert.equal(result.versions.find(x=>x.deckVersionId==='v1').statistics.count,2);
assert.equal(result.versions.find(x=>x.deckVersionId==='v2').statistics.count,1);
assert.equal(result.versions.find(x=>x.deckVersionId==='missing').status,'unavailable');
assert.equal(result.versions.find(x=>x.deckVersionId==='v1').patterns.games,2);
console.log('PASS — historical version isolation, missing versions, and snapshot caching');

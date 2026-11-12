/** Jace's Mystical Archive — Analytics v1.1 Stage A.
 * Pure, read-only calculations over game_reports rows.
 * Win rate uses wins / all recorded outcomes (including draws).
 */
const VALID_RESULTS = new Set(['win', 'loss', 'draw']);
const numeric = value => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
const mean = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;

export function summarizePerformance(reports = []) {
  if (!Array.isArray(reports)) throw new TypeError('Reports must be an array.');
  const valid = reports.filter(r => r && VALID_RESULTS.has(r.result));
  const wins = valid.filter(r=>r.result==='win').length;
  const losses = valid.filter(r=>r.result==='loss').length;
  const draws = valid.filter(r=>r.result==='draw').length;
  const turns = valid.map(r=>numeric(r.turn_count)).filter(n=>n!==null && n>0);
  const mulligans = valid.map(r=>numeric(r.mulligans)).filter(n=>n!==null && n>=0);
  const playOrders = valid.map(r=>numeric(r.play_order)).filter(n=>n!==null && n>=1);
  const issues = new Map();
  for (const r of valid) {
    const unique = new Set(Array.isArray(r.problems) ? r.problems.filter(x=>typeof x==='string' && x.trim()) : []);
    for (const issue of unique) issues.set(issue,(issues.get(issue)||0)+1);
  }
  const games = valid.length;
  return {
    games, wins, losses, draws, excludedReports:reports.length-games,
    winRate:games ? wins/games*100 : null,
    decisiveWinRate:wins+losses ? wins/(wins+losses)*100 : null,
    averageTurns:mean(turns), turnsSample:turns.length,
    averageMulligans:mean(mulligans), mulligansSample:mulligans.length,
    averagePlayOrder:mean(playOrders), playOrderSample:playOrders.length,
    problems:[...issues].map(([key,count])=>({key,count,percentage:games?count/games*100:0})).sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key))
  };
}

export function groupPerformance(reports = [], field = 'deck_version_id') {
  const allowed = new Set(['deck_version_id','game_format','player_count']);
  if (!allowed.has(field)) throw new Error('Unsupported grouping field.');
  const groups = new Map();
  for (const r of reports) {
    const key = r?.[field] == null || r[field] === '' ? 'Unspecified' : String(r[field]);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(r);
  }
  return [...groups].map(([key,rows])=>({key,...summarizePerformance(rows)})).sort((a,b)=>b.games-a.games||a.key.localeCompare(b.key));
}

export function filterPerformanceReports(reports = [], {deckVersionId,format,playerCount} = {}) {
  return reports.filter(r=>(!deckVersionId||r.deck_version_id===deckVersionId) &&
    (!format||r.game_format===format) &&
    (playerCount===undefined||playerCount===null||Number(r.player_count)===Number(playerCount)));
}

/** Descriptive sample labels, not statistical confidence claims. */
export function sampleSizeLabel(games) {
  if (!games) return 'No data';
  if (games < 10) return 'Very limited sample';
  if (games < 30) return 'Limited sample';
  if (games < 100) return 'Growing sample';
  return 'Larger sample';
}

/** Coverage counts are based on reports with valid recorded outcomes. */
export function performanceDataQuality(reports = []) {
  const summary = summarizePerformance(reports);
  const coverage = (count) => summary.games ? count / summary.games * 100 : null;
  return {
    ...summary,
    totalReports: reports.length,
    turnCoverage: coverage(summary.turnsSample),
    mulliganCoverage: coverage(summary.mulligansSample),
    playOrderCoverage: coverage(summary.playOrderSample),
    missingTurns: summary.games - summary.turnsSample,
    missingMulligans: summary.games - summary.mulligansSample,
    sampleLabel: sampleSizeLabel(summary.games),
    unlinkedVersions: reports.filter(r => r && ['win','loss','draw'].includes(r.result) && !r.deck_version_id).length
  };
}

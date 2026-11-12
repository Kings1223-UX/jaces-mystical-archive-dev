/** Jace's Mystical Archive — Analytics v1.2 Stage A.
 * Pure, read-only analysis of game_reports. No database or DOM dependencies.
 * Comparisons describe associations, not causation.
 */
const OUTCOMES = new Set(['win', 'loss', 'draw']);
const PROBLEM_LABELS = Object.freeze({
  mana_shortage: 'Mana shortage', mana_flood: 'Mana flood',
  card_draw: 'Insufficient card draw', interaction: 'Insufficient interaction',
  slow_start: 'Slow early game', closing: 'Difficulty closing the game'
});
const rate = (count, total) => total ? count / total * 100 : null;
const validReports = reports => {
  if (!Array.isArray(reports)) throw new TypeError('Reports must be an array.');
  return reports.filter(r => r && OUTCOMES.has(r.result));
};
const issueSet = report => new Set(
  (Array.isArray(report.problems) ? report.problems : [])
    .filter(x => typeof x === 'string' && x.trim())
    .map(x => x.trim())
);
const outcomeStats = reports => {
  const games = reports.length;
  const wins = reports.filter(r => r.result === 'win').length;
  const losses = reports.filter(r => r.result === 'loss').length;
  const draws = games - wins - losses;
  return {games, wins, losses, draws, winRate: rate(wins, games)};
};
const sampleLabel = games => games === 0 ? 'No data' : games < 10 ? 'Very limited sample' : games < 30 ? 'Limited sample' : games < 100 ? 'Growing sample' : 'Larger sample';

/** Returns per-problem occurrence and outcome associations for a selected report set.
 * A recurring flag is descriptive, requiring >= 3 reports and >= 20% frequency.
 * Caller may change these thresholds; they are not statistical significance tests.
 */
export function detectGameplayPatterns(reports = [], options = {}) {
  const minOccurrences = options.minOccurrences ?? 3;
  const minFrequency = options.minFrequency ?? 20;
  if (!Number.isInteger(minOccurrences) || minOccurrences < 1 || !Number.isFinite(minFrequency) || minFrequency < 0 || minFrequency > 100) {
    throw new RangeError('Invalid recurrence thresholds.');
  }
  const valid = validReports(reports);
  const totals = outcomeStats(valid);
  const issues = new Map();
  for (const report of valid) {
    for (const key of issueSet(report)) {
      if (!issues.has(key)) issues.set(key, []);
      issues.get(key).push(report);
    }
  }
  const patterns = [...issues].map(([key, withIssue]) => {
    const withoutIssue = valid.filter(r => !issueSet(r).has(key));
    const withStats = outcomeStats(withIssue);
    const withoutStats = outcomeStats(withoutIssue);
    const frequency = rate(withIssue.length, valid.length);
    return {
      key, label: PROBLEM_LABELS[key] || key,
      occurrences: withIssue.length, games: valid.length, frequency,
      recurring: withIssue.length >= minOccurrences && frequency >= minFrequency,
      withIssue: withStats, withoutIssue: withoutStats,
      winRateDifference: withStats.winRate === null || withoutStats.winRate === null ? null : withStats.winRate - withoutStats.winRate
    };
  }).sort((a,b) => b.occurrences - a.occurrences || a.key.localeCompare(b.key));
  return {
    ...totals,
    excludedReports: reports.length - valid.length,
    sampleLabel: sampleLabel(valid.length),
    patterns,
    warnings: [
      ...(valid.length < 10 ? ['Small sample: patterns are descriptive only.'] : []),
      ...(reports.length !== valid.length ? [`${reports.length - valid.length} report(s) excluded due to invalid or missing outcomes.`] : [])
    ],
    methodology: 'Each problem counts at most once per game. Win rates include draws in the denominator. Associations do not establish causation.'
  };
}

/** Compare problem frequencies by historical deck version, without combining versions. */
export function compareVersionPatterns(reports = [], options = {}) {
  const valid = validReports(reports);
  const groups = new Map();
  for (const report of valid) {
    const key = report.deck_version_id || 'Unspecified';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(report);
  }
  return [...groups].map(([deckVersionId, rows]) => ({
    deckVersionId, ...detectGameplayPatterns(rows, options)
  })).sort((a,b) => b.games - a.games || a.deckVersionId.localeCompare(b.deckVersionId));
}

/** Returns a descriptive before/after difference for one problem in two versions. */
export function compareProblemAcrossVersions(reports = [], firstVersionId, secondVersionId, problemKey) {
  if (!firstVersionId || !secondVersionId || !problemKey) throw new Error('Two version IDs and a problem key are required.');
  const versions = compareVersionPatterns(reports);
  const find = id => versions.find(v => v.deckVersionId === id);
  const first = find(firstVersionId);
  const second = find(secondVersionId);
  const extract = version => {
    if (!version) return {games: 0, occurrences: 0, frequency: null};
    const p = version.patterns.find(p => p.key === problemKey);
    return {games: version.games, occurrences: p?.occurrences || 0, frequency: rate(p?.occurrences || 0, version.games)};
  };
  const before = extract(first), after = extract(second);
  return {
    problemKey, firstVersionId, secondVersionId, before, after,
    percentagePointChange: before.frequency === null || after.frequency === null ? null : after.frequency - before.frequency,
    note: 'Observed difference only. Deck changes are not established as the cause.'
  };
}

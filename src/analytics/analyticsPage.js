
import {
  getDeckOptions,
  getVersionOptions,
  getReports,
  getAllReports,
  createReport,
  updateReport,
  removeReport,
  getReportDeckLabels
} from './analyticsService.js';

import {
  renderPerformanceDashboard
} from './performanceDashboard.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const problems = [
  ['mana_shortage', 'Mana shortage'],
  ['mana_flood', 'Mana flood'],
  ['card_draw', 'Insufficient card draw'],
  ['interaction', 'Insufficient interaction'],
  ['slow_start', 'Slow early game'],
  ['closing', 'Difficulty closing the game']
];

const dateValue = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
};

export function initializeAnalytics() {
  const root = document.getElementById('other-page');
  let generation = 0;

  const button = (text, fn, cls = 'secondary') => {
    const b = el('button', cls, text);
    b.type = 'button';
    b.onclick = fn;
    return b;
  };

  const field = (title, type = 'text') => {
    const label = el('label', 'analytics-field');
    label.append(el('span', 'fieldlabel', title));
    const input = el('input', 'textinput');
    input.type = type;
    label.append(input);
    return { label, input };
  };

  const selectField = title => {
    const label = el('label', 'analytics-field');
    label.append(el('span', 'fieldlabel', title));
    const input = el('select', 'textinput');
    label.append(input);
    return { label, input };
  };

  const option = (value, text) => {
    const o = el('option', '', text);
    o.value = value;
    return o;
  };

  const heading = (title, subtitle) => {
    root.classList.remove('hidden');
    root.replaceChildren(
      el('h2', '', title),
      el('p', 'muted', subtitle)
    );
  };

  async function showDashboard() {
    const token = ++generation;

    heading(
      'Performance Dashboard',
      'Analyze your recorded games and saved deck versions.'
    );

    const message = el(
      'p',
      'help',
      'Loading complete game report history...'
    );

    message.setAttribute('role', 'status');

    const actions = el('div', 'codex-actions');
    actions.append(
      button('Back to Reports', show, 'secondary')
    );

    const dashboard = el(
      'section',
      'analytics-dashboard'
    );

    root.append(actions, message, dashboard);

    try {
      // Complete paginated retrieval.
      // Do not use getReports() here.
      const reports = await getAllReports();

      if (token !== generation) return;

      if (!Array.isArray(reports)) {
        throw new Error(
          'The report service returned invalid data.'
        );
      }

      const ids = reports.map(r => r.id);

      if (new Set(ids).size !== ids.length) {
        throw new Error(
          'Duplicate reports detected in dashboard data.'
        );
      }

      const labels = await getReportDeckLabels(reports);

      if (token !== generation) return;

      renderPerformanceDashboard(
        dashboard,
        reports,
        labels
      );

      message.textContent =
        `${reports.length} reports retrieved for analysis.`;

    } catch (error) {
      if (token !== generation) return;

      message.textContent =
        'Performance Dashboard unavailable: ' +
        (error.message || String(error));
    }
  }

  function viewReport(report, labels) {
    ++generation;

    heading(
      'Game Report',
      'Read-only saved game details.'
    );

    const box = el('section', 'analytics-form');

    box.append(
      el(
        'h3',
        '',
        labels.get(report.deck_version_id) ||
        'Deck version unavailable'
      )
    );

    const grid = el('div', 'analytics-fields');

    const fields = [
      ['Result', report.result],
      ['Game date', dateValue(report.played_at)],
      ['Game format', report.game_format],
      ['Players', report.player_count],
      ['Turns', report.turn_count],
      ['Play order', report.play_order],
      ['Mulligans', report.mulligans],
      ['Opponents', report.opponents]
    ];

    for (const [name, value] of fields) {
      const item = el('div', 'analytics-field');

      item.append(
        el('span', 'fieldlabel', name),
        el(
          'p',
          '',
          value === null ||
          value === undefined ||
          value === ''
            ? 'Not recorded'
            : String(value)
        )
      );

      grid.append(item);
    }

    box.append(
      grid,
      el('h3', '', 'Problems encountered')
    );

    const issues = (report.problems || []).map(
      code =>
        problems.find(p => p[0] === code)?.[1] ||
        code
    );

    box.append(
      el('p', '', issues.join(', ') || 'None recorded'),
      el('h3', '', 'Notes'),
      el('p', '', report.notes || 'No notes recorded.')
    );

    const actions = el('div', 'codex-actions');

    actions.append(
      button(
        'Edit Report',
        () => reportForm(report, labels),
        'primary'
      ),
      button('Back to Reports', show)
    );

    root.append(box, actions);
  }

  async function reportForm(
    existing = null,
    labels = new Map()
  ) {
    const token = ++generation;

    heading(
      existing ? 'Edit Game Report' : 'Analytics',
      existing
        ? 'Update this report without creating a duplicate.'
        : 'Log games against an exact saved Codex deck version.'
    );

    const msg = el(
      'p',
      'help',
      'Loading account data...'
    );

    msg.setAttribute('role', 'status');

    const area = el('div', 'analytics-layout');
    root.append(area, msg);

    try {
      const [decks, reports] = await Promise.all([
        getDeckOptions(),
        existing
          ? Promise.resolve([])
          : getReports()
      ]);

      if (token !== generation) return;

      if (!existing) {
        labels = await getReportDeckLabels(reports);
      }

      if (token !== generation) return;

      const form = el('form', 'analytics-form');

      form.append(
        el(
          'h3',
          '',
          existing
            ? 'Edit game report'
            : 'New game report'
        )
      );

      const deck = selectField('Deck');

      deck.input.append(
        option('', 'Select a deck')
      );

      decks.forEach(d =>
        deck.input.append(option(d.id, d.name))
      );

      const version = selectField(
        'Saved deck version'
      );

      version.input.append(
        option('', 'Select a deck first')
      );

      const loadVersions = async selected => {
        version.input.disabled = true;

        version.input.replaceChildren(
          option('', 'Loading versions...')
        );

        if (!selected) {
          version.input.replaceChildren(
            option('', 'Select a deck first')
          );
          return;
        }

        try {
          const rows = await getVersionOptions(
            selected
          );

          if (
            token !== generation ||
            deck.input.value !== selected
          ) return;

          version.input.replaceChildren(
            option('', 'Select a version')
          );

          rows.forEach(v =>
            version.input.append(
              option(
                v.id,
                `Version ${v.version_number}`
              )
            )
          );

          version.input.disabled = false;

        } catch (error) {
          msg.textContent = error.message;
        }
      };

      deck.input.onchange = () =>
        loadVersions(deck.input.value);

      const result = selectField('Result');

      [
        ['', 'Select result'],
        ['win', 'Win'],
        ['loss', 'Loss'],
        ['draw', 'Draw']
      ].forEach(x =>
        result.input.append(option(...x))
      );

      const format = field('Game format');
      const players = field('Player count', 'number');
      const turns = field('Turn count', 'number');
      const order = field('Play order', 'number');
      const mulligans = field('Mulligans', 'number');
      const opponents = field('Opponents (optional)');
      const date = field('Game date', 'date');

      players.input.min = '2';
      players.input.max = '20';

      turns.input.min = '1';

      order.input.min = '1';

      mulligans.input.min = '0';
      mulligans.input.max = '20';

      const issues = el(
        'fieldset',
        'analytics-issues'
      );

      issues.append(
        el(
          'legend',
          '',
          'Problems encountered (optional)'
        )
      );

      const boxes = problems.map(
        ([value, label]) => {
          const wrapper = el(
            'label',
            'analytics-check'
          );

          const c = el('input');
          c.type = 'checkbox';
          c.value = value;

          wrapper.append(
            c,
            document.createTextNode(label)
          );

          issues.append(wrapper);
          return c;
        }
      );

      const notes = el(
        'label',
        'analytics-field'
      );

      notes.append(
        el(
          'span',
          'fieldlabel',
          'Notes (optional)'
        )
      );

      const noteInput = el(
        'textarea',
        'textinput'
      );

      noteInput.rows = 4;
      notes.append(noteInput);

      const grid = el(
        'div',
        'analytics-fields'
      );

      [
        deck,
        version,
        result,
        format,
        players,
        turns,
        order,
        mulligans,
        opponents,
        date
      ].forEach(x => grid.append(x.label));

      form.append(
        grid,
        issues,
        notes
      );

      format.input.value =
        existing?.game_format || 'Commander';

      players.input.value =
        existing?.player_count ?? 4;

      turns.input.value =
        existing?.turn_count ?? '';

      order.input.value =
        existing?.play_order ?? '';

      mulligans.input.value =
        existing?.mulligans ?? 0;

      opponents.input.value =
        existing?.opponents || '';

      date.input.value = existing
        ? dateValue(existing.played_at)
        : dateValue(new Date().toISOString());

      noteInput.value =
        existing?.notes || '';

      result.input.value =
        existing?.result || '';

      boxes.forEach(
        b =>
          b.checked =
            !!existing?.problems?.includes(b.value)
      );

      if (existing) {
        // Preserve the original deck-version association.
        const label =
          labels.get(existing.deck_version_id) ||
          'Original saved deck version';

        deck.input.replaceChildren(
          option('', label)
        );

        deck.input.disabled = true;

        version.input.replaceChildren(
          option(
            existing.deck_version_id || '',
            label
          )
        );

        version.input.disabled = true;
      }

      const submit = el(
        'button',
        'primary',
        existing
          ? 'Save changes'
          : 'Save game report'
      );

      submit.type = 'submit';
      form.append(submit);

      if (existing) {
        form.append(
          button(
            'Cancel',
            () => viewReport(existing, labels)
          )
        );
      }

      form.onsubmit = async ev => {
        ev.preventDefault();

        if (
          (!existing &&
            (!deck.input.value ||
             !version.input.value)) ||
          !result.input.value
        ) {
          msg.textContent =
            'Choose a deck, version, and result.';
          return;
        }

        const num = input =>
          input.value === ''
            ? null
            : Number(input.value);

        const count = num(players.input);
        const place = num(order.input);
        const turnCount = num(turns.input);
        const mulls = num(mulligans.input);

        const invalid =
          count === null ||
          !Number.isInteger(count) ||
          count < 2 ||
          count > 20 ||
          (place !== null &&
            (!Number.isInteger(place) ||
             place < 1 ||
             place > count)) ||
          (turnCount !== null &&
            (!Number.isInteger(turnCount) ||
             turnCount < 1)) ||
          (mulls !== null &&
            (!Number.isInteger(mulls) ||
             mulls < 0 ||
             mulls > 20));

        if (invalid) {
          msg.textContent =
            'Check player count, play order, turns, and mulligans.';
          return;
        }

        const payload = {
          result: result.input.value,
          game_format:
            format.input.value.trim() || null,
          player_count: count,
          turn_count: turnCount,
          play_order: place,
          mulligans: mulls,
          problems: boxes
            .filter(b => b.checked)
            .map(b => b.value),
          opponents:
            opponents.input.value.trim() || null,
          notes:
            noteInput.value.trim() || null,
          played_at: date.input.value
            ? new Date(
                date.input.value + 'T12:00:00'
              ).toISOString()
            : new Date().toISOString()
        };

        if (!existing) {
          payload.deck_version_id =
            version.input.value;
        }

        submit.disabled = true;
        msg.textContent = 'Saving report...';

        try {
          if (existing) {
            await updateReport(
              existing.id,
              payload
            );
          } else {
            await createReport(payload);
          }

          await show();

        } catch (error) {
          msg.textContent =
            'Save failed: ' + error.message;

          submit.disabled = false;
        }
      };

      area.replaceChildren(form);

      if (!existing) {
        const history = el(
          'section',
          'analytics-history'
        );

        const historyHeader = el(
          'div',
          'codex-actions'
        );

        historyHeader.append(
          el('h3', '', 'Recent game reports'),
          button(
            'View Performance Dashboard',
            showDashboard,
            'primary'
          )
        );

        history.append(historyHeader);

        if (!reports.length) {
          history.append(
            el(
              'p',
              'muted',
              'No games recorded yet.'
            )
          );
        }

        for (const r of reports) {
          const item = el(
            'div',
            'analytics-report'
          );

          const summary = el('div');

          summary.append(
            el(
              'strong',
              '',
              `${(r.result || 'Unknown').toUpperCase()} · ` +
              new Date(r.played_at).toLocaleDateString()
            ),
            el(
              'p',
              'muted',
              labels.get(r.deck_version_id) ||
              'Deck version unavailable'
            ),
            el(
              'p',
              'muted',
              `${r.game_format || 'Game'} · ` +
              `${r.player_count ?? '?'} players · ` +
              `${r.turn_count ?? '?'} turns`
            )
          );

          item.append(
            summary,
            button(
              'View Report',
              () => viewReport(r, labels),
              'primary'
            ),
            button(
              'Edit',
              () => reportForm(r, labels)
            ),
            button(
              'Delete',
              async () => {
                if (!confirm(
                  'Delete this game report?'
                )) return;

                try {
                  await removeReport(r.id);
                  await show();

                } catch (error) {
                  msg.textContent =
                    error.message;
                }
              }
            )
          );

          history.append(item);
        }

        area.append(history);
      }

      msg.textContent = existing
        ? 'Editing saved report.'
        : `${reports.length} recent report(s) loaded.`;

    } catch (error) {
      if (token === generation) {
        msg.textContent =
          'Analytics unavailable: ' +
          error.message;
      }
    }
  }

  async function show() {
    return reportForm();
  }

  return { show };
}

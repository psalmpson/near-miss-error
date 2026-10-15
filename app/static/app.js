(() => {
'use strict';

/* ------------------------------------------------------------ helpers */
const view = document.getElementById('view');
const S = { cfg: null, drugs: [], carry: null };
const PIN_KEY = 'nm_pin';
const getPin = () => sessionStorage.getItem(PIN_KEY) || '';

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (k) => {
    if (k === null || k === undefined || k === false) return;
    if (Array.isArray(k)) k.forEach(add);
    else el.append(k.nodeType ? k : document.createTextNode(String(k)));
  };
  kids.forEach(add);
  return el;
}

async function api(path, { method = 'GET', body, admin = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (admin) headers['X-Admin-Pin'] = getPin();
  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* not json */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Something went wrong (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

let toastTimer;
function toast(msg, bad = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = bad ? 'var(--danger)' : '';
  t.style.color = bad ? '#fff' : '';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), bad ? 5000 : 2600);
}

function modal({ title, body, ok = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', null,
      h('form', { method: 'dialog', class: 'stack' },
        h('h2', null, title), body,
        h('div', { class: 'actions', style: 'justify-content:flex-end;margin-top:16px' },
          h('button', { type: 'button', class: 'btn', onclick: (e) => e.target.closest('dialog').close('cancel') }, 'Cancel'),
          h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), value: 'ok' }, ok))));
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'ok'); dlg.remove(); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

const pad = (n) => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
const monthLabel = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); };
const labelOf = (list, key, prop = 'label') => (list.find((x) => (x.key ?? x.code) === key) || {})[prop] || key;
function monthOptions(extra = []) {
  const set = new Set(extra), now = new Date();
  for (let i = 0; i < 24; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); set.add(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); }
  return [...set].sort().reverse();
}
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const opt = (value, text, selected) => h('option', { value, selected }, text);

/* ------------------------------------------------------------ searchable drug picker */
function drugPicker(initial, onPick) {
  let picked = initial, active = 0, shown = [];
  const wrap = h('div', { class: 'combo' });
  const input = h('input', {
    type: 'text', class: 'combo-input', id: 'f-drug', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'Search by name, strength or brand…', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': 'drug-list', 'aria-autocomplete': 'list',
  });
  const list = h('div', { class: 'combo-list', id: 'drug-list', role: 'listbox' });
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function highlight(name, toks) {
    if (!toks.length) return name;
    const re = new RegExp(toks.map(esc).join('|'), 'gi'), out = [];
    let last = 0, m;
    while ((m = re.exec(name))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      if (m.index > last) out.push(name.slice(last, m.index));
      out.push(h('mark', null, m[0]));
      last = m.index + m[0].length;
    }
    out.push(name.slice(last));
    return out;
  }

  function search() {
    const toks = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    let hits = S.drugs;
    if (toks.length) {
      hits = S.drugs.filter((d) => toks.every((t) => d.k.includes(t)));
      hits.sort((a, b) => (a.k.indexOf(toks[0]) === 0 ? 0 : 1) - (b.k.indexOf(toks[0]) === 0 ? 0 : 1));
    }
    shown = hits.slice(0, 60);
    active = 0;
    list.replaceChildren();
    if (!shown.length) list.append(h('div', { class: 'combo-empty' }, 'No drug matches that search. Check the spelling, or ask an administrator to add it.'));
    shown.forEach((d, i) => list.append(h('div', {
      class: 'combo-item' + (i === 0 ? ' active' : ''), role: 'option', id: `drug-opt-${i}`,
      onmousedown: (e) => e.preventDefault(), onclick: () => choose(d),
    }, highlight(d.name, toks))));
    if (hits.length > shown.length) list.append(h('div', { class: 'combo-more' }, `${hits.length - shown.length} more. Keep typing to narrow the list.`));
    else if (!toks.length) list.append(h('div', { class: 'combo-more' }, `${S.drugs.length.toLocaleString()} drugs. Type to search.`));
  }
  const setActive = (i) => {
    const items = list.querySelectorAll('.combo-item');
    if (!items.length) return;
    active = (i + items.length) % items.length;
    items.forEach((el, j) => el.classList.toggle('active', j === active));
    items[active].scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', `drug-opt-${active}`);
  };
  const open = () => { search(); wrap.classList.add('open'); input.setAttribute('aria-expanded', 'true'); };
  const close = () => { wrap.classList.remove('open'); input.setAttribute('aria-expanded', 'false'); };

  function choose(d) {
    picked = { id: d.id, name: d.name };
    onPick(picked);
    draw();
    wrap.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function draw() {
    wrap.replaceChildren();
    if (picked) {
      wrap.append(h('div', { class: 'picked' }, h('span', null, picked.name),
        h('button', { type: 'button', class: 'btn small', onclick: () => { picked = null; onPick(null); draw(); input.focus(); open(); } }, 'Change')));
    } else {
      wrap.append(input, list);
    }
  }
  input.addEventListener('focus', open);
  input.addEventListener('input', open);
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); wrap.classList.contains('open') ? setActive(active + 1) : open(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') { if (wrap.classList.contains('open') && shown[active]) { e.preventDefault(); choose(shown[active]); } }
    else if (e.key === 'Escape') close();
  });
  draw();
  return wrap;
}

/* ------------------------------------------------------------ log / edit form */
function formView(rec) {
  const cfg = S.cfg, edit = !!rec;
  const carry = S.carry || {};
  const remembered = localStorage.getItem('nm_pharmacy');
  const f = rec ? {
    pharmacy_id: String(rec.pharmacy_id), date: rec.date, time_of_day: rec.time_of_day,
    staff_pharmacists: rec.staff_pharmacists, staff_technicians: rec.staff_technicians,
    staff_assistants: rec.staff_assistants, staff_interns: rec.staff_interns,
    personnel: new Set(rec.personnel), personnel_names: rec.personnel_names,
    reported_by_role: rec.reported_by_role, reported_by_name: rec.reported_by_name,
    drug: { id: rec.drug_id, name: rec.drug_name }, error_type: rec.error_type,
    causes: new Set(rec.causes), considerations: new Set(rec.considerations),
    actions: new Set(rec.actions), action_other: rec.action_other,
    adverse_discussed: rec.adverse_discussed, notes: rec.notes,
  } : {
    pharmacy_id: carry.pharmacy_id || (cfg.pharmacies.some((p) => String(p.id) === remembered) ? remembered : (cfg.pharmacies.length === 1 ? String(cfg.pharmacies[0].id) : '')),
    date: carry.date || todayISO(), time_of_day: '',
    staff_pharmacists: carry.staff_pharmacists || 0, staff_technicians: carry.staff_technicians || 0,
    staff_assistants: carry.staff_assistants || 0, staff_interns: carry.staff_interns || 0,
    personnel: new Set(), personnel_names: '', reported_by_role: '', reported_by_name: '',
    drug: null, error_type: '', causes: new Set(), considerations: new Set(),
    actions: new Set(), action_other: '', adverse_discussed: false, notes: '',
  };
  S.carry = null;

  const field = (key, label, content, { optional = false, hint = null, forId = null, group = false } = {}) =>
    h('div', { class: 'field', 'data-key': key },
      h(forId ? 'label' : 'div', { class: 'label', id: `l-${key}`, for: forId }, label, optional ? h('span', { class: 'opt' }, ' (optional)') : null),
      hint ? h('div', { class: 'hint', style: 'margin:-2px 0 8px' }, hint) : null,
      group ? h('div', { role: 'group', 'aria-labelledby': `l-${key}` }, content) : content,
      h('div', { class: 'field-error', role: 'alert' }));

  /* pharmacy + date + time */
  const pharmacies = [...cfg.pharmacies];
  if (rec && !pharmacies.some((p) => p.id === rec.pharmacy_id)) pharmacies.push({ id: rec.pharmacy_id, name: rec.pharmacy_name });
  const phSel = h('select', { id: 'f-pharmacy', onchange: (e) => { f.pharmacy_id = e.target.value; if (!edit) localStorage.setItem('nm_pharmacy', f.pharmacy_id); } },
    opt('', 'Select pharmacy…', !f.pharmacy_id), pharmacies.map((p) => opt(p.id, p.name, String(p.id) === f.pharmacy_id)));
  const dateIn = h('input', { type: 'date', id: 'f-date', value: f.date, onchange: (e) => { f.date = e.target.value; } });
  const timeSeg = h('div', { class: 'seg' }, cfg.times.map((t) => h('label', null,
    h('input', { type: 'radio', name: 'time', value: t.code, checked: f.time_of_day === t.code, onchange: () => { f.time_of_day = t.code; } }),
    h('span', null, h('b', null, t.name), h('small', null, t.range)))));

  function stepper(s) {
    const out = h('output', null, String(f[s.key]));
    const set = (n) => { f[s.key] = Math.max(0, Math.min(99, n)); out.textContent = f[s.key]; };
    return h('div', { class: 'stepper' }, h('small', null, s.label), h('div', { class: 'row' },
      h('button', { type: 'button', 'aria-label': `Fewer ${s.label.toLowerCase()}`, onclick: () => set(f[s.key] - 1) }, '−'), out,
      h('button', { type: 'button', 'aria-label': `More ${s.label.toLowerCase()}`, onclick: () => set(f[s.key] + 1) }, '+')));
  }

  /* who */
  const multiChips = (options, set, after) => h('div', { class: 'chips' }, options.map((o) => h('label', { class: 'chip' },
    h('input', { type: 'checkbox', checked: set.has(o.key), onchange: (e) => { e.target.checked ? set.add(o.key) : set.delete(o.key); if (after) after(); } }),
    h('span', null, o.label))));
  const reportedChips = h('div', { class: 'chips' }, cfg.reportedBy.map((o) => h('label', { class: 'chip' },
    h('input', { type: 'radio', name: 'reported', checked: f.reported_by_role === o.key, onchange: () => { f.reported_by_role = o.key; } }),
    h('span', null, o.label))));

  /* what happened */
  const picker = drugPicker(f.drug, (d) => { f.drug = d; });
  const tiles = h('div', { class: 'tiles' }, cfg.errorTypes.map((t) => h('label', { class: 'tile' },
    h('input', { type: 'radio', name: 'etype', value: t.code, checked: f.error_type === t.code, onchange: () => { f.error_type = t.code; f.considerations.clear(); drawCauses(); drawReview(); } }),
    h('span', null, h('i', null, t.code), t.name))));

  const causeBox = h('div');
  function drawCauses() {
    const sugg = cfg.suggestedCauses[f.error_type] || [];
    const chip = (c) => h('label', { class: 'chip' },
      h('input', { type: 'checkbox', checked: f.causes.has(c.key), onchange: (e) => { e.target.checked ? f.causes.add(c.key) : f.causes.delete(c.key); } }),
      h('span', null, c.label));
    const first = cfg.causes.filter((c) => sugg.includes(c.key)).sort((a, b) => sugg.indexOf(a.key) - sugg.indexOf(b.key));
    const rest = cfg.causes.filter((c) => !sugg.includes(c.key));
    causeBox.replaceChildren(h('div', { class: 'chips' },
      first.length ? h('div', { class: 'group-label' }, 'Common for this type of error') : null, first.map(chip),
      first.length ? h('div', { class: 'group-label' }, 'Other causes') : null, rest.map(chip)));
  }
  const reviewBox = h('div');
  function drawReview() {
    const items = cfg.consider[f.error_type] || [];
    if (!items.length) { reviewBox.replaceChildren(h('div', { class: 'hint' }, 'Choose the type of error to see the review prompts.')); return; }
    reviewBox.replaceChildren(h('details', { class: 'review', open: f.considerations.size > 0 },
      h('summary', null, `Review prompts for this error (${items.length})`),
      h('ul', null, items.map((t) => h('li', null, h('label', null,
        h('input', { type: 'checkbox', checked: f.considerations.has(t), onchange: (e) => { e.target.checked ? f.considerations.add(t) : f.considerations.delete(t); } }),
        h('span', null, t)))))));
  }

  /* follow-up */
  const otherIn = h('input', { type: 'text', maxlength: 300, placeholder: 'Describe the other action taken', value: f.action_other, oninput: (e) => { f.action_other = e.target.value; } });
  const otherWrap = h('div', { style: 'margin-top:10px;' + (f.actions.has('other_action') ? '' : 'display:none') }, otherIn);
  const actionChips = multiChips(cfg.actions, f.actions, () => { otherWrap.style.display = f.actions.has('other_action') ? '' : 'none'; });

  const fields = {
    pharmacy: field('pharmacy', 'Pharmacy', phSel, { forId: 'f-pharmacy' }),
    date: field('date', 'Date of near miss', dateIn, { forId: 'f-date' }),
    time: field('time', 'Time of day', timeSeg, { group: true }),
    staffing: field('staffing', 'Staffing level', h('div', { class: 'steppers' }, cfg.staffing.map(stepper)), { optional: true, hint: 'How many staff were on duty at the time.', group: true }),
    personnel: field('personnel', 'Personnel involved', multiChips(cfg.personnel, f.personnel), { group: true }),
    personnelNames: field('personnelNames', 'Name(s) of personnel involved', h('input', { type: 'text', maxlength: 200, value: f.personnel_names, oninput: (e) => { f.personnel_names = e.target.value; } }), { optional: true }),
    reported: field('reported', 'Reported by', reportedChips, { group: true }),
    reportedName: field('reportedName', 'Name of person reporting', h('input', { type: 'text', maxlength: 120, value: f.reported_by_name, oninput: (e) => { f.reported_by_name = e.target.value; } }), { optional: true }),
    drug: field('drug', 'Name and brand of drug', picker, { forId: 'f-drug' }),
    type: field('type', 'Type of error', tiles, { group: true }),
    causes: field('causes', 'Possible causes', causeBox, { hint: 'Select everything that applies.', group: true }),
    consider: field('consider', 'Things to consider', reviewBox, { optional: true }),
    notes: field('notes', 'What happened', h('textarea', { maxlength: 2000, placeholder: 'Anything that helps the team learn from this', oninput: (e) => { f.notes = e.target.value; } }, f.notes), { optional: true }),
    actions: field('actions', 'Action taken', h('div', null, actionChips, otherWrap), { group: true }),
    adverse: h('div', { class: 'field' }, h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: f.adverse_discussed, onchange: (e) => { f.adverse_discussed = e.target.checked; } }),
      h('span', null, 'Potential adverse event discussion completed'))),
  };
  drawCauses(); drawReview();

  const msg = h('span', { class: 'msg', role: 'alert' });
  const saveBtn = h('button', { type: 'submit', class: 'btn primary' }, edit ? 'Save changes' : 'Save near miss');
  const second = edit
    ? h('a', { class: 'btn', href: '#/records' }, 'Cancel')
    : h('button', { type: 'button', class: 'btn', onclick: () => { S.carry = { pharmacy_id: f.pharmacy_id }; route(); } }, 'Clear form');

  const formEl = h('form', { novalidate: true, class: 'narrow stack' },
    h('div', { class: 'page-head' }, h('div', null,
      h('h1', null, edit ? `Edit near miss No. ${rec.id}` : 'Log a near miss'),
      h('p', null, edit ? 'Update the details and save.' : 'Takes about a minute. Fields marked optional can be skipped.'))),
    h('section', { class: 'card' }, h('h2', null, 'When and where'), fields.pharmacy, h('div', { class: 'grid2' }, fields.date), fields.time, fields.staffing),
    h('section', { class: 'card' }, h('h2', null, 'Who was involved'), fields.personnel, fields.personnelNames, fields.reported, fields.reportedName),
    h('section', { class: 'card' }, h('h2', null, 'What happened'), fields.drug, fields.type, fields.causes, fields.consider, fields.notes),
    h('section', { class: 'card' }, h('h2', null, 'Follow-up'), fields.actions, fields.adverse),
    h('div', { class: 'savebar' }, msg, second, saveBtn));

  const clearInvalid = (e) => { const fl = e.target.closest('.field'); if (fl) fl.classList.remove('invalid'); if (!formEl.querySelector('.invalid')) msg.textContent = ''; };
  formEl.addEventListener('input', clearInvalid);
  formEl.addEventListener('change', clearInvalid);

  function validate() {
    const bad = [];
    if (!f.pharmacy_id) bad.push(['pharmacy', 'Choose the pharmacy.']);
    if (!f.date) bad.push(['date', 'Enter the date of the near miss.']);
    if (!f.time_of_day) bad.push(['time', 'Choose the time of day.']);
    if (!f.personnel.size) bad.push(['personnel', 'Select who was involved.']);
    if (!f.reported_by_role) bad.push(['reported', 'Choose who reported it.']);
    if (!f.drug) bad.push(['drug', 'Search for the drug and pick it from the list.']);
    if (!f.error_type) bad.push(['type', 'Choose the type of error.']);
    if (!f.causes.size) bad.push(['causes', 'Select at least one possible cause.']);
    if (!f.actions.size) bad.push(['actions', 'Select the action taken.']);
    return bad;
  }

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    Object.values(fields).forEach((el) => el.classList.remove('invalid'));
    const bad = validate();
    if (bad.length) {
      bad.forEach(([k, m]) => { fields[k].classList.add('invalid'); fields[k].querySelector('.field-error').textContent = m; });
      msg.textContent = `Please complete ${bad.length === 1 ? 'the highlighted field' : 'the highlighted fields'}.`;
      fields[bad[0][0]].scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    msg.textContent = '';
    const payload = {
      pharmacy_id: f.pharmacy_id, date: f.date, time_of_day: f.time_of_day,
      staff_pharmacists: f.staff_pharmacists, staff_technicians: f.staff_technicians, staff_assistants: f.staff_assistants, staff_interns: f.staff_interns,
      personnel: [...f.personnel], personnel_names: f.personnel_names, reported_by_role: f.reported_by_role, reported_by_name: f.reported_by_name,
      drug_id: f.drug.id, error_type: f.error_type, causes: [...f.causes], considerations: [...f.considerations],
      actions: [...f.actions], action_other: f.action_other, adverse_discussed: f.adverse_discussed, notes: f.notes,
    };
    saveBtn.disabled = true;
    try {
      if (edit) {
        await api(`/api/records/${rec.id}`, { method: 'PUT', body: payload });
        toast('Changes saved');
        location.hash = '#/records';
      } else {
        const r = await api('/api/records', { method: 'POST', body: payload });
        S.carry = { pharmacy_id: f.pharmacy_id, date: f.date, staff_pharmacists: f.staff_pharmacists, staff_technicians: f.staff_technicians, staff_assistants: f.staff_assistants, staff_interns: f.staff_interns };
        toast(`Near miss logged (No. ${r.id})`);
        route();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      msg.textContent = err.message;
      saveBtn.disabled = false;
    }
  });
  return formEl;
}

/* ------------------------------------------------------------ records */
const RF = { pharmacy: '', month: '', type: '', q: '' };

async function recordsView() {
  const cfg = S.cfg;
  let items = [], total = 0;
  const open = new Set();
  const months = await api('/api/months');

  const sel = (key, options) => h('select', { 'aria-label': key, onchange: (e) => { RF[key] = e.target.value; load(true); } }, options);
  const filters = h('div', { class: 'filters no-print' },
    sel('pharmacy', [opt('', 'All pharmacies', !RF.pharmacy), cfg.pharmacies.map((p) => opt(p.id, p.name, String(p.id) === RF.pharmacy))]),
    sel('month', [opt('', 'All months', !RF.month), months.map((m) => opt(m, monthLabel(m), m === RF.month))]),
    sel('type', [opt('', 'All error types', !RF.type), cfg.errorTypes.map((t) => opt(t.code, `${t.code} – ${t.name}`, t.code === RF.type))]),
    h('input', { type: 'search', placeholder: 'Search drug, names, notes…', value: RF.q, 'aria-label': 'Search', oninput: debounce((e) => { RF.q = e.target.value.trim(); load(true); }, 250) }));

  const tbody = h('tbody');
  const count = h('div', { class: 'hint' });
  const more = h('button', { class: 'btn', onclick: () => load(false) }, 'Load more');
  const emptyBox = h('div');
  const tableWrap = h('div', { class: 'table-wrap' }, h('table', { class: 'records' },
    h('thead', null, h('tr', null, h('th', { class: 'hide-sm' }, 'No.'), h('th', null, 'Date'), h('th', { class: 'hide-sm' }, 'Pharmacy'), h('th', null, 'Drug'), h('th', null, 'Error'), h('th', { class: 'hide-sm' }, 'Time'), h('th', { class: 'hide-sm' }, 'Reported by'))),
    tbody));

  function detail(r) {
    const t = cfg.times.find((x) => x.code === r.time_of_day);
    const staff = cfg.staffing.filter((s) => r[s.key]).map((s) => `${r[s.key]} ${s.label.toLowerCase()}`).join(', ') || 'Not recorded';
    const acts = r.actions.map((a) => (a === 'other_action' && r.action_other) ? `Others: ${r.action_other}` : labelOf(cfg.actions, a));
    const dd = (k, v) => [h('dt', null, k), h('dd', null, v)];
    return h('tr', { class: 'detail' }, h('td', { colspan: 7 },
      h('dl', { class: 'facts' },
        dd('Pharmacy', r.pharmacy_name), dd('Time of day', `${t.name} (${t.range})`), dd('Staff on duty', staff),
        dd('Personnel involved', r.personnel.map((p) => labelOf(cfg.personnel, p)).join(', ') + (r.personnel_names ? ` (${r.personnel_names})` : '')),
        dd('Reported by', labelOf(cfg.reportedBy, r.reported_by_role) + (r.reported_by_name ? ` (${r.reported_by_name})` : '')),
        dd('Possible causes', r.causes.map((c) => labelOf(cfg.causes, c)).join('; ')),
        r.considerations.length ? dd('Reviewed', r.considerations.join('; ')) : null,
        dd('Action taken', acts.join('; ')),
        dd('Adverse event discussion', r.adverse_discussed ? h('span', { class: 'pill ok' }, 'Completed') : h('span', { class: 'pill' }, 'Not marked')),
        r.notes ? dd('What happened', r.notes) : null),
      h('div', { class: 'actions' },
        h('a', { class: 'btn small', href: `#/edit/${r.id}` }, 'Edit'),
        h('button', { class: 'btn small danger', onclick: () => remove(r) }, 'Delete'))));
  }

  async function remove(r) {
    const pinIn = h('input', { type: 'password', placeholder: 'Administrator PIN', autocomplete: 'off', value: getPin() });
    const ok = await modal({ title: `Delete near miss No. ${r.id}?`, danger: true, ok: 'Delete',
      body: h('div', null, h('p', null, 'This permanently removes the record. Enter the administrator PIN to continue.'), pinIn) });
    if (!ok) return;
    sessionStorage.setItem(PIN_KEY, pinIn.value);
    try { await api(`/api/records/${r.id}`, { method: 'DELETE', admin: true }); toast('Record deleted'); load(true); }
    catch (e) { if (e.status === 403) sessionStorage.removeItem(PIN_KEY); toast(e.message, true); }
  }

  function draw() {
    tbody.replaceChildren();
    items.forEach((r) => {
      const type = cfg.errorTypes.find((t) => t.code === r.error_type);
      tbody.append(h('tr', {
        class: 'row', tabindex: 0, 'aria-expanded': String(open.has(r.id)),
        onclick: () => { open.has(r.id) ? open.delete(r.id) : open.add(r.id); draw(); },
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } },
      },
      h('td', { class: 'hide-sm' }, r.id), h('td', null, fmtDate(r.date)), h('td', { class: 'hide-sm' }, r.pharmacy_name), h('td', null, r.drug_name),
      h('td', null, h('span', { class: 'code' }, r.error_type), h('span', { class: 'hide-sm' }, type.name)),
      h('td', { class: 'hide-sm' }, labelOf(cfg.times, r.time_of_day, 'name')), h('td', { class: 'hide-sm' }, labelOf(cfg.reportedBy, r.reported_by_role))));
      if (open.has(r.id)) tbody.append(detail(r));
    });
    const filtered = RF.pharmacy || RF.month || RF.type || RF.q;
    tableWrap.style.display = items.length ? '' : 'none';
    emptyBox.replaceChildren(items.length ? '' : h('div', { class: 'card empty' },
      h('h2', null, filtered ? 'Nothing matches these filters' : 'No near misses logged yet'),
      h('p', null, filtered ? 'Try a different month, pharmacy or search.' : 'When someone logs one, it will appear here.'),
      filtered ? null : h('a', { class: 'btn primary', href: '#/new' }, 'Log a near miss')));
    count.textContent = items.length ? `Showing ${items.length} of ${total}` : '';
    more.style.display = items.length < total ? '' : 'none';
  }

  async function load(reset) {
    const p = new URLSearchParams({ limit: 50, offset: reset ? 0 : items.length });
    Object.entries(RF).forEach(([k, v]) => v && p.set(k, v));
    try {
      const d = await api('/api/records?' + p);
      items = reset ? d.items : items.concat(d.items);
      total = d.total;
      draw();
    } catch (e) { toast(e.message, true); }
  }

  const root = h('div', null,
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Records'), h('p', null, 'Select a row to see the full details.')),
      h('a', { class: 'btn primary no-print', href: '#/new' }, 'Log a near miss')),
    filters, tableWrap, emptyBox, h('div', { class: 'actions', style: 'align-items:center;justify-content:space-between;margin-top:14px' }, count, more));
  await load(true);
  return root;
}

/* ------------------------------------------------------------ monthly report */
const RP = { month: (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; })(), pharmacy: '' };

async function reportView() {
  const cfg = S.cfg;
  const dataMonths = await api('/api/months');
  const out = h('div', { class: 'report-sheet' });
  const dl = h('a', { class: 'btn', download: '' }, 'Download Excel');

  const monthSel = h('select', { id: 'r-month', onchange: (e) => { RP.month = e.target.value; load(); } }, monthOptions(dataMonths).map((m) => opt(m, monthLabel(m), m === RP.month)));
  const phSel = h('select', { id: 'r-ph', onchange: (e) => { RP.pharmacy = e.target.value; load(); } }, opt('', 'All pharmacies', !RP.pharmacy), cfg.pharmacies.map((p) => opt(p.id, p.name, String(p.id) === RP.pharmacy)));

  function tally(sections) {
    return h('table', { class: 'tally' }, h('tbody', null, sections.map((s) => [
      h('tr', { class: 'sec' }, h('th', null, s.title), h('th', { class: 'n' }, s.total)),
      s.rows.map((r) => h('tr', { class: r.count ? '' : 'zero' }, h('td', null, r.label), h('td', { class: 'n' }, r.count))),
    ])));
  }

  async function load() {
    const q = new URLSearchParams({ month: RP.month, pharmacy: RP.pharmacy });
    dl.href = `/api/report.xlsx?${q}`;
    let rep;
    try { rep = await api(`/api/report?${q}`); } catch (e) { out.replaceChildren(h('div', { class: 'card' }, e.message)); return; }
    const sum = (a) => a.reduce((n, x) => n + x.count, 0);
    const pid = rep.pharmacy ? rep.pharmacy.id : null;
    const savedEl = h('span', { class: 'saved no-print' });
    const recInputs = {};
    let submitted, dept;

    const save = debounce(async () => {
      try {
        await api('/api/report/meta', { method: 'PUT', body: {
          month: rep.month, pharmacy_id: pid, submitted_by: submitted.value, department: dept.value,
          recs: Object.fromEntries(Object.entries(recInputs).map(([k, el]) => [k, el.value])) } });
        savedEl.textContent = 'Saved';
      } catch (e) { savedEl.textContent = ''; toast(e.message, true); }
    }, 600);
    const touched = () => { savedEl.textContent = 'Saving…'; save(); };

    const recTotal = h('th', { class: 'n' }, sum(rep.recs));
    const recRows = rep.recs.map((r) => {
      let cell;
      if (pid) {
        const el = h('input', { type: 'number', min: 0, max: 9999, value: String(r.count), 'aria-label': r.label, oninput: () => {
          recTotal.textContent = Object.values(recInputs).reduce((n, i) => n + (parseInt(i.value, 10) || 0), 0); touched(); } });
        recInputs[r.key] = el; cell = el;
      } else cell = r.count;
      return h('tr', { class: pid || r.count ? '' : 'zero' }, h('td', null, r.label), h('td', { class: 'n' }, cell));
    });

    if (pid) {
      submitted = h('input', { type: 'text', value: rep.meta.submitted_by, placeholder: 'Name', 'aria-label': 'Submitted by', maxlength: 120, oninput: touched });
      dept = h('input', { type: 'text', value: rep.meta.department, 'aria-label': 'Department', maxlength: 160, oninput: touched });
    }
    const head = h('div', { class: 'rep-head' },
      h('div', null, h('div', { class: 'k' }, 'Pharmacy'), h('div', { class: 'v' }, rep.pharmacy ? rep.pharmacy.name : 'All pharmacies')),
      h('div', null, h('div', { class: 'k' }, 'Month'), h('div', { class: 'v' }, monthLabel(rep.month))),
      h('div', null, h('div', { class: 'k' }, 'Department'), pid ? dept : h('div', { class: 'v' }, '–')),
      h('div', null, h('div', { class: 'k' }, 'Submitted by'), pid ? submitted : h('div', { class: 'v' }, '–')));

    const drugsCard = h('section', { class: 'card' }, h('h2', null, 'Drugs most frequently involved in near miss errors'),
      rep.drugs.length ? h('table', { class: 'tally' },
        h('thead', null, h('tr', null, h('th', { style: 'width:44px' }, '#'), h('th', null, 'Drug involved'), h('th', { class: 'n' }, 'Frequency'))),
        h('tbody', null, rep.drugs.map((d, i) => h('tr', null, h('td', null, i + 1),
          h('td', null, d.name, d.count > 1 ? h('span', { class: 'repeat' }, '  repeated') : null), h('td', { class: 'n' }, d.count)))))
        : h('p', { class: 'hint' }, 'No drugs recorded for this period.'),
      h('p', { class: 'hint' }, 'Drugs that show repeated human errors must be listed here.'));

    out.replaceChildren(
      h('section', { class: 'card' },
        h('div', { class: 'print-only' }, h('h1', null, 'Pharmacy Services Near Miss Summary Report')),
        h('div', { class: 'kpis', style: 'margin-bottom:18px' },
          h('div', null, h('div', { class: 'big' }, rep.total), h('div', { class: 'hint' }, rep.total === 1 ? 'near miss' : 'near misses')),
          h('div', null, h('div', { class: 'big' }, rep.adverseDiscussed), h('div', { class: 'hint' }, 'adverse event discussions completed'))),
        head, h('div', null, savedEl),
        rep.total === 0 ? h('p', { class: 'hint' }, 'No near misses were logged for this period.') : null),
      h('div', { class: 'rep-cols', style: 'margin-top:16px' },
        h('section', { class: 'card' }, h('h2', null, 'Table 1: Near miss error report'), tally([
          { title: 'Number of errors for the month', total: rep.total, rows: [] },
          { title: 'Error code / type of error', total: rep.total, rows: rep.types },
          { title: 'Time of day', total: sum(rep.times), rows: rep.times },
          { title: 'Personnel involved', total: sum(rep.personnel), rows: rep.personnel },
          { title: 'Reported by', total: sum(rep.reportedBy), rows: rep.reportedBy },
        ])),
        h('div', { class: 'stack' },
          h('section', { class: 'card' }, h('h2', null, 'Table 2'), tally([
            { title: 'Possible causes (non-exhaustive)', total: sum(rep.causes), rows: rep.causes },
            { title: 'Action taken', total: sum(rep.actions), rows: rep.actions },
          ])),
          h('section', { class: 'card' }, h('h2', null, 'Recommendations'),
            h('table', { class: 'tally' }, h('tbody', null, h('tr', { class: 'sec' }, h('th', null, 'Entered by the pharmacy each month'), recTotal), recRows)),
            h('p', { class: 'hint no-print' }, pid ? 'Type the monthly counts here. They save automatically.' : 'Choose a single pharmacy to enter these. Totals shown are the sum across pharmacies.')))),
      h('div', { style: 'margin-top:16px' }, drugsCard),
      rep.byPharmacy ? h('section', { class: 'card', style: 'margin-top:16px' }, h('h2', null, 'Near misses by pharmacy'),
        h('table', { class: 'tally' }, h('tbody', null, rep.byPharmacy.map((p) => h('tr', { class: p.count ? '' : 'zero' }, h('td', null, h('a', { href: '#/report', onclick: (e) => { e.preventDefault(); RP.pharmacy = String(p.id); phSel.value = RP.pharmacy; load(); } }, p.name)), h('td', { class: 'n' }, p.count)))))) : null);
  }

  const root = h('div', null,
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Monthly report'), h('p', null, 'Totals in the same layout as the summary report.')),
      h('div', { class: 'report-controls' },
        h('div', { class: 'field' }, h('label', { class: 'label', for: 'r-month' }, 'Month'), monthSel),
        h('div', { class: 'field' }, h('label', { class: 'label', for: 'r-ph' }, 'Pharmacy'), phSel),
        dl, h('button', { class: 'btn', onclick: () => window.print() }, 'Print'))),
    out);
  await load();
  return root;
}

/* ------------------------------------------------------------ settings (admin) */
const ST = { tab: 'drugs', drugQ: '' };

async function settingsView() {
  const root = h('div', { class: 'narrow' });
  async function unlocked() {
    try { await api('/api/admin/verify', { method: 'POST', admin: true }); return true; } catch (e) { return false; }
  }
  if (!getPin() || !(await unlocked())) return lockedView();
  return adminView();

  function lockedView() {
    sessionStorage.removeItem(PIN_KEY);
    const pin = h('input', { type: 'password', id: 'pin', autocomplete: 'off', placeholder: 'Administrator PIN' });
    const msg = h('div', { class: 'field-error', style: 'display:block', role: 'alert' });
    const form = h('form', { class: 'card pin-card stack', onsubmit: async (e) => {
      e.preventDefault();
      sessionStorage.setItem(PIN_KEY, pin.value);
      if (await unlocked()) route(); else { sessionStorage.removeItem(PIN_KEY); msg.textContent = "That PIN isn't right."; pin.select(); }
    } },
      h('h1', null, 'Settings'),
      h('p', { class: 'hint' }, 'The drug list and pharmacy list are managed here. Enter the administrator PIN to continue.'),
      h('label', { class: 'label', for: 'pin', style: 'margin:0' }, 'Administrator PIN'), pin, msg,
      h('button', { class: 'btn primary', type: 'submit' }, 'Unlock'));
    root.replaceChildren(form);
    return root;
  }

  async function adminView() {
    const body = h('div', { class: 'stack' });
    const tabs = h('div', { class: 'subtabs' });
    const draw = async () => {
      tabs.replaceChildren(...[['drugs', 'Drugs'], ['pharmacies', 'Pharmacies']].map(([k, l]) =>
        h('button', { class: ST.tab === k ? 'on' : '', onclick: () => { ST.tab = k; draw(); } }, l)));
      body.replaceChildren(h('p', { class: 'hint' }, 'Loading…'));
      body.replaceChildren(ST.tab === 'drugs' ? await drugsPanel() : await pharmaciesPanel());
    };
    root.replaceChildren(
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Settings'), h('p', null, 'Only people with the PIN can change these lists.')),
        h('button', { class: 'btn', onclick: () => { sessionStorage.removeItem(PIN_KEY); route(); } }, 'Lock')),
      tabs, body);
    await draw();
    return root;
  }

  async function refreshCatalog() {
    const [cfg, drugs] = await Promise.all([api('/api/config'), api('/api/drugs')]);
    S.cfg = cfg; setDrugs(drugs);
  }

  function row({ name, off, meta, onRename, onToggle, toggleLabel }) {
    const r = h('div', { class: 'list-row' + (off ? ' off' : '') });
    const view = () => r.replaceChildren(h('span', { class: 'nm' }, name), meta ? h('span', { class: 'hint' }, meta) : null,
      h('button', { class: 'btn small ghost', onclick: edit }, 'Rename'),
      h('button', { class: 'btn small', onclick: onToggle }, toggleLabel));
    const edit = () => {
      const inp = h('input', { type: 'text', value: name, maxlength: 200, 'aria-label': 'New name' });
      const go = async () => { if (inp.value.trim() && inp.value.trim() !== name) await onRename(inp.value); else view(); };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); if (e.key === 'Escape') view(); });
      r.replaceChildren(inp, h('button', { class: 'btn small primary', onclick: go }, 'Save'), h('button', { class: 'btn small', onclick: view }, 'Cancel'));
      inp.focus(); inp.select();
    };
    view();
    return r;
  }

  async function drugsPanel() {
    let all = await api('/api/admin/drugs', { admin: true }); // [id, name, active, uses]
    const listEl = h('div', { class: 'scroll-list' });
    const info = h('div', { class: 'hint' });
    const result = h('div', { class: 'hint', role: 'status', style: 'margin-top:8px' });

    async function patch(id, body) {
      try { await api(`/api/admin/drugs/${id}`, { method: 'PATCH', body, admin: true }); all = await api('/api/admin/drugs', { admin: true }); await refreshCatalog(); drawList(); }
      catch (e) { toast(e.message, true); }
    }
    function drawList() {
      const toks = ST.drugQ.toLowerCase().split(/\s+/).filter(Boolean);
      const hits = all.filter((d) => toks.every((t) => d[1].toLowerCase().includes(t)));
      const active = all.filter((d) => d[2]).length;
      info.textContent = `${active.toLocaleString()} in the dropdown, ${(all.length - active).toLocaleString()} hidden. ${toks.length ? `${hits.length} match.` : ''}`;
      listEl.replaceChildren(...hits.slice(0, 100).map((d) => row({
        name: d[1], off: !d[2], meta: d[3] ? `${d[3]} record${d[3] > 1 ? 's' : ''}` : '', toggleLabel: d[2] ? 'Hide' : 'Show',
        onRename: (n) => patch(d[0], { name: n }), onToggle: () => patch(d[0], { active: !d[2] }) })),
        hits.length > 100 ? h('div', { class: 'combo-more' }, `${hits.length - 100} more. Search to narrow the list.`) : null,
        hits.length ? null : h('div', { class: 'combo-empty' }, 'No drugs match.'));
    }
    async function add(names, clear) {
      try {
        const r = await api('/api/admin/drugs', { method: 'POST', body: { names }, admin: true });
        const bits = [];
        if (r.added) bits.push(`${r.added} added`);
        if (r.restored) bits.push(`${r.restored} restored`);
        if (r.skipped.length) bits.push(`${r.skipped.length} already on the list`);
        result.textContent = bits.join(', ') + '.';
        if (r.added || r.restored) { clear(); all = await api('/api/admin/drugs', { admin: true }); await refreshCatalog(); drawList(); }
      } catch (e) { toast(e.message, true); }
    }
    const one = h('input', { type: 'text', maxlength: 200, placeholder: 'e.g. METFORMIN TAB 500MG (BRAND)/100PK', 'aria-label': 'Drug name' });
    const many = h('textarea', { placeholder: 'One drug per line', 'aria-label': 'Drugs, one per line' });
    const addCard = h('section', { class: 'card' }, h('h2', null, 'Add a drug'),
      h('p', { class: 'hint', style: 'margin-top:-8px' }, 'Use the same style as the list: name, form, strength, (brand)/pack size.'),
      h('form', { class: 'actions', style: 'flex-wrap:nowrap', onsubmit: (e) => { e.preventDefault(); add([one.value], () => { one.value = ''; }); } }, one, h('button', { class: 'btn primary', type: 'submit' }, 'Add')),
      h('details', { style: 'margin-top:14px' }, h('summary', { style: 'cursor:pointer;font-weight:600' }, 'Add several at once'),
        h('div', { style: 'margin-top:10px' }, many, h('button', { class: 'btn', style: 'margin-top:10px', onclick: () => add(many.value, () => { many.value = ''; }) }, 'Add all'))),
      result);
    const q = h('input', { type: 'search', placeholder: 'Search the drug list…', value: ST.drugQ, 'aria-label': 'Search drugs', oninput: debounce((e) => { ST.drugQ = e.target.value; drawList(); }, 150) });
    drawList();
    return h('div', { class: 'stack' }, addCard,
      h('section', { class: 'card' }, h('h2', null, 'Drug list'),
        h('p', { class: 'hint', style: 'margin-top:-8px' }, 'Hidden drugs leave the dropdown but stay on old records. Drugs used in records can be hidden, not deleted.'),
        q, h('div', { style: 'margin:10px 0' }, info), listEl));
  }

  async function pharmaciesPanel() {
    let all = await api('/api/admin/pharmacies', { admin: true });
    const listEl = h('div', null);
    async function patch(id, body) {
      try { await api(`/api/admin/pharmacies/${id}`, { method: 'PATCH', body, admin: true }); all = await api('/api/admin/pharmacies', { admin: true }); await refreshCatalog(); drawList(); }
      catch (e) { toast(e.message, true); }
    }
    function drawList() {
      listEl.replaceChildren(...all.map((p) => row({ name: p.name, off: !p.active, meta: p.uses ? `${p.uses} record${p.uses > 1 ? 's' : ''}` : '', toggleLabel: p.active ? 'Hide' : 'Show',
        onRename: (n) => patch(p.id, { name: n }), onToggle: () => patch(p.id, { active: !p.active }) })));
    }
    const nameIn = h('input', { type: 'text', maxlength: 120, placeholder: 'Pharmacy name', 'aria-label': 'Pharmacy name' });
    drawList();
    return h('div', { class: 'stack' },
      h('section', { class: 'card' }, h('h2', null, 'Add a pharmacy'),
        h('form', { class: 'actions', style: 'flex-wrap:nowrap', onsubmit: async (e) => {
          e.preventDefault();
          try { await api('/api/admin/pharmacies', { method: 'POST', body: { name: nameIn.value }, admin: true }); nameIn.value = ''; all = await api('/api/admin/pharmacies', { admin: true }); await refreshCatalog(); drawList(); toast('Pharmacy added'); }
          catch (err) { toast(err.message, true); }
        } }, nameIn, h('button', { class: 'btn primary', type: 'submit' }, 'Add'))),
      h('section', { class: 'card' }, h('h2', null, 'Pharmacies'), listEl));
  }
}

/* ------------------------------------------------------------ router */
function setDrugs(list) {
  S.drugs = list.map(([id, name]) => ({ id, name, k: name.toLowerCase() }));
}

async function route() {
  const [, name = 'new', arg] = (location.hash || '#/new').split('/');
  document.querySelectorAll('[data-route]').forEach((a) => a.classList.toggle('on', a.dataset.route === (name === 'edit' ? 'records' : name)));
  try {
    let node;
    if (name === 'edit') node = formView(await api(`/api/records/${parseInt(arg, 10)}`));
    else if (name === 'records') node = await recordsView();
    else if (name === 'report') node = await reportView();
    else if (name === 'settings') node = await settingsView();
    else node = formView(null);
    view.replaceChildren(node);
    window.scrollTo(0, 0);
  } catch (e) {
    view.replaceChildren(h('div', { class: 'card empty' }, h('h2', null, 'Something went wrong'), h('p', null, e.message),
      h('button', { class: 'btn', onclick: () => location.reload() }, 'Try again')));
  }
}

async function start() {
  try {
    const [cfg, drugs] = await Promise.all([api('/api/config'), api('/api/drugs')]);
    S.cfg = cfg; setDrugs(drugs);
  } catch (e) {
    view.replaceChildren(h('div', { class: 'card empty' }, h('h2', null, "Can't load the app"), h('p', null, e.message), h('button', { class: 'btn', onclick: () => location.reload() }, 'Try again')));
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}
start();
})();

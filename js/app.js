/* js/app.js — entry point, wires everything together and handles navigation */

let currentView = 'dashboard';
let currentNiveau = null;
let currentClasse = null;
let highlightStudentId = null;
let classeStudents = [];

/* ---------- School year ---------- */
const YEAR_COUNT = 10;

function baseAnnee() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 7 ? y : y - 1; // nouvelle saison dès août
}

function anneesProposees() {
  const b = baseAnnee();
  return Array.from({ length: YEAR_COUNT }, (_, i) => `${b + i}-${b + i + 1}`);
}

let ANNEE = (function () {
  try {
    const saved = localStorage.getItem('slah_annee');
    if (saved && /^\d{4}-\d{4}$/.test(saved)) return saved;
  } catch (error) { /* ignore */ }
  return `${baseAnnee()}-${baseAnnee() + 1}`;
})();

const STRUCTURE = [
  { niveau: '7ème Primaire',     classes: ['Classe A', 'Classe B'] },
  { niveau: '8ème Primaire',     classes: ['Classe A', 'Classe B'] },
  { niveau: '9ème Primaire',     classes: ['Classe A', 'Classe B'] },
  { niveau: '1ère Secondaire',   classes: ['Classe A', 'Classe B'] },
  { niveau: '2ème Secondaire',   classes: ['ECO', 'Info+Science'] },
  { niveau: '3ème Secondaire',   classes: ['ECO', 'Info'] },
  { niveau: 'Bac',               classes: ['ECO', 'Info'] }
];

/* ---------- État dans l'URL (#/classe/...) : le rafraîchissement reste sur place ---------- */

let suppressHashChange = false;

function updateHash(view, niveau, classe) {
  let target = '#/dashboard';
  if (view === 'classe' && niveau && classe) {
    target = '#/classe/' + encodeURIComponent(niveau) + '/' + encodeURIComponent(classe);
  }
  if (location.hash === target) return;
  suppressHashChange = true;
  location.hash = target;
  // Si aucun événement hashchange ne se déclenche, réarme le garde-fou
  setTimeout(() => { suppressHashChange = false; }, 0);
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!raw || raw.startsWith('dashboard')) return { view: 'dashboard' };
  const parts = raw.split('/').map((p) => {
    try { return decodeURIComponent(p); } catch (error) { return p; }
  });
  if (parts[0] === 'classe' && parts.length >= 3) {
    const group = STRUCTURE.find((g) => g.niveau === parts[1]);
    if (group && group.classes.includes(parts[2])) {
      return { view: 'classe', niveau: parts[1], classe: parts[2] };
    }
  }
  return { view: 'dashboard' };
}

window.addEventListener('hashchange', () => {
  if (suppressHashChange) { suppressHashChange = false; return; }
  const s = parseHash();
  navigateTo(s.view, s.niveau || null, s.classe || null);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Rejet non géré:', e.reason);
  if (!(e.reason && e.reason.redirecting)) {
    showToast('Erreur inattendue. Réessayez.', 'error');
  }
});

window.addEventListener('error', (e) => {
  console.error('Erreur JavaScript:', e.error || e.message);
  showToast('Erreur inattendue. Réessayez.', 'error');
});

function isAuthRedirect(error) {
  return !!(error && error.redirecting);
}

async function navigateTo(view, niveau = null, classe = null, studentId = null) {
  currentView = view;
  currentNiveau = niveau;
  currentClasse = classe;
  highlightStudentId = studentId;
  updateHash(view, niveau, classe);
  renderSidebar(niveau, classe);
  renderIconRail(niveau);
  const token = showLoadingState();

  try {
    if (view === 'dashboard') {
      const [allStudents, stats] = await Promise.all([
        getEnrichedStudents(ANNEE),
        getStats(ANNEE)
      ]);
      if (token !== loadToken) return;
      const lateStudents = allStudents.filter((s) => s.computed.hasRetard);
      const riskStudents = allStudents.filter((s) => !s.computed.hasRetard && moisImpayes(s.paiements).length > 0);
      const partialStudents = allStudents.filter((s) => MOIS_ORDER.some((m) => s.paiements[m] === 'partiel'));
      renderDashboard({ lateStudents, riskStudents, partialStudents }, stats);
    } else if (view === 'classe') {
      const students = await getClasseData(niveau, classe, ANNEE);
      if (token !== loadToken) return;
      classeStudents = students;
      renderClasseView(niveau, classe, students, studentId);
      wireSearch();
    }
  } catch (error) {
    console.error(error);
    if (!isAuthRedirect(error)) {
      showToast(error.message || 'Erreur inattendue.', 'error');
      const main = document.getElementById('mainContent');
      if (main) {
        const msg = esc(error.message || 'Erreur inattendue.');
        main.innerHTML = `
          <div class="error-state">
            <div class="error-state-msg">${msg}</div>
            <button class="btn btn-primary" id="btnRetry">Réessayer</button>
          </div>`;
        const retryBtn = document.getElementById('btnRetry');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => navigateTo(view, niveau, classe, studentId));
        }
      }
    }
  } finally {
    if (token === loadToken) hideLoadingState();
  }
}

let loadToken = 0;
let loadWatchdog = null;

function showLoadingState() {
  loadToken += 1;
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.hidden = false;
  clearTimeout(loadWatchdog);
  loadWatchdog = setTimeout(() => {
    const ov = document.getElementById('loadingOverlay');
    if (ov) ov.hidden = true;
    showToast('Chargement trop long. Vérifiez votre connexion.', 'error');
  }, 10000);
  return loadToken;
}

function hideLoadingState() {
  clearTimeout(loadWatchdog);
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.hidden = true;
}

/* ---------- Sélecteur d'année scolaire ---------- */

function closeYearMenus() {
  document.querySelectorAll('.year-menu').forEach((m) => { m.hidden = true; });
}

function toggleYearMenu(menu) {
  if (!menu) return;
  const willOpen = menu.hidden;
  closeYearMenus();
  if (!willOpen) return;
  menu.hidden = false;
  menu.innerHTML = '<div class="year-loading">…</div>';
  fillYearMenu(menu);
}

async function fillYearMenu(menu) {
  let dbYears = [];
  try {
    dbYears = await getAnneesScolaires() || [];
  } catch (error) {
    console.error(error);
  }
  if (menu.hidden) return;
  const years = [...new Set([...dbYears, ANNEE, ...anneesProposees()])].sort();
  renderYearOptions(menu, years, ANNEE);
}

async function setAnnee(annee) {
  closeYearMenus();
  if (!/^\d{4}-\d{4}$/.test(annee) || annee === ANNEE) return;
  ANNEE = annee;
  try { localStorage.setItem('slah_annee', ANNEE); } catch (error) { /* ignore */ }
  const badge = document.getElementById('anneeBadge');
  if (badge) badge.textContent = ANNEE.replace('-', '\u2013');
  await navigateTo(currentView === 'classe' ? 'classe' : 'dashboard', currentNiveau, currentClasse);
}

function setupYearPicker() {
  document.addEventListener('click', (e) => {
    const option = e.target.closest('[data-annee]');
    if (option) { setAnnee(option.dataset.annee); return; }
    if (e.target.closest('#anneeBadge') || e.target.closest('#yearPill')) {
      const wrap = e.target.closest('.year-wrap');
      toggleYearMenu(wrap && wrap.querySelector('.year-menu'));
      return;
    }
    if (!e.target.closest('.year-wrap')) {
      closeYearMenus();
      const reportMenu = document.getElementById('reportMenu');
      if (reportMenu && !e.target.closest('.report-wrap')) reportMenu.hidden = true;
    }
  });
}

/* ---------- Rapport classe : impression & export CSV ---------- */

const STATUT_LABELS = { paye: 'Payé', impaye: 'Impayé', partiel: 'Partiel' };

/* Encodage Windows-1252 : Excel décode nativement, les accents restent corrects */
const CP1252_EXTRA = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
  0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
  0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
  0x017E: 0x9E, 0x0178: 0x9F
};

function toCp1252Bytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 256) bytes[i] = c;
    else if (CP1252_EXTRA[c] !== undefined) bytes[i] = CP1252_EXTRA[c];
    else bytes[i] = 63; // ?
  }
  return bytes;
}

function classeFileSlug() {
  const raw = `${currentNiveau || 'classe'}-${currentClasse || ''}-${ANNEE}`;
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-');
}

function exportClasseCsv() {
  const head = ['Niveau', 'Classe', 'Année', 'Numéro', 'Nom complet', 'Contact parent', 'Note']
    .concat(MOIS_ORDER.map((m) => moisLabel(m)))
    .concat(['Mois payés', 'En retard']);
  const lines = [head];
  classeStudents.forEach((s) => {
    lines.push([
      s.niveau, s.classe, s.anneeScolaire, s.numero || '', s.nomComplet,
      s.contactParent || '', s.note || ''
    ].concat(MOIS_ORDER.map((m) => STATUT_LABELS[s.paiements[m]] || ''))
     .concat([`${s.computed.moisPayes}/10`, s.computed.hasRetard ? 'Oui' : 'Non']));
  });
  const csv = 'sep=;\r\n' + lines
    .map((r) => r.map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(';'))
    .join('\r\n');
  const blob = new Blob([toCp1252Bytes(csv)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rapport-${classeFileSlug()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Export CSV téléchargé.', 'success');
}

function buildPrintReport() {
  const moisCourant = moisCourantKey();
  const payesCeMois = classeStudents.filter((s) => s.paiements[moisCourant] === 'paye').length;
  const retards = classeStudents.filter((s) => s.computed.hasRetard).length;
  const genere = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  let rows = '';
  [...classeStudents]
    .sort((a, b) => (a.numero || 0) - (b.numero || 0))
    .forEach((s) => {
      let cells = `<td class="p-num">${s.numero || ''}</td><td class="p-nom">${esc(s.nomComplet)}${s.note ? `<span class="p-note">${esc(s.note)}</span>` : ''}</td><td>${esc(s.contactParent || '')}</td>`;
      MOIS_ORDER.forEach((m) => { cells += `<td class="p-mois">${statutGlyph(s.paiements[m])}</td>`; });
      cells += `<td class="p-payes">${s.computed.moisPayes}/10</td><td class="p-retard">${s.computed.hasRetard ? '⚠' : ''}</td>`;
      rows += `<tr>${cells}</tr>`;
    });

  let heads = '<tr><th>#</th><th>Nom complet</th><th>Contact</th>';
  MOIS_ORDER.forEach((m) => { heads += `<th>${esc(MOIS_COURTS[m])}</th>`; });
  heads += '<th>Payés</th><th>Retard</th></tr>';

  return `
    <div class="p-head">
      <div class="p-title">SLAH Academy — ${esc(currentNiveau || '')} · ${esc(currentClasse || '')}</div>
      <div class="p-sub">Année ${esc(ANNEE)} · Généré le ${genere}</div>
      <div class="p-stats">${classeStudents.length} élèves · ${payesCeMois} payés en ${esc(moisLabel(moisCourant))} · ${retards} en retard</div>
    </div>
    <table class="p-table"><thead>${heads}</thead><tbody>${rows || '<tr><td colspan="15" class="p-empty">Aucun élève.</td></tr>'}</tbody></table>
    <div class="p-legend">Légende : ✓ payé · ✗ impayé · ~ partiel · · non renseigné</div>`;
}

function printClasse() {
  let holder = document.getElementById('printReport');
  if (!holder) {
    holder = document.createElement('div');
    holder.id = 'printReport';
    document.body.appendChild(holder);
  }
  holder.innerHTML = buildPrintReport();
  window.print();
}

async function init() {
  try {
    initSupabase();
  } catch (error) {
    console.error(error);
    window.location.href = 'index.html';
    return;
  }

  const session = await getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const emailEl = document.getElementById('userEmail');
  if (emailEl && session.user && session.user.email) {
    emailEl.textContent = session.user.email;
  }

  const badge = document.getElementById('anneeBadge');
  if (badge) badge.textContent = ANNEE.replace('-', '\u2013');

  // Event delegation: sidebar navigation
  const sideNav = document.getElementById('sideNav');
  if (sideNav) {
    sideNav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view], [data-niveau]');
      if (!btn) return;
      closeDrawer();
      if (btn.dataset.view === 'dashboard') {
        navigateTo('dashboard');
      } else if (btn.dataset.niveau) {
        navigateTo('classe', btn.dataset.niveau, btn.dataset.classe);
      }
      // Panneau flottant : se referme après navigation
      if (!navPinned) document.documentElement.classList.remove('nav-open');
    });
  }

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logout();
      window.location.href = 'index.html';
    });
  }

  // Global click delegation for dynamically rendered content
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('dblclick', handleGlobalDblClick);
  document.addEventListener('submit', handleGlobalSubmit);

  setupDragAndDrop();
  setupYearPicker();
  setupMobileNav();
  setupIconRail();

  // Restaure la vue depuis l'URL (#/classe/...) — sinon tableau de bord
  const initial = parseHash();
  await navigateTo(initial.view, initial.niveau || null, initial.classe || null);
}

function handleGlobalClick(e) {
  // Only care about clicks inside #mainContent (tables, add panel)
  const main = document.getElementById('mainContent');
  if (!main || !main.contains(e.target)) return;

  // Month statut chip → optimistic update
  const chip = e.target.closest('.statut-chip');
  if (chip) {
    handleChipClick(chip);
    return;
  }

  // Back to dashboard from a classe view
  const backBtn = e.target.closest('#btnBackDashboard');
  if (backBtn) {
    navigateTo('dashboard');
    return;
  }

  // Rapport : menu imprimer / exporter
  const reportBtn = e.target.closest('#btnReport');
  if (reportBtn) {
    const menu = document.getElementById('reportMenu');
    if (menu) menu.hidden = !menu.hidden;
    return;
  }
  const reportAction = e.target.closest('[data-report-action]');
  if (reportAction) {
    const menu = document.getElementById('reportMenu');
    if (menu) menu.hidden = true;
    if (reportAction.dataset.reportAction === 'csv') exportClasseCsv();
    else printClasse();
    return;
  }

  // Bulk: whole class paid for one month (header ✓)
  const markBtn = e.target.closest('.th-mark');
  if (markBtn) {
    beginMonthBulk(markBtn);
    return;
  }

  // Bulk: all months paid for one student
  const allPaidBtn = e.target.closest('.btn-allpaid');
  if (allPaidBtn) {
    const tr = allPaidBtn.closest('tr');
    if (tr) markStudentAllPaid(tr.dataset.studentId);
    return;
  }

  // Delete / confirm buttons
  const delBtn = e.target.closest('.btn-delete');
  if (delBtn) {
    const tr = delBtn.closest('tr');
    if (tr) showDeleteConfirm(tr);
    return;
  }

  const yesBtn = e.target.closest('.btn-confirm-yes');
  if (yesBtn) {
    const tr = yesBtn.closest('tr');
    if (tr) doDeleteStudent(tr);
    return;
  }

  const noBtn = e.target.closest('.btn-confirm-no');
  if (noBtn) {
    const tr = noBtn.closest('tr');
    if (tr) hideDeleteConfirm(tr);
    return;
  }

  // Add student toggle
  const addBtn = e.target.closest('#btnAddStudent');
  if (addBtn) {
    toggleAddPanel();
    return;
  }
  const cancelBtn = e.target.closest('#btnAddCancel');
  if (cancelBtn) {
    closeAddPanel();
    return;
  }
}

function handleGlobalDblClick(e) {
  const main = document.getElementById('mainContent');
  if (!main || !main.contains(e.target)) return;

  const cell = e.target.closest('.editable-cell');
  if (cell) {
    startInlineEdit(cell);
  }
}

function handleGlobalSubmit(e) {
  const main = document.getElementById('mainContent');
  if (!main || !main.contains(e.target)) return;

  const form = e.target.closest('#addPanel');
  if (form) {
    e.preventDefault();
    doAddStudent(form);
  }
}

/* ---------- Month cell optimistic update ---------- */

function handleChipClick(chip) {
  const studentId = chip.dataset.studentId;
  const mois = chip.dataset.mois;
  const currentStatut = chip.dataset.statut || '';
  const next = nextStatut(currentStatut);

  const student = classeStudents.find((s) => s.id === studentId);
  if (!student) return;

  // Optimistic update — apply to memory + UI immediately
  student.paiements[mois] = next;
  refreshComputed(student);
  updateCell(studentId, mois, next);
  chip.classList.add('chip-loading');

  const prevStatut = currentStatut;
  const revert = () => {
    student.paiements[mois] = prevStatut;
    refreshComputed(student);
    updateCell(studentId, mois, prevStatut);
    updateRowAfterChange(studentId);
    renderSummaryBar(classeStudents);
  };

  const run = async () => {
    try {
      if (next === '') {
        await deletePaiement(studentId, mois);
      } else {
        await setPaiement(studentId, mois, next);
      }
      chip.classList.remove('chip-loading');
      updateRowAfterChange(studentId);
      renderSummaryBar(classeStudents);
    } catch (error) {
      console.error(error);
      chip.classList.remove('chip-loading');
      if (isAuthRedirect(error)) return;
      revert();
      showToast('Erreur — réessayez.', 'error');
    }
  };
  run();
}

function refreshComputed(student) {
  student.computed.moisPayes = moisPayes(student.paiements);
  student.computed.moisManquants = moisManquants(student.paiements);
  student.computed.hasRetard = hasRetard(student.paiements);
  student.computed.whatsapp = whatsappLink(student.contactParent);
}

/* ---------- Recherche élève ---------- */

function normText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function applySearchFilter() {
  const input = document.getElementById('studentSearch');
  if (!input) return;
  const clearBtn = document.getElementById('searchClear');
  const hint = document.getElementById('searchHint');
  const q = normText(input.value.trim());
  const tbody = document.querySelector('#studentTable tbody');
  const rows = Array.from(document.querySelectorAll('#studentTable tbody tr[data-student-id]'));
  let visible = 0;

  rows.forEach((tr) => {
    const s = classeStudents.find((x) => x.id === tr.dataset.studentId);
    const hay = s
      ? `${normText(s.nomComplet)} ${normText(s.contactParent)} ${s.numero || ''}`
      : normText(tr.textContent);
    const show = !q || hay.includes(q);
    tr.style.display = show ? '' : 'none';
    if (show) visible++;
  });

  if (clearBtn) clearBtn.hidden = !input.value;
  if (hint) hint.textContent = q && rows.length ? `${visible}/${rows.length} affichés` : '';

  let emptyRow = tbody && tbody.querySelector('tr.search-empty');
  if (!visible && rows.length) {
    if (!emptyRow) {
      emptyRow = document.createElement('tr');
      emptyRow.className = 'search-empty';
      emptyRow.innerHTML = `<td colspan="${MOIS_ORDER.length + 8}" style="text-align:center;color:var(--text-tertiary);padding:28px;"></td>`;
      tbody.appendChild(emptyRow);
    }
    emptyRow.style.display = '';
    emptyRow.querySelector('td').textContent = `Aucun élève trouvé pour « ${input.value.trim()} ».`;
  } else if (emptyRow) {
    emptyRow.remove();
  }
}

function wireSearch() {
  const input = document.getElementById('studentSearch');
  if (!input) return;
  input.addEventListener('input', applySearchFilter);
  const clearBtn = document.getElementById('searchClear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      applySearchFilter();
      input.focus();
    });
  }
}

/* ---------- Marquage groupé ---------- */

async function markStudentAllPaid(studentId) {
  const student = classeStudents.find((s) => s.id === studentId);
  if (!student) return;
  const months = MOIS_ORDER.filter((m) => student.paiements[m] !== 'paye');
  if (!months.length) {
    showToast('Tous les mois sont déjà payés.', 'info');
    return;
  }

  const snapshot = months.map((m) => [m, student.paiements[m]]);
  months.forEach((m) => { student.paiements[m] = 'paye'; });
  refreshComputed(student);
  months.forEach((m) => updateCell(studentId, m, 'paye'));
  updateRowAfterChange(studentId);
  renderSummaryBar(classeStudents);

  try {
    await Promise.all(months.map((m) => setPaiement(studentId, m, 'paye')));
    showToast(`${months.length} mois mis à jour — élève à jour.`, 'success');
  } catch (error) {
    console.error(error);
    if (isAuthRedirect(error)) return;
    snapshot.forEach(([m, prev]) => { student.paiements[m] = prev; updateCell(studentId, m, prev); });
    refreshComputed(student);
    updateRowAfterChange(studentId);
    renderSummaryBar(classeStudents);
    showToast('Erreur — réessayez.', 'error');
  }
}

function restoreMonthTh(th, mois) {
  delete th.dataset.confirming;
  th.innerHTML = `<span>${esc(MOIS_COURTS[mois])}</span><button type="button" class="th-mark" data-mois="${mois}" title="Classe entière « payé » en ${esc(moisLabel(mois))}">✓</button>`;
}

function beginMonthBulk(btn) {
  const th = btn.closest('th');
  const mois = btn.dataset.mois;
  if (!th || !mois || th.dataset.confirming === '1') return;
  if (!classeStudents.some((s) => s.paiements[mois] !== 'paye')) {
    showToast(`Classe déjà à jour pour ${moisLabel(mois)}.`, 'info');
    return;
  }
  th.dataset.confirming = '1';
  th.innerHTML = `<button type="button" class="th-bulk-yes">Tout ✓</button><button type="button" class="th-bulk-no">Non</button>`;
  th.querySelector('.th-bulk-yes').addEventListener('click', () => doMonthBulk(mois, th));
  th.querySelector('.th-bulk-no').addEventListener('click', () => restoreMonthTh(th, mois));
}

async function doMonthBulk(mois, th) {
  th.innerHTML = '<div class="th-loading">…</div>';
  const targets = classeStudents.filter((s) => s.paiements[mois] !== 'paye');

  try {
    await Promise.all(targets.map((s) => setPaiement(s.id, mois, 'paye')));
    targets.forEach((s) => {
      s.paiements[mois] = 'paye';
      refreshComputed(s);
      updateCell(s.id, mois, 'paye');
      updateRowAfterChange(s.id);
    });
    renderSummaryBar(classeStudents);
    restoreMonthTh(th, mois);
    showToast(`${targets.length} élève(s) marqués « payé » — ${moisLabel(mois)}.`, 'success');
  } catch (error) {
    console.error(error);
    if (!isAuthRedirect(error)) showToast('Erreur — réessayez.', 'error');
    restoreMonthTh(th, mois);
  }
}

/* ---------- Navigation mobile ---------- */

function closeDrawer() {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('drawerBackdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.hidden = true;
}

function setupMobileNav() {
  const toggle = document.getElementById('navToggle');
  const backdrop = document.getElementById('drawerBackdrop');
  const sidebar = document.querySelector('.sidebar');
  if (!toggle || !backdrop || !sidebar) return;
  toggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    backdrop.hidden = !open;
  });
  backdrop.addEventListener('click', closeDrawer);
}

/* ---------- Rail d'icônes + panneau épinglable ---------- */

let navPinned = true;

function applyNavPin() {
  document.documentElement.classList.toggle('nav-pinned', navPinned);
  const pinBtn = document.getElementById('navPinBtn');
  if (pinBtn) pinBtn.setAttribute('aria-pressed', String(navPinned));
  try { localStorage.setItem('slah_nav_pinned', navPinned ? '1' : '0'); } catch (error) { /* ignore */ }
}

function setNavPinned(value) {
  navPinned = !!value;
  applyNavPin();
  if (!navPinned) document.documentElement.classList.remove('nav-open');
}

function setupIconRail() {
  const rail = document.getElementById('iconRail');
  const sidebar = document.querySelector('.sidebar');
  const pinBtn = document.getElementById('navPinBtn');
  if (!rail || !sidebar || !pinBtn) return;

  let stored = null;
  try {
    localStorage.removeItem('slah_sidebar'); // ancien système peek
    stored = localStorage.getItem('slah_nav_pinned');
  } catch (error) { /* ignore */ }
  navPinned = stored !== '0';
  applyNavPin();

  pinBtn.addEventListener('click', () => setNavPinned(!navPinned));

  rail.addEventListener('click', (e) => {
    if (e.target.closest('[data-rail-logout]')) {
      logout().then(() => { window.location.href = 'index.html'; });
      return;
    }
    if (e.target.closest('[data-rail-view]')) {
      document.documentElement.classList.add('nav-open');
      // Déjà sur le tableau de bord : inutile de recharger
      if (currentView !== 'dashboard') navigateTo('dashboard');
      return;
    }
    if (e.target.closest('[data-rail-niveau]')) {
      document.documentElement.classList.add('nav-open');
    }
  });

  let closeTimer = null;

  // Clic en dehors du panneau (mode détaché) → le refermer
  document.addEventListener('click', (e) => {
    if (navPinned || !document.documentElement.classList.contains('nav-open')) return;
    if (e.target.closest('.sidebar') || e.target.closest('.icon-rail')) return;
    clearTimeout(closeTimer);
    document.documentElement.classList.remove('nav-open');
  });

  // Changement de breakpoint : referme le panneau flottant proprement
  window.matchMedia('(max-width: 900px)').addEventListener('change', () => {
    document.documentElement.classList.remove('nav-open');
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'b') {
      e.preventDefault();
      setNavPinned(!navPinned);
    } else if (e.key === 'Escape' && !navPinned) {
      document.documentElement.classList.remove('nav-open');
    }
  });
}

function updateRowAfterChange(studentId) {
  const student = classeStudents.find((s) => s.id === studentId);
  if (!student) return;
  const tr = document.querySelector(`#studentTable tr[data-student-id="${studentId}"]`);
  if (tr) updateRowCell(tr, student);
}

/* ---------- Inline edit ---------- */

let editingCell = null;

function startInlineEdit(cell) {
  if (editingCell === cell) return;
  if (editingCell) commitInlineEdit(true);

  editingCell = cell;
  cell.contentEditable = 'true';
  cell.classList.add('editing');
  cell.focus();
  const range = document.createRange();
  range.selectNodeContents(cell);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  cell.addEventListener('blur', handleInlineBlur);
}

function handleInlineBlur() {
  if (editingCell) commitInlineEdit(false);
}

function commitInlineEdit(cancel) {
  const cell = editingCell;
  if (!cell) return;
  editingCell = null;

  const tr = cell.closest('tr');
  const studentId = tr && tr.dataset.studentId;
  const field = cell.dataset.field;
  const student = classeStudents.find((s) => s.id === studentId);
  if (!student) return;

  const previousValue = String(student[field] == null ? '' : student[field]);
  const newValue = cell.textContent.trim();

  cell.contentEditable = 'false';
  cell.classList.remove('editing');

  if (cancel || previousValue === newValue) {
    cell.textContent = previousValue;
    return;
  }

  // Optimistic
  student[field] = newValue;
  if (field === 'contactParent') refreshComputed(student);
  cell.textContent = newValue;
  updateRowAfterChange(studentId);

  const payload = {};
  payload[field] = newValue;
  updateStudent(studentId, payload)
    .then(() => {})
    .catch((error) => {
      console.error(error);
      if (isAuthRedirect(error)) return;
      student[field] = previousValue;
      if (field === 'contactParent') refreshComputed(student);
      cell.textContent = previousValue;
      updateRowAfterChange(studentId);
      showToast('Erreur lors de la modification de l\u2019élève.', 'error');
    });
}

function handleInlineKeydown(e) {
  if (!editingCell) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    commitInlineEdit(false);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    commitInlineEdit(true);
  }
}

/* ---------- Delete with inline confirm ---------- */

function showDeleteConfirm(tr) {
  const actionsCell = tr.querySelector('.col-actions');
  if (!actionsCell) return;
  tr.classList.add('row-confirm');
  actionsCell.innerHTML = `<span class="confirm-text">Supprimer ?</span>
    <button class="btn-confirm-yes">Oui</button>
    <button class="btn-confirm-no">Non</button>`;
}

function hideDeleteConfirm(tr) {
  const studentId = tr.dataset.studentId;
  const student = classeStudents.find((s) => s.id === studentId);
  if (!student) return;
  tr.classList.remove('row-confirm');
  const newTr = renderStudentRow(student);
  tr.replaceWith(newTr);
  applySearchFilter();
}

function doDeleteStudent(tr) {
  const studentId = tr.dataset.studentId;
  tr.classList.add('row-deleting');

  deleteStudent(studentId)
    .then(() => {
      classeStudents = classeStudents.filter((s) => s.id !== studentId);
      tr.remove();
      renderSummaryBar(classeStudents);
      applySearchFilter();
      showToast('Élève supprimé.', 'success');
      if (!classeStudents.length) renderEmptyTable();
    })
    .catch((error) => {
      console.error(error);
      tr.classList.remove('row-deleting', 'row-confirm');
      if (isAuthRedirect(error)) return;
      hideDeleteConfirm(tr);
      showToast(error.message || 'Erreur lors de la suppression de l\u2019élève.', 'error');
    });
}

/* ---------- Drag and drop reorder ---------- */

function setupDragAndDrop() {
  const main = document.getElementById('mainContent');
  if (!main) return;

  main.addEventListener('dragstart', (e) => {
    const tr = e.target.closest('#studentTable tbody tr[data-student-id]');
    if (!tr) return;
    tr.classList.add('dragging');
    e.dataTransfer.setData('text/plain', tr.dataset.studentId);
    e.dataTransfer.effectAllowed = 'move';
  });

  main.addEventListener('dragover', (e) => {
    const tr = e.target.closest('#studentTable tbody tr[data-student-id]');
    if (!tr) return;
    e.preventDefault();
    tr.classList.add('drag-over');
  });

  main.addEventListener('dragleave', (e) => {
    const tr = e.target.closest('#studentTable tbody tr[data-student-id]');
    if (tr) tr.classList.remove('drag-over');
  });

  main.addEventListener('drop', (e) => {
    e.preventDefault();
    const targetTr = e.target.closest('#studentTable tbody tr[data-student-id]');
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!targetTr || !sourceId || sourceId === targetTr.dataset.studentId) return;
    const targetId = targetTr.dataset.studentId;
    const allTr = Array.from(document.querySelectorAll('#studentTable tbody tr[data-student-id]'));
    allTr.forEach((tr) => tr.classList.remove('dragging', 'drag-over'));
    reorderRows(sourceId, targetId, allTr);
  });

  main.addEventListener('dragend', (e) => {
    const tr = e.target.closest('#studentTable tbody tr');
    if (tr) tr.classList.remove('dragging');
    document.querySelectorAll('#studentTable tbody tr').forEach((t) => t.classList.remove('drag-over'));
  });
}

function reorderRows(sourceId, targetId, allTr) {
  const previousNumero = {};
  classeStudents.forEach((s) => { previousNumero[s.id] = s.numero; });

  const ids = allTr.map((tr) => tr.dataset.studentId);
  const sourceIdx = ids.indexOf(sourceId);
  const targetIdx = ids.indexOf(targetId);
  if (sourceIdx < 0 || targetIdx < 0) return;

  const reordered = [...ids];
  const [moved] = reordered.splice(sourceIdx, 1);
  reordered.splice(targetIdx, 0, moved);

  // Apply new order + numero in memory
  classeStudents = reordered.map((id, i) => {
    const student = classeStudents.find((s) => s.id === id);
    student.numero = i + 1;
    return student;
  });

  rebuildTableRows(classeStudents);
  renderSummaryBar(classeStudents);
  applySearchFilter();

  // Determine which students changed position
  const changed = classeStudents.filter((s) => previousNumero[s.id] !== s.numero);

  const persist = async () => {
    try {
      await Promise.all(changed.map((s) => updateStudent(s.id, { numero: s.numero })));
    } catch (error) {
      console.error(error);
      if (isAuthRedirect(error)) return;
      classeStudents = classeStudents.map((s) => ({ ...s, numero: previousNumero[s.id] }));
      rebuildTableRows(classeStudents);
      renderSummaryBar(classeStudents);
      showToast('Erreur lors de la réorganisation des élèves.', 'error');
    }
  };
  persist();
}

/* ---------- Add student ---------- */

function toggleAddPanel() {
  const panel = document.getElementById('addPanel');
  const errorEl = document.getElementById('addError');
  if (!panel) return;
  panel.hidden = !panel.hidden;
  if (errorEl) errorEl.hidden = true;
  if (!panel.hidden) {
    const nom = document.getElementById('addNom');
    if (nom) nom.focus();
  }
}

function closeAddPanel() {
  const panel = document.getElementById('addPanel');
  const errorEl = document.getElementById('addError');
  if (panel) panel.hidden = true;
  if (errorEl) errorEl.hidden = true;
}

function doAddStudent(form) {
  const errorEl = document.getElementById('addError');
  const nomComplet = document.getElementById('addNom').value.trim();
  const numero = parseInt(document.getElementById('addNumero').value, 10);

  if (!nomComplet) {
    errorEl.textContent = 'Le nom complet est obligatoire.';
    errorEl.hidden = false;
    return;
  }

  const submitBtn = document.getElementById('btnAddSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Ajout…';

  const payload = {
    nomComplet,
    contactParent: document.getElementById('addContact').value.trim(),
    niveau: currentNiveau,
    classe: currentClasse,
    anneeScolaire: ANNEE,
    numero: Number.isFinite(numero) && numero > 0 ? numero : (classeStudents.reduce((max, s) => Math.max(max, s.numero || 0), 0) + 1)
  };

  addStudent(payload)
    .then((row) => {
      const newStudent = enrichStudentLocal(row);
      classeStudents.push(newStudent);
      appendStudentRow(newStudent);
      renderSummaryBar(classeStudents);
      applySearchFilter();
      closeAddPanel();
      form.reset();
      showToast('Élève ajouté.', 'success');
    })
    .catch((error) => {
      console.error(error);
      if (isAuthRedirect(error)) return;
      errorEl.textContent = error.message || 'Erreur lors de l\u2019ajout de l\u2019élève.';
      errorEl.hidden = false;
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ajouter';
    });
}

function enrichStudentLocal(row) {
  const paiements = {};
  MOIS_ORDER.forEach((mois) => { paiements[mois] = ''; });
  const student = {
    id: row.id,
    nomComplet: row.nom_complet,
    contactParent: row.contact_parent || '',
    note: row.note || '',
    niveau: row.niveau,
    classe: row.classe,
    anneeScolaire: row.annee_scolaire,
    numero: row.numero,
    paiements
  };
  student.computed = {
    moisPayes: moisPayes(paiements),
    moisManquants: moisManquants(paiements),
    hasRetard: hasRetard(paiements),
    whatsapp: whatsappLink(student.contactParent)
  };
  return student;
}

document.addEventListener('keydown', handleInlineKeydown);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { init(); });
} else {
  init();
}
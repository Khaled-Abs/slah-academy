/* js/render.js — all DOM rendering functions */

function esc(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderSidebar(activeNiveau, activeClasse) {
  const nav = document.getElementById('sideNav');
  if (!nav) return;
  const activeView = activeNiveau == null ? 'dashboard' : 'classe';

  let html = '<div class="nav-section">Vue d\u2019ensemble</div>';
  html += `<button class="nav-item ${activeView === 'dashboard' ? 'active' : ''}" data-view="dashboard"><span class="nav-icon">📊</span>Tableau de bord</button>`;

  html += '<div class="nav-section">Niveaux</div>';
  STRUCTURE.forEach((group) => {
    html += `<div class="nav-level">📁 ${esc(group.niveau)}</div>`;
    group.classes.forEach((classe) => {
      const active = activeView === 'classe' && activeNiveau === group.niveau && activeClasse === classe;
      html += `<button class="nav-item nav-classe ${active ? 'active' : ''}" data-niveau="${esc(group.niveau)}" data-classe="${esc(classe)}">${esc(classe)}</button>`;
    });
  });

  nav.innerHTML = html;
}

const RAIL_MONOS = {
  '7ème Primaire': '7P',
  '8ème Primaire': '8P',
  '9ème Primaire': '9P',
  '1ère Secondaire': '1S',
  '2ème Secondaire': '2S',
  '3ème Secondaire': '3S',
  'Bac': 'BAC'
};

function renderIconRail(activeNiveau) {
  const holder = document.getElementById('railLevels');
  if (!holder) return;
  const dashBtn = document.querySelector('.icon-rail [data-rail-view]');
  if (dashBtn) dashBtn.classList.toggle('active', activeNiveau == null);
  holder.innerHTML = STRUCTURE.map((group) => {
    const active = activeNiveau === group.niveau;
    return `<button type="button" class="rail-item rail-mono${active ? ' active' : ''}" data-rail-niveau="${esc(group.niveau)}" aria-label="${esc(group.niveau)}">${RAIL_MONOS[group.niveau] || '•'}<span class="rail-more">›</span></button>`;
  }).join('');
}

function renderEmptyState(container, message, isSuccess = false) {
  container.innerHTML = `<div class="empty-state${isSuccess ? ' success' : ''}">${esc(message)}</div>`;
}

const NOTE_SVG = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';

function buildAlertTable(rows, kind) {
  let emptyMsg;
  if (kind === 'partial') emptyMsg = '<div class="empty-state">Aucun paiement partiel en attente.</div>';
  else if (kind === 'risk') emptyMsg = '<div class="empty-state">Aucun élève à surveiller — tout est en ordre.</div>';
  else emptyMsg = '<div class="empty-state success">✓ Aucun retard de paiement détecté.</div>';
  if (!rows.length) return emptyMsg;
  let html = `<div class="table-wrap"><table class="student-table dashboard-table">
      <thead><tr><th>Niveau</th><th>Classe</th><th>Élève</th><th>Contact</th><th>Mois</th><th>Action</th></tr></thead>
      <tbody>`;
  rows.forEach((s) => {
    const mois = kind === 'partial'
      ? MOIS_ORDER.filter((m) => s.paiements[m] === 'partiel')
      : moisImpayes(s.paiements);
    const chipCls = kind === 'partial' ? 'chip-mois chip-partiel' : 'chip-mois';
    const chips = mois.map((m) => `<span class="${chipCls}">${esc(moisLabel(m))}</span>`).join('');
    const wa = s.computed.whatsapp
      ? `<a class="btn-icon btn-wa" href="${esc(s.computed.whatsapp)}" target="_blank" rel="noopener" title="WhatsApp">💬</a>`
      : '';
    const noteHtml = s.note ? `<span class="cell-note">${NOTE_SVG}<span>${esc(s.note)}</span></span>` : '';
    html += `<tr data-niveau="${esc(s.niveau)}" data-classe="${esc(s.classe)}" data-student-id="${esc(s.id)}">
        <td>${esc(s.niveau)}</td><td>${esc(s.classe)}</td><td>${esc(s.nomComplet)}${noteHtml}</td>
        <td class="mono">${esc(s.contactParent)}</td><td>${chips}</td><td>${wa}</td>
      </tr>`;
  });
  return html + '</tbody></table></div>';
}

function renderDashboard(data, stats) {
  const main = document.getElementById('mainContent');
  if (!main) return;

  const moisCourant = moisCourantKey();
  const { lateStudents, riskStudents, partialStudents } = data;

  const badgeFor = (n, kind) => {
    const base = kind === 'partial' ? 'count-info' : (kind === 'risk' ? 'count-warn' : '');
    return ('count-badge ' + base + (n ? '' : ' count-zero')).trim();
  };

  main.innerHTML = `
    <header class="page-header dash-header">
      <div class="dash-title">
        <h1>Tableau de bord</h1>
        <p class="subtitle">Suivi des paiements — SLAH Academy</p>
      </div>
      <div class="dash-actions">
        <a class="btn btn-ghost" href="calendar.html" target="_blank" rel="noopener">📅 Calendrier</a>
        <button type="button" class="btn btn-ghost js-density-toggle" aria-label="Basculer mode compact">≡ Compact</button>
        <span class="year-wrap">
          <button type="button" class="year-pill" id="yearPill">Année: ${esc(ANNEE)} ▾</button>
          <div class="year-menu" id="yearMenu" hidden></div>
        </span>
      </div>
    </header>

    <section class="stats-grid dash-stats">
      <div class="card stat-card">
        <div class="stat-top"><span class="stat-icon ic-accent">👥</span><span class="stat-label">Élèves inscrits</span></div>
        <div class="stat-value">${stats.totalStudents}</div>
        <div class="stat-foot">Saison ${esc(ANNEE)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-top"><span class="stat-icon ic-retard">⚠️</span><span class="stat-label">En retard</span></div>
        <div class="stat-value${lateStudents.length ? ' val-retard' : ''}">${lateStudents.length}</div>
        <div class="stat-foot">${lateStudents.length ? '2 mois impayés consécutifs' : 'Aucun retard 🎉'}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-top"><span class="stat-icon ic-warn">👁️</span><span class="stat-label">À risque</span></div>
        <div class="stat-value${riskStudents.length ? ' val-warn' : ''}">${riskStudents.length}</div>
        <div class="stat-foot">${riskStudents.length ? '1 mois impayé · à surveiller' : 'Tout est en ordre'}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-top"><span class="stat-icon ic-violet">💰</span><span class="stat-label">Paiements partiels</span></div>
        <div class="stat-value${partialStudents.length ? ' val-violet' : ''}">${partialStudents.length}</div>
        <div class="stat-foot">élèves concernés</div>
      </div>
      <div class="card stat-card">
        <div class="stat-top"><span class="stat-icon ic-month">🗓️</span><span class="stat-label">Mois en cours</span></div>
        <div class="stat-value val-mois">${esc(moisLabel(moisCourant))}</div>
        <div class="stat-foot">Mois scolaire actuel</div>
      </div>
      <div class="card stat-card">
        <div class="stat-top"><span class="stat-icon ic-paye">🎯</span><span class="stat-label">Ponctualité</span></div>
        <div class="stat-value val-paye">${stats.onTimeRate}%</div>
        <div class="stat-foot">${stats.paidThisMonth}/${stats.totalStudents} payés · dernier mois saisi</div>
      </div>
    </section>

    <section class="card table-card">
      <div class="table-card-title">⚠️ Élèves en retard de paiement<span class="${badgeFor(lateStudents.length, 'late')}">${lateStudents.length}</span></div>
      ${buildAlertTable(lateStudents, 'late')}
    </section>

    <section class="card table-card">
      <div class="table-card-title">👁️ Élèves à surveiller<span class="${badgeFor(riskStudents.length, 'risk')}">${riskStudents.length}</span></div>
      ${buildAlertTable(riskStudents, 'risk')}
    </section>

    <section class="card table-card">
      <div class="table-card-title">💰 Paiements partiels<span class="${badgeFor(partialStudents.length, 'partial')}">${partialStudents.length}</span></div>
      ${buildAlertTable(partialStudents, 'partial')}
    </section>`;

  const retards = main.querySelectorAll('.dashboard-table tbody tr');
  retards.forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.btn-icon')) return;
      navigateTo('classe', row.dataset.niveau, row.dataset.classe, row.dataset.studentId);
    });
  });
}

function renderSummaryBar(students) {
  const el = document.getElementById('summaryBar');
  if (!el) return;
  const moisCourant = moisCourantKey();
  let payes = 0, impayes = 0, retards = 0;
  students.forEach((s) => {
    if (s.paiements[moisCourant] === 'paye') payes++;
    else if (s.paiements[moisCourant] === 'impaye') impayes++;
    if (s.computed.hasRetard) retards++;
  });
  el.innerHTML = `
    <div class="summary-item summary-payes"><div class="summary-value">${payes}</div><div class="summary-label">Payés ce mois</div></div>
    <div class="summary-item summary-impayes"><div class="summary-value">${impayes}</div><div class="summary-label">Impayés ce mois</div></div>
    <div class="summary-item summary-retard"><div class="summary-value">${retards}</div><div class="summary-label">En retard</div></div>
    <div class="summary-item summary-mois"><div class="summary-value">${esc(moisLabel(moisCourant))}</div><div class="summary-label">Mois actuel</div></div>`;
}

function renderClasseView(niveau, classe, students, highlightId) {
  const main = document.getElementById('mainContent');
  if (!main) return;

  const nextNumero = students.reduce((max, s) => Math.max(max, s.numero || 0), 0) + 1;

  let thead = '<thead><tr>'
    + '<th class="col-num">#</th>'
    + '<th>Nom complet</th>'
    + '<th>Contact</th>'
    + '<th class="col-wa">WhatsApp</th>';
  MOIS_ORDER.forEach((mois) => {
    thead += `<th><span>${esc(MOIS_COURTS[mois])}</span><button type="button" class="th-mark" data-mois="${mois}" title="Classe entière « payé » en ${esc(moisLabel(mois))}">✓</button></th>`;
  });
  thead += '<th>Note</th><th>Payés</th><th>Retard</th><th class="col-actions">Actions</th></tr></thead>';

  main.innerHTML = `
    <header class="page-header">
      <div>
        <h1>${esc(niveau)} — ${esc(classe)}</h1>
        <p class="subtitle">${students.length} élèves · Année ${esc(ANNEE)}</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost" id="btnBackDashboard">Tableau de bord</button>
        <span class="report-wrap">
          <button type="button" class="btn btn-ghost" id="btnReport">📄 Rapport ▾</button>
          <div class="report-menu" id="reportMenu" hidden>
            <button type="button" class="report-item" data-report-action="print">🖨️ Imprimer</button>
            <button type="button" class="report-item" data-report-action="csv">📥 Exporter CSV</button>
          </div>
        </span>
        <button type="button" class="btn btn-ghost js-density-toggle" aria-label="Basculer mode compact">≡ Compact</button>
        <button class="btn btn-primary" id="btnAddStudent">+ Ajouter un élève</button>
      </div>
    </header>

    <div id="addPanelContainer"></div>
    <div id="summaryBar" class="summary-bar"></div>

    <div class="search-bar">
      <span class="search-icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></span>
      <input type="search" id="studentSearch" placeholder="Rechercher un élève…" autocomplete="off">
      <button type="button" class="search-clear" id="searchClear" title="Effacer" hidden>✕</button>
      <span class="search-hint" id="searchHint"></span>
    </div>

    <section class="card table-card">
      <div class="table-wrap">
        <table class="student-table" id="studentTable">${thead}
          <tbody></tbody>
        </table>
      </div>
    </section>`;

  const tbody = main.querySelector('#studentTable tbody');
  if (tbody) {
    students.forEach((s) => tbody.appendChild(renderStudentRow(s)));
    if (!students.length) renderEmptyTable();
  }

  renderAddPanel(niveau, classe, nextNumero);
  renderSummaryBar(students);
  updateDensityButtons();

  if (highlightId) {
    const row = main.querySelector(`#studentTable tr[data-student-id="${highlightId}"]`);
    if (row) {
      row.classList.add('row-highlight');
      row.scrollIntoView({ behavior: 'auto', block: 'center' });
      setTimeout(() => row.classList.remove('row-highlight'), 3000);
    }
  }
}

function renderStudentRow(student) {
  const tr = document.createElement('tr');
  tr.dataset.studentId = student.id;
  tr.draggable = true;
  if (student.computed.hasRetard) tr.classList.add('row-retard');
  else if (student.computed.moisPayes === MOIS_ORDER.length) tr.classList.add('row-complet');

  const payesClass = student.computed.moisPayes === MOIS_ORDER.length
    ? 'payes-ok'
    : (student.computed.moisPayes < 5 ? 'payes-warn' : 'payes-default');

  const wa = student.computed.whatsapp
    ? `<a class="btn-icon btn-wa" href="${esc(student.computed.whatsapp)}" target="_blank" rel="noopener" title="WhatsApp">💬</a>`
    : '';

  let cells = `<td class="col-num">${student.numero || ''}</td>`;
  cells += `<td class="col-nom"><span class="editable-cell" data-field="nomComplet" title="Double-cliquez pour modifier">${esc(student.nomComplet)}</span></td>`;
  cells += `<td class="col-contact"><span class="editable-cell mono" data-field="contactParent" title="Double-cliquez pour modifier">${esc(student.contactParent)}</span></td>`;
  cells += `<td class="col-wa">${wa}</td>`;

  MOIS_ORDER.forEach((mois) => {
    const statut = student.paiements[mois] || '';
    const title = moisLabel(mois);
    cells += `<td class="col-mois"><button class="statut-chip ${statutClass(statut)}" data-student-id="${student.id}" data-mois="${mois}" data-statut="${statut}" title="${esc(title)}">${statutGlyph(statut)}</button></td>`;
  });

  cells += `<td class="col-note"><span class="editable-cell" data-field="note" title="${esc(student.note || 'Double-cliquez pour ajouter une note')}">${esc(student.note || '')}</span></td>`;
  cells += `<td class="col-payes"><span class="payes-count ${payesClass}">${student.computed.moisPayes}/10</span></td>`;
  cells += `<td class="col-retard${student.computed.hasRetard ? ' has-retard' : ''}">${student.computed.hasRetard ? '<span class="retard-flag">⚠️</span>' : ''}</td>`;
  cells += `<td class="col-actions"><button class="btn-icon btn-allpaid" title="Tout marquer payé">✅</button><button class="btn-icon btn-delete" title="Supprimer">🗑️</button><span class="drag-handle" title="Réordonner">↕️</span></td>`;

  tr.innerHTML = cells;
  return tr;
}

function appendStudentRow(student) {
  const tbody = document.querySelector('#studentTable tbody');
  if (tbody) tbody.appendChild(renderStudentRow(student));
}

function updateCell(studentId, mois, statut) {
  const chip = document.querySelector(`#studentTable .statut-chip[data-student-id="${studentId}"][data-mois="${mois}"]`);
  if (!chip) return;
  chip.className = `statut-chip ${statutClass(statut)}`;
  chip.textContent = statutGlyph(statut);
  chip.dataset.statut = statut;
}

function updateRowCell(row, student) {
  if (!row) return;
  const payesCell = row.querySelector('.payes-count');
  if (payesCell) {
    payesCell.classList.remove('payes-ok', 'payes-warn', 'payes-default');
    if (student.computed.moisPayes === MOIS_ORDER.length) payesCell.classList.add('payes-ok');
    else if (student.computed.moisPayes < 5) payesCell.classList.add('payes-warn');
    else payesCell.classList.add('payes-default');
    payesCell.textContent = `${student.computed.moisPayes}/10`;
  }
  const retardCell = row.querySelector('.col-retard');
  if (retardCell) {
    retardCell.classList.toggle('has-retard', student.computed.hasRetard);
    retardCell.innerHTML = student.computed.hasRetard ? '<span class="retard-flag">⚠️</span>' : '';
  }
  const waCell = row.querySelector('.col-wa');
  if (waCell) {
    waCell.innerHTML = student.computed.whatsapp
      ? `<a class="btn-icon" href="${esc(student.computed.whatsapp)}" target="_blank" rel="noopener" title="WhatsApp">💬</a>`
      : '';
  }
  row.classList.toggle('row-retard', student.computed.hasRetard);
  row.classList.toggle('row-complet', !student.computed.hasRetard && student.computed.moisPayes === MOIS_ORDER.length);
}

function renderAddPanel(niveau, classe, nextNumero) {
  const container = document.getElementById('addPanelContainer');
  if (!container) return;
  container.innerHTML = `
    <form class="add-panel card" id="addPanel" hidden>
      <div class="add-title">Ajouter un élève — ${esc(niveau)} · ${esc(classe)}</div>
      <label class="field"><span class="field-label">Numéro</span>
        <input type="number" id="addNumero" min="1" value="${nextNumero}">
      </label>
      <label class="field"><span class="field-label">Nom complet</span>
        <input type="text" id="addNom" required placeholder="Nom et prénom" autocomplete="off">
      </label>
      <label class="field"><span class="field-label">Contact parent</span>
        <input type="tel" id="addContact" placeholder="+216 55 000 000" autocomplete="off">
      </label>
      <div class="add-actions">
        <button type="submit" class="btn btn-primary" id="btnAddSubmit">Ajouter</button>
        <button type="button" class="btn btn-ghost" id="btnAddCancel">Annuler</button>
      </div>
      <div class="inline-error" id="addError" hidden></div>
    </form>`;
}

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = '<span class="toast-dot"></span><span class="toast-msg"></span>';
  toast.querySelector('.toast-msg').textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function renderYearOptions(menu, years, activeAnnee) {
  if (!menu) return;
  menu.innerHTML = years.map((y) =>
    `<button type="button" class="year-option${y === activeAnnee ? ' current' : ''}" data-annee="${esc(y)}">${esc(y)}</button>`
  ).join('');
}

function renderEmptyTable() {
  const tbody = document.querySelector('#studentTable tbody');
  if (tbody && !tbody.children.length) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="${10 + 8}" class="empty-cell" style="text-align:center;color:var(--text-tertiary);padding:32px;">Aucun élève dans cette classe.</td>`;
    tbody.appendChild(row);
  }
}
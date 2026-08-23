/* js/compute.js — pure functions, no DOM, no DB */

const MOIS_ORDER = [
  'aout',
  'septembre',
  'octobre',
  'novembre',
  'decembre',
  'janvier',
  'fevrier',
  'mars',
  'avril',
  'mai'
];

const MOIS_LABELS = {
  aout: 'Août',
  septembre: 'Septembre',
  octobre: 'Octobre',
  novembre: 'Novembre',
  decembre: 'Décembre',
  janvier: 'Janvier',
  fevrier: 'Février',
  mars: 'Mars',
  avril: 'Avril',
  mai: 'Mai'
};

const MOIS_COURTS = {
  aout: 'Août',
  septembre: 'Sep',
  octobre: 'Oct',
  novembre: 'Nov',
  decembre: 'Déc',
  janvier: 'Jan',
  fevrier: 'Fév',
  mars: 'Mar',
  avril: 'Avr',
  mai: 'Mai'
};

function moisPayes(paiementsObj) {
  return MOIS_ORDER.reduce((count, mois) => count + (paiementsObj[mois] === 'paye' ? 1 : 0), 0);
}

function moisManquants(paiementsObj) {
  return MOIS_ORDER.reduce((count, mois) => count + (!paiementsObj[mois] ? 1 : 0), 0);
}

function hasRetard(paiementsObj) {
  for (let i = 0; i < MOIS_ORDER.length - 1; i++) {
    if (paiementsObj[MOIS_ORDER[i]] === 'impaye' && paiementsObj[MOIS_ORDER[i + 1]] === 'impaye') {
      return true;
    }
  }
  return false;
}

function whatsappLink(tel) {
  if (!tel || !String(tel).trim()) return '';
  let clean = String(tel)
    .replace(/[\s\-\(\)]/g, '')
    .replace(/^\+/, '');
  if (clean.startsWith('00')) {
    clean = '216' + clean.slice(2);
  } else if (clean.startsWith('0')) {
    clean = '216' + clean.slice(1);
  } else if (!clean.startsWith('216')) {
    clean = '216' + clean;
  }
  return 'https://wa.me/' + clean;
}

function moisLabel(moisKey) {
  return MOIS_LABELS[moisKey] || moisKey;
}

function nextStatut(currentStatut) {
  const cycle = ['', 'paye', 'impaye', 'partiel'];
  const idx = cycle.indexOf(currentStatut);
  return cycle[(idx + 1) % cycle.length];
}

function statutClass(statut) {
  switch (statut) {
    case 'paye': return 'statut-paye';
    case 'impaye': return 'statut-impaye';
    case 'partiel': return 'statut-partiel';
    default: return 'statut-vide';
  }
}

function statutGlyph(statut) {
  switch (statut) {
    case 'paye': return '✓';
    case 'impaye': return '✗';
    case 'partiel': return '~';
    default: return '·';
  }
}

function moisCourantKey() {
  const map = {
    0: 'janvier',
    1: 'fevrier',
    2: 'mars',
    3: 'avril',
    4: 'mai',
    7: 'aout',
    8: 'septembre',
    9: 'octobre',
    10: 'novembre',
    11: 'decembre'
  };
  return map[new Date().getMonth()] || 'mai';
}

function moisImpayes(paiementsObj) {
  return MOIS_ORDER.filter((mois) => paiementsObj[mois] === 'impaye');
}

/* Statistiques du tableau de bord, calculées depuis des élèves déjà enrichis.
   Évite un second aller-retour base de données identique au premier. */
function computeStatsFromStudents(students) {
  const byMonth = {};
  MOIS_ORDER.forEach((m) => { byMonth[m] = []; });
  students.forEach((s) => {
    MOIS_ORDER.forEach((m) => {
      const st = s.paiements[m];
      if (st) byMonth[m].push(st);
    });
  });

  let latestMonth = null;
  MOIS_ORDER.forEach((m) => {
    if (byMonth[m].length) latestMonth = m;
  });

  const paidThisMonth = latestMonth
    ? byMonth[latestMonth].filter((x) => x === 'paye').length
    : 0;

  const unpaid = new Set();
  students.forEach((s) => {
    if (MOIS_ORDER.some((m) => s.paiements[m] === 'impaye')) unpaid.add(s.id);
  });

  return {
    totalStudents: students.length,
    paidThisMonth,
    unpaidCount: unpaid.size,
    onTimeRate: students.length > 0 ? Math.round((paidThisMonth / students.length) * 100) : 0
  };
}
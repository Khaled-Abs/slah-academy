/* js/db.js — all Supabase database calls. Every function is async, returns data or throws a French error string. Never exposes raw Supabase errors to the UI. */

function isAuthError(error) {
  if (!error) return false;
  const status = Number(error.status ?? 0);
  if (status === 401 || status === 403) return true;
  const code = String(error.code || '');
  if (code.startsWith('PGRST30')) return true; // JWT expiré côté PostgREST
  const msg = String(
    error.message || error.error_description || error.details || ''
  );
  // Signaux d'authentification NON ambigus uniquement.
  // L'ancienne règle large (/auth|session|permission/) classait à tort les
  // erreurs de la table « sessions » (RLS…) comme une fin de session.
  return /jwt expired|invalid jwt|invalid claim|refresh token|auth session missing|not authenticated|invalid login credentials|user banned|email not confirmed|token used too early|token used too late/i.test(msg);
}

function handleDbError(error) {
  console.error(error);
  if (isAuthError(error)) {
    clearSession();
    window.location.href = 'index.html?expired=1';
    const sessionError = new Error('Session expirée. Veuillez vous reconnecter.');
    sessionError.redirecting = true;
    return sessionError;
  }
  return null;
}

function toFrenchError(error, frenchMessage) {
  if (error && error.redirecting) throw error;
  const sessionError = handleDbError(error);
  if (sessionError) throw sessionError;
  const code = String((error && error.code) || '');
  const msg = String((error && error.message) || '');
  if (code === '42P01' || /does not exist/i.test(msg)) {
    throw new Error(frenchMessage + ' Table absente : exécutez le script SQL dans Supabase.');
  }
  if (code === '42501') {
    throw new Error(frenchMessage + ' Accès refusé par la sécurité (RLS).');
  }
  if (code === 'PGRST204' || /could not find the .* column/i.test(msg)) {
    throw new Error(frenchMessage + ' Colonne manquante : exécutez « alter table sessions add column if not exists couleur text; » dans Supabase.');
  }
  throw new Error(frenchMessage);
}

function emptyPaiements() {
  const obj = {};
  MOIS_ORDER.forEach((mois) => { obj[mois] = ''; });
  return obj;
}

function enrichStudent(row, paiementsByStudent) {
  const paiements = emptyPaiements();
  const raw = paiementsByStudent[row.id] || {};
  MOIS_ORDER.forEach((mois) => {
    paiements[mois] = raw[mois] || '';
  });
  return {
    id: row.id,
    nomComplet: row.nom_complet,
    contactParent: row.contact_parent || '',
    note: row.note || '',
    niveau: row.niveau,
    classe: row.classe,
    anneeScolaire: row.annee_scolaire,
    numero: row.numero,
    paiements,
    computed: {
      moisPayes: moisPayes(paiements),
      moisManquants: moisManquants(paiements),
      hasRetard: hasRetard(paiements),
      whatsapp: whatsappLink(row.contact_parent)
    }
  };
}

async function getUserOnce() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

async function getStudents(niveau, classe, anneeScolaire) {
  try {
    let query = supabaseClient.from('students').select('*');
    if (niveau) query = query.eq('niveau', niveau);
    if (classe) query = query.eq('classe', classe);
    if (anneeScolaire) query = query.eq('annee_scolaire', anneeScolaire);
    query = query.order('numero', { ascending: true });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    toFrenchError(error, 'Erreur lors du chargement des élèves.');
  }
}

async function getPaiements(studentIds) {
  try {
    if (!studentIds.length) return [];
    const { data, error } = await supabaseClient
      .from('paiements')
      .select('*')
      .in('student_id', studentIds);
    if (error) throw error;
    return data || [];
  } catch (error) {
    toFrenchError(error, 'Erreur lors du chargement des paiements.');
  }
}

async function getClasseData(niveau, classe, anneeScolaire) {
  try {
    const students = await getStudents(niveau, classe, anneeScolaire);
    const ids = students.map((s) => s.id);
    const paiements = await getPaiements(ids);
    const byStudent = {};
    paiements.forEach((p) => {
      if (!byStudent[p.student_id]) byStudent[p.student_id] = {};
      byStudent[p.student_id][p.mois] = p.statut;
    });
    return students.map((row) => enrichStudent(row, byStudent));
  } catch (error) {
    toFrenchError(error, 'Erreur lors du chargement des élèves.');
  }
}

async function addStudent({ nomComplet, contactParent, niveau, classe, anneeScolaire, numero }) {
  try {
    const user = await getUserOnce();
    const { data, error } = await supabaseClient
      .from('students')
      .insert({
        nom_complet: nomComplet,
        contact_parent: contactParent || null,
        niveau,
        classe,
        annee_scolaire: anneeScolaire,
        numero,
        user_id: user.id
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    toFrenchError(error, "Erreur lors de l'ajout de l'élève.");
  }
}

async function updateStudent(id, fields) {
  try {
    const payload = {};
    if ('nomComplet' in fields) payload.nom_complet = fields.nomComplet;
    if ('contactParent' in fields) payload.contact_parent = fields.contactParent;
    if ('numero' in fields) payload.numero = fields.numero;
    if ('note' in fields) payload.note = fields.note;
    const { error } = await supabaseClient.from('students').update(payload).eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    toFrenchError(error, "Erreur lors de la modification de l'élève.");
  }
}

async function deleteStudent(id) {
  try {
    const { error } = await supabaseClient.from('students').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    toFrenchError(error, "Erreur lors de la suppression de l'élève.");
  }
}

async function setPaiement(studentId, mois, statut) {
  try {
    const user = await getUserOnce();
    const { error } = await supabaseClient
      .from('paiements')
      .upsert(
        { student_id: studentId, mois, statut, user_id: user.id },
        { onConflict: 'student_id,mois' }
      );
    if (error) throw error;
    return true;
  } catch (error) {
    toFrenchError(error, 'Erreur lors de la mise à jour du paiement.');
  }
}

async function deletePaiement(studentId, mois) {
  try {
    const { error } = await supabaseClient
      .from('paiements')
      .delete()
      .eq('student_id', studentId)
      .eq('mois', mois);
    if (error) throw error;
    return true;
  } catch (error) {
    toFrenchError(error, 'Erreur lors de la mise à jour du paiement.');
  }
}

async function getEnrichedStudents(anneeScolaire) {
  try {
    const students = await getStudents(null, null, anneeScolaire);
    const ids = students.map((s) => s.id);
    const paiements = await getPaiements(ids);
    const byStudent = {};
    paiements.forEach((p) => {
      if (!byStudent[p.student_id]) byStudent[p.student_id] = {};
      byStudent[p.student_id][p.mois] = p.statut;
    });
    return students.map((row) => enrichStudent(row, byStudent));
  } catch (error) {
    toFrenchError(error, 'Erreur lors du chargement des élèves.');
  }
}

async function getLateStudents(anneeScolaire) {
  try {
    const all = await getEnrichedStudents(anneeScolaire);
    return all.filter((s) => s.computed.hasRetard);
  } catch (error) {
    toFrenchError(error, 'Erreur lors du chargement des élèves.');
  }
}

async function getAnneesScolaires() {
  try {
    const { data, error } = await supabaseClient.from('students').select('annee_scolaire');
    if (error) throw error;
    return [...new Set((data || []).map((r) => r.annee_scolaire))];
  } catch (error) {
    toFrenchError(error, 'Erreur lors du chargement des années scolaires.');
  }
}

async function getStats(anneeScolaire) {
  try {
    const students = await getStudents(null, null, anneeScolaire);
    const ids = students.map((s) => s.id);
    const paiements = await getPaiements(ids);

    const totalStudents = students.length;

    const byMonth = {};
    paiements.forEach((p) => {
      if (!byMonth[p.mois]) byMonth[p.mois] = [];
      byMonth[p.mois].push(p);
    });

    let latestMonth = null;
    MOIS_ORDER.forEach((mois) => {
      if (byMonth[mois] && byMonth[mois].length) latestMonth = mois;
    });

    let paidThisMonth = 0;
    if (latestMonth && byMonth[latestMonth]) {
      paidThisMonth = byMonth[latestMonth].filter((p) => p.statut === 'paye').length;
    }

    const unpaid = new Set();
    paiements.forEach((p) => {
      if (p.statut === 'impaye') unpaid.add(p.student_id);
    });

    return {
      totalStudents,
      paidThisMonth,
      unpaidCount: unpaid.size,
      onTimeRate: totalStudents > 0 ? Math.round((paidThisMonth / totalStudents) * 100) : 0
    };
  } catch (error) {
    toFrenchError(error, 'Erreur lors du chargement des statistiques.');
  }
}
/* ---------- Séances (calendrier) ---------- */

async function getSessions() {
  try {
    const { data, error } = await supabaseClient
      .from('sessions')
      .select('*')
      .order('debut', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    toFrenchError(error, 'Erreur lors du chargement des séances.');
  }
}

async function addSession({ titre, debut, fin, couleur }) {
  try {
    const user = await getUserOnce();
    const { data, error } = await supabaseClient
      .from('sessions')
      .insert({ titre, debut, fin: fin || null, couleur: couleur || null, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    toFrenchError(error, "Erreur lors de l'ajout de la séance.");
  }
}

async function updateSession(id, fields) {
  try {
    const payload = {};
    if ('titre' in fields) payload.titre = fields.titre;
    if ('debut' in fields) payload.debut = fields.debut;
    if ('fin' in fields) payload.fin = fields.fin;
    if ('couleur' in fields) payload.couleur = fields.couleur;
    const { error } = await supabaseClient.from('sessions').update(payload).eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    toFrenchError(error, 'Erreur lors de la modification de la séance.');
  }
}

async function deleteSessionRow(id) {
  try {
    const { error } = await supabaseClient.from('sessions').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    toFrenchError(error, 'Erreur lors de la suppression de la séance.');
  }
}

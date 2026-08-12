/* js/db.js — all Supabase database calls. Every function is async, returns data or throws a French error string. Never exposes raw Supabase errors to the UI. */

function isAuthError(error) {
  if (!error) return false;
  const status = Number(error.status || error.code || 0);
  if (status === 401 || status === 403) return true;
  const msg = String(error.message || error.error_description || error.details || '');
  return /auth|jwt|session|permission|denied|authoriz/i.test(msg);
}

function handleDbError(error) {
  console.error(error);
  if (isAuthError(error)) {
    window.location.href = 'index.html';
  }
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
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function getStudents(niveau, classe, anneeScolaire) {
  try {
    let query = supabase.from('students').select('*');
    if (niveau) query = query.eq('niveau', niveau);
    if (classe) query = query.eq('classe', classe);
    if (anneeScolaire) query = query.eq('annee_scolaire', anneeScolaire);
    query = query.order('numero', { ascending: true });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    handleDbError(error);
    throw new Error('Erreur lors du chargement des élèves.');
  }
}

async function getPaiements(studentIds) {
  try {
    if (!studentIds.length) return [];
    const { data, error } = await supabase
      .from('paiements')
      .select('*')
      .in('student_id', studentIds);
    if (error) throw error;
    return data || [];
  } catch (error) {
    handleDbError(error);
    throw new Error('Erreur lors du chargement des paiements.');
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
    throw error;
  }
}

async function addStudent({ nomComplet, contactParent, niveau, classe, anneeScolaire, numero }) {
  try {
    const user = await getUserOnce();
    const { data, error } = await supabase
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
    handleDbError(error);
    throw new Error("Erreur lors de l'ajout de l'élève.");
  }
}

async function updateStudent(id, fields) {
  try {
    const payload = {};
    if ('nomComplet' in fields) payload.nom_complet = fields.nomComplet;
    if ('contactParent' in fields) payload.contact_parent = fields.contactParent;
    if ('numero' in fields) payload.numero = fields.numero;
    const { error } = await supabase.from('students').update(payload).eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    handleDbError(error);
    throw new Error("Erreur lors de la modification de l'élève.");
  }
}

async function deleteStudent(id) {
  try {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    handleDbError(error);
    throw new Error("Erreur lors de la suppression de l'élève.");
  }
}

async function setPaiement(studentId, mois, statut) {
  try {
    const user = await getUserOnce();
    const { error } = await supabase
      .from('paiements')
      .upsert(
        { student_id: studentId, mois, statut, user_id: user.id },
        { onConflict: 'student_id,mois' }
      );
    if (error) throw error;
    return true;
  } catch (error) {
    handleDbError(error);
    throw new Error('Erreur lors de la mise à jour du paiement.');
  }
}

async function deletePaiement(studentId, mois) {
  try {
    const { error } = await supabase
      .from('paiements')
      .delete()
      .eq('student_id', studentId)
      .eq('mois', mois);
    if (error) throw error;
    return true;
  } catch (error) {
    handleDbError(error);
    throw new Error('Erreur lors de la mise à jour du paiement.');
  }
}

async function getLateStudents(anneeScolaire) {
  try {
    const students = await getStudents(null, null, anneeScolaire);
    const ids = students.map((s) => s.id);
    const paiements = await getPaiements(ids);
    const byStudent = {};
    paiements.forEach((p) => {
      if (!byStudent[p.student_id]) byStudent[p.student_id] = {};
      byStudent[p.student_id][p.mois] = p.statut;
    });
    return students
      .map((row) => enrichStudent(row, byStudent))
      .filter((s) => s.computed.hasRetard);
  } catch (error) {
    throw error;
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
    handleDbError(error);
    throw new Error('Erreur lors du chargement des statistiques.');
  }
}
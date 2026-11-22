// v0.55 (R136) : personnes du carnet (copis, CdB, instructeurs, examinateurs, élèves).
// - Règle d'affichage partout à l'écran : trigramme s'il est rempli ; sinon nom ; sinon prénom (`afficherPersonne`).
// - Les vols gardent le nom en TEXTE (nomCdB, nomCopi, nomInstructeur, nomExaminateur, nomEleve). Un texte enregistré
//   retrouve sa personne par une de ses « formes » (trigramme, « Prénom Nom », « Nom Prénom », nom) : l'écran montre
//   alors la règle d'affichage, même pour un vol enregistré avant (« Jean ESSAI » -> « ESSAI »). Le PDF imprime, lui,
//   toujours le texte enregistré dans le vol (inchangé).
// - Correction d'une fiche : les vols où cette personne apparaît (par une de ses anciennes formes) reçoivent le nouveau
//   nom affiché, dans ces seuls champs ; rien d'autre ne change dans ces vols.

export const CHAMPS_PERSONNE = ['nomCdB', 'nomCopi', 'nomInstructeur', 'nomExaminateur', 'nomEleve'];
const maj = x => String(x || '').trim().replace(/\s+/g, ' ').toUpperCase();

export const afficherPersonne = p => (p ? String(p.tri || '').trim() || String(p.nom || '').trim() || String(p.prenom || '').trim() : '');

// Textes sous lesquels un vol a pu enregistrer cette personne
export function formesPersonne(p) {
  const f = [];
  const ajouter = x => { const m = maj(x); if (m && !f.includes(m)) f.push(m); };
  ajouter(p.tri);
  ajouter([p.prenom, p.nom].filter(Boolean).join(' '));
  ajouter([p.nom, p.prenom].filter(Boolean).join(' '));
  ajouter(p.nom);
  if (!p.nom && !p.tri) ajouter(p.prenom);
  return f;
}

// Texte enregistré -> personne. Un trigramme l'emporte ; une forme partagée par deux personnes (même nom) ne mène à
// personne (on garde alors le texte tel quel).
export function indexPersonnes(personnes) {
  const parTri = new Map(), autres = new Map(), doubles = new Set();
  for (const p of personnes) {
    const t = maj(p.tri);
    if (t) { if (parTri.has(t) && parTri.get(t) !== p) doubles.add('T' + t); else parTri.set(t, p); }
  }
  for (const p of personnes) {
    for (const f of formesPersonne(p)) {
      if (f === maj(p.tri)) continue;
      if (autres.has(f) && autres.get(f) !== p) doubles.add(f); else autres.set(f, p);
    }
  }
  const index = new Map();
  for (const [f, p] of autres) if (!doubles.has(f)) index.set(f, p);
  for (const [t, p] of parTri) { if (doubles.has('T' + t)) index.delete(t); else index.set(t, p); }
  return index;
}
export const personneDuTexte = (texte, index) => (maj(texte) && maj(texte) !== 'SELF' ? index.get(maj(texte)) || null : null);
// Nom à l'écran pour un texte enregistré dans un vol
export function nomAffiche(texte, index) {
  const p = personneDuTexte(texte, index);
  return p ? afficherPersonne(p) : texte;
}

// Vols à corriger après la modification d'une fiche : [{ ...vol, champs corrigés }] (les autres champs ne bougent pas).
// avant / apres : la fiche avant et après ; personnes : toutes les fiches AVANT la correction.
export function volsACorriger(vols, avant, apres, personnes) {
  const nouveau = afficherPersonne(apres);
  if (!nouveau) return [];
  const index = indexPersonnes(personnes);
  const out = [];
  for (const v of vols) {
    let w = null;
    for (const c of CHAMPS_PERSONNE) {
      const t = v[c];
      if (!t || t === nouveau) continue;
      const p = personneDuTexte(t, index);
      if (p && p.id === avant.id) { w = w || { ...v }; w[c] = nouveau; }
    }
    if (w) out.push(w);
  }
  return out;
}

// v0.55 (R143) : section « Trigrammes » des Totaux : une ligne par personne QUI A un trigramme, tous rôles confondus ;
// nombre de vols ensemble, heures ensemble (temps bloc), date du dernier vol ; tri par heures décroissantes.
// vols : vols réels (sans simulateur ni simulation), déjà filtrés sur la période.
export function totauxTrigrammes(vols, personnes, estSimulateur = () => false) {
  const index = indexPersonnes(personnes), parId = new Map();
  for (const v of vols) {
    if (estSimulateur(v)) continue;
    const vus = new Set();
    for (const c of CHAMPS_PERSONNE) {
      const p = personneDuTexte(v[c], index);
      if (!p || !String(p.tri || '').trim() || vus.has(p.id)) continue;
      vus.add(p.id);
      const l = parId.get(p.id) || { tri: maj(p.tri), id: p.id, vols: 0, minutes: 0, dernier: '' };
      l.vols++; l.minutes += v.tempsTotal || 0;
      if (v.date > l.dernier) l.dernier = v.date;
      parId.set(p.id, l);
    }
  }
  return [...parId.values()].sort((a, b) => b.minutes - a.minutes || b.vols - a.vols || a.tri.localeCompare(b.tri));
}

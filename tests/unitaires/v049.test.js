// v0.49 (R123) : réglages partagés entre deux appareils DÉJÀ synchronisés (faux NAS en mémoire, règles de carnet.php v5).
// Adresses et valeurs INVENTÉES ; aucun appel réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elementsDuCarnet, preparerEnvoi, majCarte, analyserRecus, cleElement, empreinteTexte, reglageVide } from '../../js/synchro.js';

function fauxNas() {
  const n = { rev: 0, el: new Map() };
  n.envoyer = (mods, appareil) => {
    const acceptees = [], deja = [], conflits = [];
    for (const m of mods) {
      const cle = `${m.magasin}/${m.id}`, a = n.el.get(cle), revA = a ? a.rev : 0, donnees = m.supprime ? null : structuredClone(m.donnees);
      if (a && !!a.supprime === !!m.supprime && JSON.stringify(a.donnees) === JSON.stringify(donnees)) { deja.push({ magasin: m.magasin, id: m.id, rev: revA }); continue; }
      if (m.base !== revA) { conflits.push({ magasin: m.magasin, id: m.id, rev: revA }); continue; }
      n.rev++; n.el.set(cle, { rev: n.rev, supprime: !!m.supprime, donnees, appareil, le: '2026-11-17T12:00:00+01:00' });
      acceptees.push({ magasin: m.magasin, id: m.id, rev: n.rev });
    }
    return { rev: n.rev, acceptees, deja, conflits };
  };
  n.recevoir = depuis => [...n.el.entries()].filter(([, e]) => e.rev > depuis).sort((a, b) => a[1].rev - b[1].rev)
    .map(([cle, e]) => ({ magasin: cle.split('/')[0], id: cle.slice(cle.indexOf('/') + 1), ...structuredClone(e) }));
  return n;
}
const appareil = (nom, reglages = []) => ({ nom, contenu: { vols: [{ id: 'v1', date: '2026-01-02' }], avions: [], personnes: [], reglages }, carte: {}, rev: 0, conflits: new Map() });
const locaux = a => new Map(elementsDuCarnet(a.contenu).map(e => [cleElement(e.magasin, e.id), { ...e, h: empreinteTexte(JSON.stringify(e.donnees)) }]));
function synchro(nas, a) {
  const r = analyserRecus(nas.recevoir(a.rev), locaux(a), a.carte);
  for (const x of r.appliquer) {
    a.contenu.reglages = a.contenu.reglages.filter(g => g.cle !== x.id || x.magasin !== 'reglages');
    if (x.magasin === 'reglages' && x.donnees) a.contenu.reglages.push({ cle: x.id, valeur: x.donnees.valeur, ...(x.donnees.modifieLe ? { modifieLe: x.donnees.modifieLe } : {}) });
  }
  for (const c of r.conflits) a.conflits.set(c.cle, c);
  a.carte = r.carte; a.rev = nas.rev;
  const p = preparerEnvoi(elementsDuCarnet(a.contenu), a.carte, new Set(a.conflits.keys()));
  if (p.modifications.length) a.carte = majCarte(a.carte, p.empreintes, nas.envoyer(p.modifications, a.nom));
  return p.modifications.map(m => `${m.magasin}/${m.id}`);
}
const regler = (a, cle, valeur, modifieLe) => { a.contenu.reglages = a.contenu.reglages.filter(r => r.cle !== cle); a.contenu.reglages.push({ cle, valeur, modifieLe }); };
const valeur = (a, cle) => a.contenu.reglages.find(r => r.cle === cle)?.valeur;
const ADR = 'http://127.0.0.1:9/macros/s/ESSAI/exec', ADR2 = 'http://127.0.0.1:9/macros/s/ESSAI-2/exec';
function deuxAppareils(reglagesB = []) {
  const nas = fauxNas(), A = appareil('tel-1'), B = appareil('pc-1', reglagesB);
  synchro(nas, A); synchro(nas, B); synchro(nas, A);
  return { nas, A, B };
}

test('réglage partagé changé sur A (aucun vol changé) : envoyé, puis reçu par B déjà synchronisé', () => {
  const { nas, A, B } = deuxAppareils();
  regler(A, 'socleAdresse', ADR, '2026-11-17T10:00:00Z');
  assert.deepEqual(synchro(nas, A), ['reglages/socleAdresse'], 'seul le réglage part');
  synchro(nas, B);
  assert.equal(valeur(B, 'socleAdresse'), ADR);
  assert.equal(B.conflits.size, 0);
});

test('vide d\'origine sur B : jamais envoyé, n\'efface pas l\'adresse de A, et B la reçoit', () => {
  const { nas, A, B } = deuxAppareils([{ cle: 'socleAdresse', valeur: '', modifieLe: '2026-11-17T11:00:00Z' }]); // B : « Enregistrer » sur une case vide
  assert.ok(reglageVide('') && reglageVide([]) && reglageVide({}) && reglageVide(null) && !reglageVide('x') && !reglageVide([1]));
  assert.ok(!nas.el.has('reglages/socleAdresse'), 'le vide de B n\'est jamais parti');
  regler(A, 'socleAdresse', ADR, '2026-11-17T10:00:00Z'); // plus ancien que le « vide » de B : le vide ne compte pas
  synchro(nas, A); synchro(nas, B); synchro(nas, A);
  assert.equal(valeur(B, 'socleAdresse'), ADR, 'B a l\'adresse');
  assert.equal(valeur(A, 'socleAdresse'), ADR, 'A la garde');
  assert.equal(nas.el.get('reglages/socleAdresse').donnees.valeur, ADR);
});

test('effacement volontaire sur A : transmis à B', () => {
  const { nas, A, B } = deuxAppareils();
  regler(A, 'socleAdresse', ADR, '2026-11-17T10:00:00Z'); synchro(nas, A); synchro(nas, B);
  regler(A, 'socleAdresse', '', '2026-11-17T12:00:00Z');
  assert.deepEqual(synchro(nas, A), ['reglages/socleAdresse'], 'l\'effacement part');
  synchro(nas, B);
  assert.equal(valeur(B, 'socleAdresse'), '');
});

test('A et B changent l\'adresse : la plus récente gagne sur les deux (dans un sens comme dans l\'autre)', () => {
  for (const [hA, hB, gagnante] of [['2026-11-17T10:00:00Z', '2026-11-17T11:00:00Z', ADR2], ['2026-11-17T11:00:00Z', '2026-11-17T10:00:00Z', ADR]]) {
    const { nas, A, B } = deuxAppareils();
    regler(A, 'socleAdresse', ADR, hA); regler(B, 'socleAdresse', ADR2, hB);
    synchro(nas, A); synchro(nas, B); synchro(nas, A); synchro(nas, B);
    assert.equal(valeur(A, 'socleAdresse'), gagnante); assert.equal(valeur(B, 'socleAdresse'), gagnante);
    assert.equal(A.conflits.size + B.conflits.size, 0, 'aucun conflit à choisir');
  }
});

test('réglage sauté par une ancienne version (repère passé dessus, absent de la carte) : rattrapé', () => {
  const { nas, A, B } = deuxAppareils();
  regler(A, 'socleAdresse', ADR, '2026-11-17T10:00:00Z'); synchro(nas, A);
  B.rev = nas.rev; // comme la v0.47 : réglage inconnu sauté, repère avancé
  synchro(nas, B);
  assert.equal(valeur(B, 'socleAdresse'), undefined, 'sans rattrapage, il n\'arrive jamais (cause du constat)');
  // rattrapage (js/ui/synchro.js) : tout relu depuis 0, seulement les réglages absents de la carte, comme une réception
  const aRevoir = nas.recevoir(0).filter(e => e.magasin === 'reglages' && !B.carte[cleElement('reglages', e.id)]);
  const r = analyserRecus(aRevoir, locaux(B), B.carte);
  assert.equal(r.appliquer.length, 1); assert.equal(r.appliquer[0].donnees.valeur, ADR);
});

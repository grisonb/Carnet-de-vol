// v0.46 (R120) : heures affichées par NOM DE MODÈLE au lieu du code OACI (avions et vols INVENTÉS)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculerTotaux } from '../../js/totaux.js';
import { familleAvion } from '../../js/modele.js';
import { choixParType, valeurBande, normaliserBande } from '../../js/bande.js';

const A = (id, typeOACI, modele, sim = false) => ({ id, typeOACI, modele, sim, immat: 'F-XZZ' + id.slice(-1).toUpperCase(), nom: '', equipage: 'MP', moteurs: 'ME', moteur: 'T' });
const AVIONS = [A('a', 'DH8D', 'Dash 8 Q400 MR'), A('b', 'DH8D', 'Dash 8 Q400 MRE'), A('c', 'CL2T', 'CL-415'), A('d', 'CL2T', 'Canadair 415 ESSAI'),
  A('e', 'RALL', 'Rallye'), A('f', 'DR40', 'DR400'), A('g', 'DR40', 'DR400 Remorqueur ESSAI'), A('h', 'C172', ''), A('s', 'DH8D', 'Simulateur ESSAI', true)];
const V = (avionId, tempsTotal, tempsCdB = 0, tempsCopi = 0) => ({ id: avionId + tempsTotal, avionId, date: '2026-01-02', tempsTotal, tempsCdB, tempsCopi, simTemps: avionId === 's' ? tempsTotal : 0, etiquettes: [], compteurs: {} });
const VOLS = [V('a', 100, 100), V('b', 50, 0, 50), V('c', 30, 30), V('d', 20, 20), V('e', 70, 70), V('f', 10, 10), V('g', 5, 5), V('h', 3, 3), V('s', 60)];
const avions = new Map(AVIONS.map(a => [a.id, a]));
const t = calculerTotaux(VOLS, avions);

test('famille : DH8D -> Dash 8 Q400, CL2T -> CL-415 (tous les modèles), sinon le modèle de la fiche, sinon le code', () => {
  assert.deepEqual(AVIONS.map(familleAvion), ['Dash 8 Q400', 'Dash 8 Q400', 'CL-415', 'CL-415', 'Rallye', 'DR400', 'DR400 Remorqueur ESSAI', 'C172', null]);
});

test('heures inchangées : Dash 8 Q400 = ancien total DH8D, CL-415 = ancien CL2T ; CdB / Copi aussi', () => {
  assert.equal(t.parFamille['Dash 8 Q400'], t.parType.DH8D);
  assert.equal(t.parFamilleCdB['Dash 8 Q400'], t.parTypeCdB.DH8D);
  assert.equal(t.parFamilleCopi['Dash 8 Q400'], t.parTypeCopi.DH8D);
  assert.equal(t.parFamille['CL-415'], t.parType.CL2T);
  assert.equal(t.parFamille.DR400 + t.parFamille['DR400 Remorqueur ESSAI'], t.parType.DR40);
  assert.equal(valeurBande('famille:Dash 8 Q400', t).texte, valeurBande('type:DH8D', t).texte);
  assert.equal(valeurBande('famille:CL-415', t).texte, valeurBande('type:CL2T', t).texte);
});

test('menu : noms de modèles, Dash avec total / CdB / Copi, un bouton par nom pour un même code (DR40), pas de simulateur', () => {
  const ch = choixParType(t, AVIONS);
  assert.deepEqual(ch.map(c => c.lib), ['Dash 8 Q400', 'Dash 8 Q400 CdB', 'Dash 8 Q400 Copi', 'Rallye', 'CL-415', 'DR400', 'DR400 Remorqueur ESSAI', 'C172']);
  assert.deepEqual(['Dash 8 Q400', 'Dash 8 Q400 CdB', 'Dash 8 Q400 Copi'].map(l => valeurBande(ch.find(c => c.lib === l).cle, t).lib), ['Dash 8 Q400', 'Dash 8 Q400 CdB', 'Dash 8 Q400 Copi']);
});

test('anciens choix convertis tout seuls, même ordre, sans doublon', () => {
  assert.deepEqual(normaliserBande(['type:CL2T', 'type:DH8D', 'typeCdB:DH8D'], AVIONS), ['famille:CL-415', 'famille:Dash 8 Q400', 'familleCdB:Dash 8 Q400']);
  assert.deepEqual(normaliserBande(['tempsCdB', 'type:DR40', 'typeCopi:DH8D', 'famille:Rallye', 'type:RALL'], AVIONS),
    ['tempsCdB', 'famille:DR400', 'famille:DR400 Remorqueur ESSAI', 'familleCopi:Dash 8 Q400', 'famille:Rallye']);
  assert.deepEqual(normaliserBande(['type:B190'], AVIONS), ['type:B190'], 'code sans avion : choix gardé tel quel');
  assert.deepEqual(normaliserBande(['famille:CL-415', 'famille:Dash 8 Q400'], AVIONS), ['famille:CL-415', 'famille:Dash 8 Q400'], 'déjà converti : inchangé');
});

test('PDF EASA : toujours les codes OACI (R40), jamais les noms de modèles', async () => {
  const { paginer, dessinerPDF } = await import('../../js/pdf.js');
  const { chargerJsPDF, enregistreur } = await import('../outils/pdf-noeud.js');
  const { volsPDF } = await import('../outils/vols-pdf.js');
  const { vols, avions } = volsPDF(30);
  const codes = new Set();
  for (const a of avions.values()) { if (a.sim) continue; codes.add(a.typeOACI); a.modele = `MODELE ESSAI ${a.typeOACI}`; }
  const e = enregistreur(chargerJsPDF());
  await dessinerPDF(e.jsPDF, paginer(vols, avions), avions, { titulaire: 'PILOTE TEST' });
  const textes = e.traces.filter(x => x.type === 'texte').map(x => String(x.texte));
  assert.ok([...codes].some(c => textes.includes(c)), 'codes OACI présents');
  assert.ok(!textes.some(x => /MODELE ESSAI|Dash 8 Q400|CL-415/.test(x)), 'aucun nom de modèle');
});

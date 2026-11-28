// v0.70 : R172 / R177 quatre cases (VOL JOURNÉE | DÉTACHEMENT, J.1 | J.2), J.1 + J.2 = une ligne ; R173 la case vaut pour toute la journée ;
// R175 / R176 cartes « date · type », trajet dans une bande, J.1 / J.2 sur deux lignes, même présentation dans le PDF ; R174 détachement
// (pays, nuits passées ailleurs) ; R178 pays de la nuit automatique (outre-mer à part, choix à la main gardé, code inconnu : à choisir) ;
// R171 barème replié ; reprise des anciens J+2 ; synchro A -> B (FAUX NAS v5), sauvegarde, ancienne sauvegarde ; 360 / 393 px ;
// PDF EASA, CSV et totaux inchangés. Carnet INVENTÉ, barème 2025 = bulletin intégré (public). Usage : node tests/navigateur/v070.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2025-10-01T08:00:00Z', LE = '2025-11-01T08:00:00Z';
const AVIONS = [{ id: 'a1', immat: 'F-XZZA', typeOACI: 'DH8D', modele: 'Dash 8 Q400 MR', constructeur: 'ESSAI', nom: '', indicatif: '', equipage: 'MP', moteurs: 'ME', moteur: 'T',
  surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', hexAdsb: '', creeLe: H, modifieLe: H }];
const C0 = { largCdbDash: 0, largInstrCdbDash: 0, largCopiDash: 0, largCopiCL: 0, ecopages: 0, amerrCL: 0, amerrSEP: 0, largPara: 0 };
const vol = (id, date, dep, arr, h, champs = {}) => ({ id, date, hDep: h, hArr: `${String(+h.slice(0, 2) + 1).padStart(2, '0')}${h.slice(2)}`, mode: 'utc', dep, arr, escales: [], avionId: 'a1',
  tempsTotal: 60, tempsMP: null, tempsSE: null, tempsME: null, tempsCdB: 60, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: '', nomInstructeur: '', nomExaminateur: '', missions: [],
  remarques: '', feux: 0, compteurs: { ...C0 }, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie',
  ordre: Date.parse(`${date}T${h}Z`), creeLe: H, modifieLe: H, ...champs });
const VOLS = [
  vol('a1', '2025-11-17', 'LFTW', 'LFTH', '07:00'), vol('a2', '2025-11-17', 'LFTH', 'LFPB', '10:00'),                              // J.1
  vol('b1', '2025-11-18', 'LFPB', 'LFRN', '07:00'), vol('b2', '2025-11-18', 'LFRN', 'LEMD', '09:00'),
  vol('b3', '2025-11-18', 'LEMD', 'LFPB', '12:00'), vol('b4', '2025-11-18', 'LFPB', 'LFTW', '15:00'),                              // J.2
  vol('c1', '2025-12-03', 'LFTW', 'LFTH', '07:00'), vol('c2', '2025-12-03', 'LFTH', 'LFPB', '10:00'), vol('c3', '2025-12-03', 'LFPB', 'LFTW', '14:00'), // vol journée
  vol('e1', '2025-03-10', 'LFTW', 'LFPB', '07:00'), vol('e2', '2025-03-10', 'LFPB', 'LEMD', '12:00'), vol('e3', '2025-03-11', 'LEMD', 'LFTW', '09:00'),       // pays auto
  vol('r1', '2025-04-14', 'LFTW', 'FMEE', '07:00'), vol('m1', '2025-04-20', 'LFTW', 'FMCZ', '07:00'), vol('z1', '2025-04-24', 'LFTW', 'ZZZZ', '07:00'), vol('z2', '2025-04-25', 'ZZZZ', 'LFTW', '07:00'),
  vol('d1', '2025-01-05', 'LFPG', 'FMEE', '07:00'), vol('d2', '2025-01-06', 'FMEE', 'FIMP', '07:00'), vol('d3', '2025-01-07', 'FIMP', 'FIMP', '07:00'),
  vol('d4', '2025-01-08', 'FIMP', 'FMEE', '07:00'), vol('d5', '2025-01-10', 'FMEE', 'FMEP', '07:00'),                               // détachement La Réunion
  // anciennes cases J+2 (v0.68 / v0.69) : deux jours qui se suivent + un seul
  vol('x1', '2025-06-02', 'LFTW', 'LEBL', '07:00', { frais: { type: 'j2', pays: 'Espagne', le: LE } }), vol('x2', '2025-06-03', 'LEBL', 'LFTW', '07:00', { frais: { type: 'j2', le: LE } }),
  vol('x3', '2025-06-20', 'LFTW', 'LFML', '07:00', { frais: { type: 'j2', pays: 'France', le: LE } }),
];

// ---------- Faux NAS v5 (synchro) ----------
const srv = await serveur();
const nas = { mdp: 'mot-de-passe-essai-70', rev: 0, el: new Map() };
const faux = createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), action = u.searchParams.get('action');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Carnet-Cle, X-Carnet-Empreinte', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const morceaux = [];
  req.on('data', m => morceaux.push(m));
  req.on('end', () => {
    const corps = Buffer.concat(morceaux);
    const json = (o, code = 200) => { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(code === 200 ? o : { ...o, code })); };
    if (req.headers['x-carnet-cle'] !== nas.mdp) return json({ erreur: 'mot-de-passe' }, 401);
    if (action === 'test') return json({ ok: true, copies: 0, cle: 'carnet', version: 5 });
    if (action === 'envoyer') return json({ ok: true, id: 'x', vols: 0, taille: corps.length, verification: 'empreinte' });
    if (action === 'liste') return json({ copies: [] });
    if (action === 'vols-liste') return json({ vols: [] });
    if (action === 'synchro-etat') return json({ ok: true, rev: nas.rev, nombres: {} });
    if (action === 'synchro-recevoir') {
      const depuis = Number(u.searchParams.get('depuis')), limite = Number(u.searchParams.get('limite'));
      const tous = [...nas.el.entries()].filter(([, e]) => e.rev > depuis).sort((a, b) => a[1].rev - b[1].rev);
      const page = tous.slice(0, limite).map(([cle, e]) => ({ magasin: cle.split('/')[0], id: cle.slice(cle.indexOf('/') + 1), ...e }));
      const suite = tous.length > limite;
      return json({ ok: true, rev: nas.rev, elements: page, suite, jusqua: suite ? page.at(-1).rev : nas.rev });
    }
    if (action === 'synchro-envoyer') {
      const b = JSON.parse(corps.toString()), acceptees = [], deja = [], conflits = [];
      for (const m of b.modifications) {
        const cle = `${m.magasin}/${m.id}`, a = nas.el.get(cle), revA = a ? a.rev : 0, donnees = m.supprime ? null : m.donnees;
        if (a && !!a.supprime === !!m.supprime && JSON.stringify(a.donnees) === JSON.stringify(donnees)) { deja.push({ magasin: m.magasin, id: m.id, rev: revA }); continue; }
        if (m.base !== revA) { conflits.push({ magasin: m.magasin, id: m.id, rev: revA }); continue; }
        nas.rev++; nas.el.set(cle, { rev: nas.rev, supprime: !!m.supprime, donnees, appareil: b.appareil, le: new Date().toISOString() });
        acceptees.push({ magasin: m.magasin, id: m.id, rev: nas.rev });
      }
      return json({ ok: true, rev: nas.rev, acceptees, deja, conflits });
    }
    return json({ erreur: 'action' }, 400);
  });
});
await new Promise(ok => faux.listen(0, '127.0.0.1', ok));
const ADRESSE_NAS = `http://127.0.0.1:${faux.address().port}/carnet-api/`;

const { chromium } = playwright();
const nav = await chromium.launch();
const bloquees = [], erreurs = [];
async function appareil(nom) {
  const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
  await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|Access-Control|access control/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  return { p, ctx };
}
const fini = (p, sel) => p.waitForFunction(s => { const e = document.querySelector(s); return e && e.textContent.trim() && !/en cours|Envoi :|Réception :|prêt \?/.test(e.textContent); }, sel, { timeout: 60000 });
const onglet = (p, v) => p.click(`.tabs button[data-v="${v}"]`);
async function rejoindre(p, role) {
  await onglet(p, 'plus'); await p.click('#pl-sync'); await p.click('#sy-nas'); await p.fill('#nas-adr', ADRESSE_NAS); await p.fill('#nas-mdp', nas.mdp); await p.click('#nas-ok'); await p.waitForTimeout(400); await p.click('#ou-x');
  await p.click('#pl-sync');
  if (role === 'ref') { await p.click('#sy-ref'); await p.click('#sr-ok'); await fini(p, '#sr-res'); } else { await p.click('#sy-mod'); await p.click('#sc-ok'); await fini(p, '#sc-res'); }
  await p.click('#ou-x'); await onglet(p, 'carnet');
}
const actualiser = async p => { await onglet(p, 'carnet'); await p.click('#rafraichir'); await p.waitForFunction(() => !document.getElementById('rafraichir').classList.contains('tourne'), null, { timeout: 30000 }); await p.waitForTimeout(400); };
const remplir = async (p, vols) => {
  await p.evaluate(async ([avs, vs]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols', 'reglages'], 'readwrite'); for (const a of avs) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
    t.objectStore('reglages').delete('migrationFraisJ1'); // comme avant la mise à jour
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVIONS, vols]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
};
const vols = p => p.evaluate(async () => Object.fromEntries((await import('./js/etat.js')).etat.vols.map(v => [v.id, v])));
const ouvrir = async (p, id) => { await onglet(p, 'carnet'); await p.click(`.flight[data-id="${id}"] .fl-route`); await p.waitForSelector('#v-saisie:not([hidden])'); };
const fermer = async p => { if (await p.isVisible('#v-saisie')) await p.click('#cancel'); await p.waitForSelector('#v-carnet:not([hidden])'); }; // v0.72 : Valider ferme déjà la fiche
const cases = p => p.$$eval('#fe-zone [data-fe]', l => Object.fromEntries(l.map(b => [b.dataset.fe, b.getAttribute('aria-checked') === 'true'])));
// v0.71 (R183) : la case changée dans la fiche s'enregistre avec « Valider »
const valider = async p => { await p.click('#f-ok'); await p.waitForTimeout(250); };
const cocher = async (p, id, t) => { await ouvrir(p, id); await p.click(`#fe-zone [data-fe="${t}"]`); await p.waitForTimeout(150); await valider(p); await ouvrir(p, id); return { c: await cases(p), info: await p.textContent('#fe-info') }; };
const annee = async (p, a) => { await onglet(p, 'plus'); await p.click('#pl-frais'); await p.waitForSelector('#fr-l'); await p.click(`#fr-l [data-an="${a}"]`); await p.waitForSelector('#fa-l'); };
const lignes = p => p.$$eval('#fa-l .lv', l => l.map(x => x.innerText.replace(/\s+/g, ' ').replace(/ /g, ' ').trim()));
const carte = (p, id) => p.$eval(`#fa-l [data-ligne="${id}"]`, x => ({ h: [...x.querySelectorAll('.lv-h')].map(e => e.innerText.replace(/\s+/g, ' ').replace(/ /g, ' ').trim()),
  traj: [...x.querySelectorAll('.traj')].map(e => e.textContent), nu: [...x.querySelectorAll('.nu')].map(e => e.textContent), bas: x.querySelector('.lv-q').textContent.replace(/ /g, ' '),
  fs: [...x.querySelectorAll('.lv-h')].map(e => getComputedStyle(e).fontSize), tb: (e => e && { fw: getComputedStyle(e).fontWeight, bg: getComputedStyle(e).backgroundColor, bl: getComputedStyle(e).borderLeftWidth })(x.querySelector('.traj')) }));
const carnetEASA = p => p.evaluate(async () => { const e = await import('./js/etat.js'), t = await import('./js/totaux.js'), s = await import('./js/sauvegarde.js'), d = await import('./js/pdf.js');
  const v = [...e.etat.vols].reverse(); return JSON.stringify([t.calculerTotaux(v, e.etat.avions, '2026-12-31'), s.texteTableur(v, e.etat.avions, e.listeDesCompteurs()), d.paginer(v, e.etat.avions).map(x => [x.totalPage, x.cumul])]); });

try {
  const A = await appareil('A'); await remplir(A.p, VOLS);
  const p = A.p, easa0 = await carnetEASA(p);
  verifier(Number((await p.evaluate(async () => (await import('./js/version.js')).VERSION)).split('.')[1]) >= 70, 'version 0.70 ou suivante');

  console.log('Reprise des anciennes cases J+2');
  let v = await vols(p);
  verifier(v.x1.frais.type === 'j1' && v.x1.frais.pays === 'Espagne' && v.x1.frais.paysManuel && v.x2.frais.type === 'j2' && !v.x2.frais.pays && v.x3.frais.type === 'j2',
    'deux J+2 qui se suivent : J.1 (pays Espagne gardé) puis J.2 ; J+2 seul : J.2');
  verifier(Object.values(v).every(x => x.modifieLe === H), '« Modifié le » inchangé');

  console.log('R172 : quatre cases sur deux lignes');
  await ouvrir(p, 'a1');
  verifier(JSON.stringify(await p.$$eval('#fe-zone [data-fe]', l => l.map(b => b.textContent))) === '["VOL JOURNÉE","DÉTACHEMENT","J.1","J.2"]', 'VOL JOURNÉE, DÉTACHEMENT, J.1, J.2');
  for (const largeur of [360, 393]) {
    await p.setViewportSize({ width: largeur, height: 852 }); await p.waitForTimeout(150); await p.locator('#fe-zone').scrollIntoViewIfNeeded();
    const m = await p.evaluate(() => ({ deborde: document.documentElement.scrollWidth > innerWidth, r: [...document.querySelectorAll('#fe-zone [data-fe]')].map(b => { const q = b.getBoundingClientRect(); return [Math.round(q.top), Math.round(q.left), Math.round(q.height)]; }) }));
    const [j, d, j1, j2] = m.r;
    verifier(!m.deborde && j[0] === d[0] && j1[0] === j2[0] && j1[0] > j[0] && j[1] === j1[1] && d[1] === j2[1] && m.r.every(x => x[2] >= 40), `${largeur} px : deux lignes de deux cases, alignées, ≥ 40 px, rien ne déborde`);
    await p.screenshot({ path: join(CAPT, `v070-cases-${largeur}.png`) });
  }
  await p.setViewportSize({ width: 393, height: 852 });

  console.log('R177 : J.1 le 17 (2 vols) + J.2 le 18 (4 vols)');
  await p.click('#fe-zone [data-fe="j1"]'); await p.waitForTimeout(250);
  // v0.71 (R181) : J.1 coche tout seul J.2 sur les vols du lendemain
  verifier((await cases(p)).j1 && await p.inputValue('#fe-pays') === 'France' && (await p.textContent('#fe-info')) === 'Avec le J.2 du 18/11 : 2 jours, nuit France, 1,5 × 174,00 € = 261,00 €',
    `J.1 : pays de la nuit France (LFPB, dernier atterrissage) ; « ${await p.textContent('#fe-info')} »`);
  await valider(p);
  v = await vols(p);
  verifier(v.a1.frais.type === 'j1' && v.a2.frais.type === 'j1' && ['b1', 'b2', 'b3', 'b4'].every(id => v[id].frais.type === 'j2') && v.a1.modifieLe === H,
    'coché sur les deux vols du 17, J.2 sur les quatre vols du 18 ; « Modifié le » inchangé');
  await fermer(p);
  await annee(p, '2025');
  let k = await carte(p, 'j2|2025-11-17');
  verifier(JSON.stringify(k.h) === '["17/11/2025 · J.1 261,00 €","18/11/2025 · J.2"]' && JSON.stringify(k.traj) === '["LFTW → LFTH → LFPB","LFPB → LFRN → LEMD → LFPB → LFTW"]' && k.bas === 'Nuit France · 6 vols · 1,5 indemnité × 174,00 €',
    `une carte, deux lignes avec leur trajet, un montant en haut, le calcul en bas (${k.h.join(' / ')})`);
  verifier(k.fs[0] === k.fs[1] && Number(k.tb.fw) >= 700 && k.tb.bg !== 'rgba(0, 0, 0, 0)' && k.tb.bl === '3px', 'en-têtes de la même taille ; trajet en gras dans une bande avec un trait à gauche');
  await p.click('#ou-x');
  // J.1 seul / J.2 seul (v0.71 : chaque vol se décoche seul)
  for (const id of ['b1', 'b2', 'b3', 'b4']) { await cocher(p, id, 'j2'); await fermer(p); }
  await annee(p, '2025'); k = await carte(p, 'j1i|2025-11-17');
  verifier(k.h[0] === '17/11/2025 · J.1 incomplet 0,00 €' && k.bas.includes('Coche aussi le J.2 du lendemain'), 'J.1 seul : « J.1 incomplet », 0,00 €');
  await p.click('#ou-x');
  for (const id of ['a1', 'a2']) { await cocher(p, id, 'j1'); await fermer(p); }
  await cocher(p, 'b2', 'j2'); await fermer(p);
  await annee(p, '2025'); k = await carte(p, 'j2i|2025-11-18');
  verifier(k.h[0] === '18/11/2025 · J.2 incomplet 0,00 €' && k.bas.includes('Coche aussi le J.1 de la veille'), 'J.2 seul : « J.2 incomplet », 0,00 €');
  await p.click('#ou-x');
  for (const [id, t] of [['a1', 'j1'], ['a2', 'j1'], ['b1', 'j2'], ['b3', 'j2'], ['b4', 'j2']]) { await cocher(p, id, t); await fermer(p); } // de nouveau la paire

  console.log('R180 : VOL JOURNÉE sur tous les vols du jour ; décocher un vol seul');
  let r = await cocher(p, 'c2', 'journee'); await fermer(p);
  v = await vols(p); verifier(['c1', 'c2', 'c3'].every(id => v[id].frais.type === 'journee') && r.info.includes('3 vols cochés ce jour'), `coché sur un vol : les trois vols du 03/12 (« ${r.info} »)`);
  const rond = await p.$$eval('#list .flight', l => Object.fromEntries(l.map(c => [c.dataset.id, c.querySelector('.fl-rep').classList.contains('frais')])));
  verifier(rond.c1 && rond.c2 && rond.c3 && rond.a1 && rond.b4 && !rond.e1, 'cercle noir sur tous les vols cochés');
  await annee(p, '2025'); k = await carte(p, 'journee|2025-12-03');
  verifier(k.h[0] === '03/12/2025 · Vol journée 87,00 €' && JSON.stringify(k.traj) === '["LFTW → LFTH → LFPB → LFTW"]' && k.bas === '3 vols · ½ indemnité zone euro', `« 03/12/2025 · Vol journée », trajet LFTW → LFTH → LFPB → LFTW (${k.bas})`);
  await p.click('#ou-x');
  await cocher(p, 'c3', 'journee'); await fermer(p);
  v = await vols(p); verifier(v.c1.frais.type === 'journee' && v.c2.frais.type === 'journee' && v.c3.frais.type === null, 'décoché sur un vol : les deux autres restent cochés');
  await cocher(p, 'c1', 'journee'); await fermer(p);

  console.log('R178 : pays de la nuit automatique');
  r = await cocher(p, 'e1', 'j1');
  verifier(await p.inputValue('#fe-pays') === 'Espagne', 'J.1 dont le dernier vol arrive à LEMD : Espagne');
  await fermer(p);
  await ouvrir(p, 'e2'); await p.fill('#fe-pays', 'portugal'); await p.dispatchEvent('#fe-pays', 'change'); await p.waitForTimeout(250); await valider(p); await ouvrir(p, 'e2');
  v = await vols(p);
  verifier(v.e1.frais.pays === 'Portugal' && v.e1.frais.paysManuel && v.e2.frais.paysManuel && await p.evaluate(() => document.getElementById('fe-pays-z').classList.contains('manuel')), 'changé à la main : Portugal, sur les deux vols du jour');
  await fermer(p);
  await p.evaluate(async () => { const e = await import('./js/etat.js'), x = e.etat.vols.find(v => v.id === 'e2'); await e.enregistrerVol({ ...x, arr: 'LEBL' }, { garderDate: true }); }); // le vol change : le choix reste
  await ouvrir(p, 'e1'); verifier(await p.inputValue('#fe-pays') === 'Portugal', 'choix à la main jamais remplacé ensuite'); await fermer(p);
  await p.evaluate(async () => { const e = await import('./js/etat.js'), x = e.etat.vols.find(v => v.id === 'e2'); await e.enregistrerVol({ ...x, arr: 'LEMD' }, { garderDate: true }); });
  for (const [id, pays] of [['r1', 'La Réunion'], ['m1', 'Mayotte']]) { await cocher(p, id, 'j1'); verifier(await p.inputValue('#fe-pays') === pays, `${id === 'r1' ? 'FMEE' : 'FMCZ'} : ${pays}`); await fermer(p); }
  await cocher(p, 'z1', 'j1');
  verifier(await p.inputValue('#fe-pays') === '' && await p.getAttribute('#fe-pays', 'placeholder') === 'Pays à choisir', 'code inconnu : champ vide « Pays à choisir »');
  await fermer(p); await ouvrir(p, 'z2'); r = { c: await cases(p), info: await p.textContent('#fe-info') };
  verifier(r.c.j2 && r.info === 'Pays de la nuit à choisir sur le J.1', `J.2 (mis tout seul) : « ${r.info} »`); await fermer(p);

  console.log('R174 : détachement La Réunion, deux nuits à FIMP');
  await ouvrir(p, 'd1'); await p.click('#fe-zone [data-fe="detachement"]'); await p.waitForSelector('#dt-modal:not([hidden])');
  await p.fill('#dt-du', '2025-01-05'); await p.dispatchEvent('#dt-du', 'change'); await p.fill('#dt-au', '2025-01-10'); await p.dispatchEvent('#dt-au', 'change');
  await p.fill('#dt-pays', 'la réunion'); await p.dispatchEvent('#dt-pays', 'change'); await p.waitForTimeout(150);
  const nuits = await p.$$eval('#dt-nuits [data-nuit]', l => l.map(i => `${i.dataset.nuit.slice(8)} ${i.value}`));
  verifier(JSON.stringify(nuits) === '["05 La Réunion","06 Maurice","07 Maurice","08 La Réunion","09 La Réunion"]', `nuits : ${nuits.join(' · ')} (jour sans vol : nuit d'avant)`);
  verifier(!(await p.$('#dt-nuits .dt-nuit.modifie')), 'trouvées toutes seules : rien en jaune');
  await p.click('#dt-ok'); await p.waitForTimeout(300); await fermer(p);
  await annee(p, '2025');
  const idDet = await p.$eval('#fa-l [data-ligne^="det|"]', x => x.dataset.ligne);
  k = await carte(p, idDet);
  verifier(k.h[0].startsWith('05/01/2025 · Détachement 6 jours') && JSON.stringify(k.traj) === '["La Réunion"]' && JSON.stringify(k.nu) === '["Nuit 06/01 : FIMP","Nuit 07/01 : FIMP"]',
    `pas d'étapes : le pays ; pastilles seulement pour les deux nuits à Maurice (${k.nu.join(', ')})`);
  for (const largeur of [360, 393]) {
    await p.setViewportSize({ width: largeur, height: 852 }); await p.waitForTimeout(150);
    const m = await p.evaluate(() => ({ deborde: document.documentElement.scrollWidth > innerWidth, sort: [...document.querySelectorAll('#fa-l .traj, #fa-l .nu')].some(e => e.getBoundingClientRect().right > innerWidth) }));
    verifier(!m.deborde && !m.sort, `${largeur} px : cartes lisibles, rien ne déborde`);
    await p.screenshot({ path: join(CAPT, `v070-liste-${largeur}.png`), fullPage: true });
  }
  await p.setViewportSize({ width: 393, height: 852 });

  console.log('R171 : barème replié');
  const pl = () => p.evaluate(() => ({ cache: document.getElementById('fb-plie').hidden, txt: document.getElementById('fb-plier').innerText.replace(/\s+/g, ' ').trim(), ex: document.getElementById('fb-plier').getAttribute('aria-expanded') }));
  let b = await pl();
  verifier(b.cache && /^Pays \(\d+\) ▼ Afficher$/.test(b.txt) && b.ex === 'false' && await p.isVisible('#fb-j'), `replié : « ${b.txt} » ; « Vol journée » visible`);
  await p.click('#fb-plier'); b = await pl();
  verifier(!b.cache && b.txt.endsWith('▲ Masquer') && await p.isVisible('#fb-q'), 'un appui : déplié, recherche comprise');
  await p.locator('#fb-pays .fb-row', { has: p.locator('.fb-nom[value="Espagne"]') }).locator('.fb-m').fill('180,00');
  await p.locator('#fb-pays .fb-row', { has: p.locator('.fb-nom[value="Italie"]') }).locator('.fb-m').fill('181,00');
  await p.click('#fb-ok'); await p.waitForTimeout(300); b = await pl();
  verifier(b.cache && /^Pays \(\d+\) 2 modifiés par toi ▼ Afficher$/.test(b.txt), `compteur : « ${b.txt} »`);
  await p.click('#fb-plier'); await p.click('#fb-plier'); b = await pl();
  verifier(b.cache && b.ex === 'false', 'un autre appui : replié');
  await p.screenshot({ path: join(CAPT, 'v070-bareme.png') });
  await p.click('#ou-x');

  console.log('PDF : même présentation');
  const m = await p.evaluate(async () => (await import('./js/ui/frais.js')).modelePdf('2025'));
  const pj = m.lignes.find(x => x.titre === '17/11/2025 · J.1');
  verifier(pj && JSON.stringify(pj.jours) === JSON.stringify([{ titre: '17/11/2025 · J.1', etapes: 'LFTW → LFTH → LFPB' }, { titre: '18/11/2025 · J.2', etapes: 'LFPB → LFRN → LEMD → LFPB → LFTW' }]) && pj.vols.length === 6,
    'J.1 / J.2 : deux lignes avec leur trajet, les 6 vols du carnet dessous');
  const pd = m.lignes.find(x => x.titre.startsWith('05/01/2025 · Détachement'));
  verifier(pd && pd.jours[0].etapes === 'La Réunion' && JSON.stringify(pd.pastilles) === '["Nuit 06/01 : FIMP","Nuit 07/01 : FIMP"]' && pd.vols.length === 5, 'détachement : pays, nuits ailleurs, vols du carnet dessous');
  const pdf = await p.evaluate(async () => { const f = await import('./js/ui/frais.js'), d = f.dessinerPdf(window.jspdf.jsPDF, f.modelePdf('2025')), s = d.output();
    return { pages: d.getNumberOfPages(), t: s.includes('(18/11/2025 \xb7 J.2)'), tr: s.includes('(LFPB -> LFRN -> LEMD -> LFPB -> LFTW)'), nu: s.includes('Nuit 06/01 : FIMP') }; });
  verifier(pdf.pages >= 1 && pdf.t && pdf.tr && pdf.nu, `PDF dessiné (${pdf.pages} page(s)) : « 18/11/2025 · J.2 », son trajet, « Nuit 06/01 : FIMP »`);

  console.log('Synchro A -> B, sauvegarde, ancienne sauvegarde');
  const vue = async X => { await annee(X.p, '2025'); const l = [await lignes(X.p), await X.p.textContent('#fa-tot')]; await X.p.click('#ou-x'); return JSON.stringify(l); };
  const refA = await vue(A);
  await rejoindre(p, 'ref'); await actualiser(p);
  const B = await appareil('B'); await rejoindre(B.p, 'mod');
  verifier(await vue(B) === refA, 'B : mêmes lignes et même total 2025');
  await ouvrir(B.p, 'e2'); verifier(await B.p.inputValue('#fe-pays') === 'Portugal' && (await cases(B.p)).j1, 'B : J.1 et pays choisi à la main reçus'); await fermer(B.p);
  const json = await p.evaluate(async () => { const e = await import('./js/etat.js'), s = await import('./js/sauvegarde.js'); return JSON.stringify(s.creerSauvegarde(await e.contenuComplet())); });
  const C = await appareil('C');
  const restaurer = async f => { await onglet(C.p, 'plus'); await C.p.click('#pl-restore');
    const [ch] = await Promise.all([C.p.waitForEvent('filechooser'), C.p.click('#rs-fichier')]); await ch.setFiles(f); await C.p.waitForSelector('#rs-ok'); await C.p.click('#rs-ok'); await C.p.waitForTimeout(900); await onglet(C.p, 'carnet'); };
  const f1 = join(CAPT, 'v070-sauvegarde.json'); writeFileSync(f1, json); await restaurer(f1);
  verifier(await vue(C) === refA, 'C restauré : mêmes lignes et même total');
  const vieux = JSON.parse(json); vieux.versionApp = '0.69'; vieux.reglages = vieux.reglages.filter(x => x.cle !== 'migrationFraisJ1');
  vieux.vols = vieux.vols.map(x => (['x1', 'x2', 'x3'].includes(x.id) ? VOLS.find(y => y.id === x.id) : x));
  const f2 = join(CAPT, 'v070-ancienne.json'); writeFileSync(f2, JSON.stringify(vieux)); await restaurer(f2);
  v = await vols(C.p);
  verifier(v.x1.frais.type === 'j1' && v.x1.frais.pays === 'Espagne' && v.x2.frais.type === 'j2' && v.x3.frais.type === 'j2', 'ancienne sauvegarde (J+2) : reprise en J.1 / J.2');

  verifier(await carnetEASA(p) === easa0, 'PDF EASA, CSV et totaux d\'heures inchangés');
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.70 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); faux.closeAllConnections?.(); faux.close(); srv.fermer();
}

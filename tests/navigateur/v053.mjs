// v0.53 : R130 instructeur ou examinateur EN PLUS du copi (saisie, bulle « Inst / Exam » couleur Copi, lecture seule,
// recherche, sauvegarde / restauration, synchro avec un FAUX NAS, heures inchangées) ; rattrapage depuis un FAUX fichier
// FlyLog (usage unique, aussi sur l'appareil synchronisé) ; R131 « CdB ». Vols, trigrammes et immatriculations INVENTÉS ;
// toute adresse non locale est BLOQUÉE. Captures : tests/navigateur/captures/v053-*.png. Usage : node tests/navigateur/v053.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE, fermerFiche } from './outils.mjs';
import { fauxFlyLog } from '../outils/faux-flylog.js';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2026-11-15T08:00:00Z';
const AVION = { id: 'a1', immat: 'F-XZZA', typeOACI: 'DH8D', modele: 'Dash 8 Q400 MR', constructeur: 'ESSAI', nom: 'M91', indicatif: '', equipage: 'MP', moteurs: 'ME',
  moteur: 'T', surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', creeLe: H, modifieLe: H };
const vol = (id, date, hDep, dep, arr, champs = {}) => ({ id, date, hDep, hArr: '23:00', mode: 'utc', dep, arr, escales: [], avionId: 'a1', tempsTotal: 60, tempsMP: null, tempsSE: null,
  tempsME: null, tempsCdB: 60, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: 'ZZA', nomInstructeur: '', nomExaminateur: '', missions: [], remarques: '', feux: 0, compteurs: {},
  etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'flylog', ordre: Date.parse(`${date}T${hDep}Z`), creeLe: H, modifieLe: H, ...champs });
const VOLS = [vol('v1', '2026-11-10', '10:00', 'LFTW', 'LFMT'), vol('v2', '2025-03-01', '10:00', 'LFTW', 'LFMT'), vol('v3', '2025-03-02', '11:00', 'LFTW', 'LFTW'),
  vol('v4', '2025-03-03', '12:00', 'LFTW', 'LFKJ', { nomInstructeur: 'ZZD' })];
const L = (date, debut, dep, arr, champs = {}) => ({ DATE: date, DEPARTURE_AIRPORT: dep, ARRIVAL_AIRPORT: arr, AIRCRAFT_TYPE: 'DH8D', AIRCRAFT_REGISTRATION: 'FXZZA',
  DURATION_BLOCK: '1:00', LDGS_DAY: '1', TIME_BLOCK_START: debut, TIME_BLOCK_END: '23:00', DURATION_PIC: '1:00', DURATION_MULTI_PILOT: '1:00', NAME_PIC: 'SELF', ...champs });
const FICHIER_BON = fauxFlyLog([
  L('2025-03-01', '10:00', 'LFTW', 'LFMT', { NAME_COPILOT: 'ZZA', NAME_INSTRUCTOR: 'ZZB' }),   // v2 : à compléter
  L('2025-03-02', '11:00', 'LFTW', 'LFTW', { NAME_COPILOT: 'ZZA', NAME_EXAMINER: 'ZZC' }),     // v3 : à compléter
  L('2025-03-03', '12:00', 'LFTW', 'LFKJ', { NAME_COPILOT: 'ZZA', NAME_INSTRUCTOR: 'ZZB' }),   // v4 : déjà rempli (ZZD) : jamais modifié
  L('2025-03-04', '13:00', 'LFTW', 'LFMN', { NAME_COPILOT: 'ZZA', NAME_INSTRUCTOR: 'ZZB' })]); // absent du carnet
const FICHIER_AUTRE = fauxFlyLog([L('2024-01-01', '09:00', 'LFMN', 'LFMN', { NAME_COPILOT: 'ZZA', NAME_INSTRUCTOR: 'ZZB' })]); // rien de retrouvé
const fichiers = { bon: join(CAPT, 'v053-flylog-bon.csv'), autre: join(CAPT, 'v053-flylog-autre.csv') };
writeFileSync(fichiers.bon, FICHIER_BON); writeFileSync(fichiers.autre, FICHIER_AUTRE);

// ---------- Faux NAS v5 (synchro) ----------
const srv = await serveur();
const nas = { mdp: 'mot-de-passe-essai-53', rev: 0, el: new Map() };
const faux = createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), action = u.searchParams.get('action');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Carnet-Cle, X-Carnet-Empreinte', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const morceaux = [];
  req.on('data', m => morceaux.push(m));
  req.on('end', () => {
    const json = (o, code = 200) => { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(code === 200 ? o : { ...o, code })); };
    if (req.headers['x-carnet-cle'] !== nas.mdp) return json({ erreur: 'mot-de-passe' }, 401);
    if (action === 'test') return json({ ok: true, copies: 0, cle: 'carnet', version: 5 });
    if (action === 'envoyer') return json({ ok: true, id: 'x', vols: 1, taille: 1, verification: 'empreinte' });
    if (action === 'vols-liste') return json({ vols: [] });
    if (action === 'synchro-etat') return json({ ok: true, rev: nas.rev, nombres: {} });
    if (action === 'synchro-recevoir') {
      const depuis = Number(u.searchParams.get('depuis')), limite = Number(u.searchParams.get('limite'));
      const tous = [...nas.el.entries()].filter(([, e]) => e.rev > depuis).sort((a, b) => a[1].rev - b[1].rev);
      const page = tous.slice(0, limite).map(([cle, e]) => ({ magasin: cle.split('/')[0], id: cle.slice(cle.indexOf('/') + 1), ...e }));
      const suite = tous.length > limite;
      return json({ ok: true, rev: nas.rev, elements: page, suite, jusqua: suite ? page.at(-1).rev : nas.rev });
    }
    if (action === 'synchro-envoyer') { // comme carnet.php v5 : l'élément (le vol entier) est gardé tel quel
      const b = JSON.parse(Buffer.concat(morceaux).toString());
      const acceptees = [], deja = [], conflits = [];
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
async function appareil(nom, { remplir = true } = {}) {
  const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
  await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|Access-Control|access control/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  if (remplir) {
    await p.evaluate(async ([a, vs]) => {
      const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
      const t = db.transaction(['avions', 'vols'], 'readwrite'); t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
      await new Promise(ok => { t.oncomplete = ok; }); db.close();
    }, [AVION, VOLS]);
    await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  }
  return { p, ctx };
}
const bulles = (p, id) => p.$$eval(`.flight[data-id="${id}"] .chips .chip`, l => l.map(c => ({ t: c.textContent, fond: getComputedStyle(c).backgroundColor, encre: getComputedStyle(c).color, bord: getComputedStyle(c).borderTopColor })));
const volDe = (p, id) => p.evaluate(async id => (await import('./js/etat.js')).etat.vols.find(v => v.id === id), id);
const totaux = p => p.evaluate(async () => { const t = await import('./js/totaux.js'), e = await import('./js/etat.js'); return JSON.stringify(t.calculerTotaux(e.etat.vols, e.etat.avions, '2026-11-21')); });
async function modifier(p, id, action) {
  await p.click('.tabs button[data-v="carnet"]'); await p.click(`.flight[data-id="${id}"]`); await p.waitForSelector('#v-saisie:not([hidden])');
  await p.click('#f-edit'); await p.waitForTimeout(150);
  await action();
  await p.click('#save'); await p.waitForSelector('#v-carnet:not([hidden])'); await p.waitForTimeout(250);
}
const fini = (p, sel) => p.waitForFunction(s => { const e = document.querySelector(s); return e && e.textContent.trim() && !/en cours|Envoi :|Réception :|prêt \?/.test(e.textContent); }, sel, { timeout: 60000 });
async function rejoindre(p, role) {
  await p.click('.tabs button[data-v="plus"]'); await p.click('#pl-sync'); await p.click('#sy-nas'); await p.fill('#nas-adr', ADRESSE_NAS); await p.fill('#nas-mdp', nas.mdp); await p.click('#nas-ok'); await p.waitForTimeout(400); await p.click('#ou-x');
  await p.click('#pl-sync');
  if (role === 'ref') { await p.click('#sy-ref'); await p.click('#sr-ok'); await fini(p, '#sr-res'); } else { await p.click('#sy-mod'); await p.click('#sc-ok'); await fini(p, '#sc-res'); }
  await p.click('#ou-x'); await p.click('.tabs button[data-v="carnet"]');
}
const actualiser = async p => { await p.click('#rafraichir'); await p.waitForFunction(() => !document.getElementById('rafraichir').classList.contains('tourne'), null, { timeout: 30000 }); await p.waitForTimeout(300); };

try {
  const A = await appareil('A');
  const t0 = await totaux(A.p);

  console.log('R130 : saisie d\'un instructeur en plus du copi');
  await A.p.click('.flight[data-id="v1"]'); await A.p.waitForSelector('#v-saisie:not([hidden])');
  verifier(await A.p.isHidden('#ie-add') && await A.p.isHidden('#ie-z'), 'lecture seule, sans instructeur : ni lien, ni ligne');
  await A.p.click('#f-edit'); await A.p.waitForTimeout(100);
  verifier(await A.p.isVisible('#ie-add') && await A.p.isHidden('#ie-z'), 'modification : lien « + Instructeur / Examinateur », pas de ligne tant qu\'on ne s\'en sert pas');
  await A.p.click('#ie-add');
  verifier(await A.p.isVisible('#ie-z') && await A.p.getAttribute('#ie-inst', 'aria-pressed') === 'true' && await A.p.isHidden('#ie-add'), 'la ligne s\'ouvre (« Inst » choisi), le lien disparaît');
  await A.p.fill('#ie-nom', 'ZZB');
  await A.p.screenshot({ path: join(CAPT, 'v053-saisie.png'), fullPage: false });
  await A.p.click('#save'); await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(250);
  let b = await bulles(A.p, 'v1');
  verifier(b.slice(0, 3).map(x => x.t).join(' | ') === 'CdB | Copi ZZA | Inst ZZB', `bulles : ${b.map(x => x.t).join(' | ')} (dans cet ordre ; « CdB » et non « CDB »)`);
  verifier(b[2].fond === b[1].fond && b[2].encre === b[1].encre && b[2].bord === b[1].bord && b[2].fond === 'rgb(236, 246, 237)' && b[2].encre === 'rgb(67, 160, 71)',
    '« Inst ZZB » : même couleur que la bulle Copi (fond #ecf6ed, texte et contour #43a047)');
  let v = await volDe(A.p, 'v1');
  verifier(v.nomInstructeur === 'ZZB' && v.nomExaminateur === '' && v.tempsCdB === 60 && !v.tempsInst, 'vol enregistré : nomInstructeur ZZB, heures de fonction inchangées');
  verifier(await totaux(A.p) === t0, 'tous les totaux identiques avec un instructeur en plus');
  await A.p.locator('.flight[data-id="v1"]').screenshot({ path: join(CAPT, 'v053-carte.png') });

  console.log('Lecture seule et recherche');
  await A.p.click('.flight[data-id="v1"]'); await A.p.waitForSelector('#v-saisie:not([hidden])');
  verifier(await A.p.isVisible('#ie-z') && await A.p.inputValue('#ie-nom') === 'ZZB' && await A.p.getAttribute('#ie-inst', 'aria-pressed') === 'true' && await A.p.isHidden('#ie-x') && await A.p.isHidden('#ie-add'),
    'fiche en lecture : « Inst » ZZB affiché, sans croix ni lien');
  await fermerFiche(A.p);
  await A.p.click('#q-open'); await A.p.fill('#q', 'ZZB'); await A.p.waitForTimeout(300);
  verifier(JSON.stringify(await A.p.$$eval('#list .flight', l => l.map(c => c.dataset.id))) === '["v1"]', 'recherche « ZZB » (instructeur) : le vol est trouvé');
  await A.p.click('#q-open'); await A.p.waitForTimeout(200);

  console.log('Examinateur, puis ligne retirée');
  await modifier(A.p, 'v1', () => A.p.click('#ie-exam'));
  b = await bulles(A.p, 'v1'); v = await volDe(A.p, 'v1');
  verifier(b[2].t === 'Exam ZZB' && b[2].fond === 'rgb(236, 246, 237)' && v.nomExaminateur === 'ZZB' && v.nomInstructeur === '', `Exam : bulle « ${b[2].t} », nomExaminateur ZZB, nomInstructeur vidé`);
  await A.p.click('#q-open'); await A.p.fill('#q', 'ZZB'); await A.p.waitForTimeout(300);
  verifier((await A.p.$$eval('#list .flight', l => l.map(c => c.dataset.id))).join() === 'v1', 'recherche « ZZB » (examinateur) : le vol est trouvé');
  await A.p.click('#q-open'); await A.p.waitForTimeout(200);
  await modifier(A.p, 'v1', () => A.p.click('#ie-x'));
  b = await bulles(A.p, 'v1'); v = await volDe(A.p, 'v1');
  verifier(!b.some(x => /^(Inst|Exam) /.test(x.t)) && v.nomExaminateur === '' && v.nomInstructeur === '', 'ligne retirée : plus de bulle, champs vidés');
  verifier(await totaux(A.p) === t0, 'totaux toujours identiques');
  await modifier(A.p, 'v1', async () => { await A.p.click('#ie-add'); await A.p.fill('#ie-nom', 'ZZB'); }); // de nouveau un instructeur, pour la suite

  console.log('Sauvegarde puis restauration');
  await A.p.click('.tabs button[data-v="plus"]'); await A.p.click('#pl-save');
  const [dl] = await Promise.all([A.p.waitForEvent('download'), A.p.click('#sv-dl')]);
  const sauvegarde = join(CAPT, 'v053-sauvegarde.json'); await dl.saveAs(sauvegarde); await A.p.click('#ou-x');
  const R = await appareil('R', { remplir: false });
  await R.p.click('.tabs button[data-v="plus"]'); await R.p.setInputFiles('#file-restore', sauvegarde); await R.p.click('#rs-ok'); await R.p.waitForTimeout(500);
  verifier((await volDe(R.p, 'v1'))?.nomInstructeur === 'ZZB', 'restauration : l\'instructeur est gardé');
  await R.ctx.close();

  console.log('Synchro entre deux appareils (faux NAS)');
  await rejoindre(A.p, 'ref');
  const B = await appareil('B', { remplir: false });
  await rejoindre(B.p, 'mod');
  verifier(nas.el.get('vols/v1')?.donnees?.nomInstructeur === 'ZZB' && (await volDe(B.p, 'v1'))?.nomInstructeur === 'ZZB', 'synchro : le vol garde son instructeur au NAS et sur l\'appareil B');
  verifier((await bulles(B.p, 'v1'))[2]?.t === 'Inst ZZB', 'appareil B : bulle « Inst ZZB »');

  // v0.55 (R142) : le bouton « Compléter instructeur / examinateur depuis FlyLog » est retiré de Plus
  await A.p.click('.tabs button[data-v="plus"]'); await A.p.waitForTimeout(200);
  verifier(!(await A.p.$('#pl-ie')) && !(await A.p.$('#file-ie')), 'Plus : plus de bouton « Compléter instructeur / examinateur »');
  verifier(await totaux(A.p) === t0, 'tous les totaux identiques');

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.53 réussie.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await nav.close(); faux.closeAllConnections?.(); faux.close(); srv.fermer();
}

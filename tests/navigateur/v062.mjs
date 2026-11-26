// v0.62 : R156 Plus › « Anomalies traitées » (onglets Corrigées / Ignorées ; vol corrigé après un « ! » ; vol sans « ! » : aucune
// ligne ; vol supprimé : ligne retirée ; Ignorer / Ne plus ignorer ; badge et place dans le menu ; question du premier lancement,
// « Plus tard », rattrapage avec un FAUX fichier FlyLog (date = « Modifié le », vol non retrouvé, relance sans doublon) ; fait sur
// A : pas de question sur B ; synchro A -> B, sauvegarde, ancienne sauvegarde ; 360 / 393 px ; PDF, CSV, totaux inchangés).
// Carnet INVENTÉ, FAUX NAS v5, aucun serveur extérieur. Usage : node tests/navigateur/v062.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';
import { fauxFlyLog } from '../outils/faux-flylog.js';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const L = (DATE, ROUTE, autres = {}) => ({ DATE, DEPARTURE_AIRPORT: ROUTE.split('|')[0], ARRIVAL_AIRPORT: ROUTE.split('|').at(-1), ROUTE, AIRCRAFT_TYPE: 'DH8D',
  AIRCRAFT_REGISTRATION: 'FXZZX', DURATION_BLOCK: '1:00', LDGS_DAY: String(ROUTE.split('|').length - 1), TIME_BLOCK_START: '10:00', TIME_BLOCK_END: '11:00',
  DURATION_PIC: '1:00', DURATION_MULTI_PILOT: '1:00', NAME_PIC: 'SELF', ...autres });
// Faux fichier FlyLog d'origine (vols inventés)
const LIGNES = [
  L('2026-06-13', 'LFTW|LFML|LFTW'),                       // 1 : terrain intermédiaire 0 att. (corrigé avant la mise à jour)
  L('2026-07-14', 'LFTW|LFTW|LFML'),                       // 2 : intermédiaire = départ + 0 att. (corrigé avant, date inconnue)
  L('2026-08-01', 'LFTW|LFTW', { DURATION_PIC: '0:40' }),   // 3 : fonctions (corrigé dans la nouvelle version)
  L('2026-09-09', 'LFTW|LFTW'),                            // 4 : sans anomalie
  L('2026-09-20', 'LFTW|LFMV|LFTW'),                       // 5 : 0 att. (ignoré)
  L('2026-10-02', 'LFTW|LFML'),                            // 6 : supprimé du carnet (vol du fichier non retrouvé)
];
const FICHIER = join(CAPT, 'v062-faux-flylog.csv');
writeFileSync(FICHIER, fauxFlyLog(LIGNES));

// ---------- Faux NAS v5 (synchro + vols NPF) ----------
const srv = await serveur();
const nas = { mdp: 'mot-de-passe-essai-62', rev: 0, el: new Map(), npf: new Map() };
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
    if (action === 'vols-liste') return json({ vols: [...nas.npf.values()] });
    if (action === 'vol-retirer') return json({ ok: true, retire: nas.npf.delete(u.searchParams.get('id')) });
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
async function appareil(nom, { largeur = 393 } = {}) {
  const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: largeur, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
  await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|Access-Control|access control/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  return { p, ctx };
}
const onglet = (p, v) => p.click(`.tabs button[data-v="${v}"]`);
const vols = p => p.evaluate(async () => (await import('./js/etat.js')).etat.vols);
const volDu = async (p, date) => (await vols(p)).find(v => v.date === date);
const reg = (p, k) => p.evaluate(async k => (await import('./js/etat.js')).reglage(k), k);
const fini = (p, sel) => p.waitForFunction(s => { const e = document.querySelector(s); return e && e.textContent.trim() && !/en cours|Envoi :|Réception :|prêt \?/.test(e.textContent); }, sel, { timeout: 60000 });
async function rejoindre(p, role) {
  await onglet(p, 'plus'); await p.click('#pl-sync'); await p.click('#sy-nas'); await p.fill('#nas-adr', ADRESSE_NAS); await p.fill('#nas-mdp', nas.mdp); await p.click('#nas-ok'); await p.waitForTimeout(400); await p.click('#ou-x');
  await p.click('#pl-sync');
  if (role === 'ref') { await p.click('#sy-ref'); await p.click('#sr-ok'); await fini(p, '#sr-res'); } else { await p.click('#sy-mod'); await p.click('#sc-ok'); await fini(p, '#sc-res'); }
  await p.click('#ou-x'); await onglet(p, 'carnet');
}
const actualiser = async p => { await onglet(p, 'carnet'); await p.click('#rafraichir'); await p.waitForFunction(() => !document.getElementById('rafraichir').classList.contains('tourne'), null, { timeout: 30000 }); await p.waitForTimeout(400); };
// écrit dans la base de l'appareil (vols changés, supprimés ; réglages retirés), puis relance l'app
async function base(p, { mettre = [], enlever = [], sansReglages = [] }) {
  await p.evaluate(async ([m, e, r]) => {
    const db = await new Promise(ok => { const q = indexedDB.open('carnet-de-vol'); q.onsuccess = () => ok(q.result); });
    const t = db.transaction(['vols', 'reglages'], 'readwrite');
    for (const v of m) t.objectStore('vols').put(v); for (const id of e) t.objectStore('vols').delete(id); for (const k of r) t.objectStore('reglages').delete(k);
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [mettre, enlever, sansReglages]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
}
const ouvrirAT = async p => { await onglet(p, 'plus'); await p.click('#pl-anom'); await p.waitForSelector('#at-l'); };
const choisir = async (p, quel) => { await p.click(quel === 'i' ? '#at-i' : '#at-c'); await p.waitForTimeout(150); };
const lignes = p => p.$$eval('#at-l .lv', l => l.map(e => ({ vol: e.dataset.vol, texte: e.innerText.replace(/\s+/g, ' ').trim(),
  barre: [...e.querySelectorAll('.lv-av-v')].map(x => { const s = getComputedStyle(x); return [x.textContent, s.textDecorationLine, s.color]; }),
  vert: [...e.querySelectorAll('.lv-ap')].map(x => [x.textContent, getComputedStyle(x).color]) })));
const badge = p => p.evaluate(() => { const b = document.getElementById('pl-anom-n'); return b.hidden ? null : b.textContent; });
const tabs = p => p.$$eval('.an-onglets button', l => l.map(b => b.textContent));
const etatCarnet = async p => p.evaluate(async () => { const e = await import('./js/etat.js'), t = await import('./js/totaux.js'), s = await import('./js/sauvegarde.js'), d = await import('./js/pdf.js');
  const v = e.etat.vols; return { vols: JSON.stringify([...v].sort((a, b) => a.id.localeCompare(b.id))), totaux: JSON.stringify(t.calculerTotaux(v, e.etat.avions, '2026-12-31')),
    csv: s.texteTableur([...v].reverse(), e.etat.avions, e.listeDesCompteurs()), pdf: JSON.stringify(d.totauxPDF([...v].reverse(), e.etat.avions)) }; });
const nbAnom = p => p.evaluate(async () => (await import('./js/ui/anomalies.js')).anomaliesActuelles().size);
const nbRep = p => p.evaluate(async () => (await import('./js/report.js')).nbAReporter((await import('./js/etat.js')).etat.vols));
const jourFr = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()}`; };

try {
  const A = await appareil('A');
  const version = await A.p.evaluate(async () => (await import('./js/version.js')).VERSION);
  verifier(Number(version.split('.')[1]) >= 62, `version ${version} (0.62 ou suivante)`);
  verifier(await reg(A.p, 'questionCorrections') === 'non', 'carnet vide au premier lancement : aucune question à poser');
  await onglet(A.p, 'plus'); await A.p.setInputFiles('#file-flylog', FICHIER); await A.p.waitForSelector('#im-ok'); await A.p.click('#im-ok'); await A.p.waitForSelector('.ctab'); await A.p.click('#ou-x');
  // corrections faites AVANT la mise à jour (vol 1 : le 20/11/2026 ; vol 2 : date inconnue), vol 6 supprimé ; la nouvelle version arrive
  const v1 = await volDu(A.p, '2026-06-13'), v2 = await volDu(A.p, '2026-07-14'), v6 = await volDu(A.p, '2026-10-02');
  await base(A.p, { mettre: [{ ...v1, escales: [{ ...v1.escales[0], attJour: 1 }], attJour: 1, modifieLe: '2026-11-20T08:00:00.000Z' },
    { ...v2, escales: [{ code: 'LFMV', attJour: 1, attNuit: 0 }], attJour: 1, modifieLe: null }], enlever: [v6.id], sansReglages: ['questionCorrections'] });

  console.log('Premier lancement de la nouvelle version : une seule question, « Plus tard »');
  await A.p.waitForSelector('#rq-modal:not([hidden])', { timeout: 8000 });
  verifier(await A.p.textContent('#rq-txt') === 'Retrouver les corrections déjà faites dans le fichier FlyLog d\'origine ?' && await A.p.textContent('#rq-oui') === 'Choisir le fichier' && await A.p.textContent('#rq-non') === 'Plus tard',
    'question « Retrouver les corrections déjà faites dans le fichier FlyLog d\'origine ? » avec « Choisir le fichier » et « Plus tard »');
  await A.p.screenshot({ path: join(CAPT, 'v062-question.png') });
  await A.p.click('#rq-non'); await A.p.waitForTimeout(200);
  verifier(await A.p.isHidden('#rq-modal') && await reg(A.p, 'questionCorrections') === 'posee', '« Plus tard » : la question se ferme');
  await A.p.reload(); await A.p.waitForSelector('body[data-pret="1"]'); await A.p.waitForTimeout(3500);
  verifier(await A.p.isHidden('#rq-modal'), 'relance de l\'app : la question ne revient pas');
  const avant = await etatCarnet(A.p), anomAvant = await nbAnom(A.p), repAvant = await nbRep(A.p);

  console.log('Menu PLUS');
  await onglet(A.p, 'plus');
  const ordre = await A.p.$$eval('.pcard .prow2', l => l.map(b => b.id));
  verifier(ordre[ordre.indexOf('pl-libelles') + 1] === 'pl-anom', '« Anomalies traitées » juste après « Libellés missions »');
  verifier(await A.p.$eval('#pl-anom-i svg path', e => e.getAttribute('fill')) === '#f5c400' && !/⚠/.test(await A.p.textContent('#pl-anom')), 'triangle jaune dessiné par l\'app (pas un emoji)');
  verifier(await badge(A.p) === null, 'badge caché (0 vol dans la liste)');
  await A.p.click('#pl-anom'); await A.p.waitForSelector('#at-l');
  verifier(JSON.stringify(await tabs(A.p)) === '["Corrigées (0)","Ignorées (0)"]' && await A.p.isVisible('#at-fl') && await A.p.textContent('#at-fl') === 'Retrouver les corrections dans FlyLog',
    'onglets « Corrigées (0) » / « Ignorées (0) », bouton « Retrouver les corrections dans FlyLog » en bas');

  console.log('Rattrapage avec le faux fichier FlyLog');
  const lancer = async () => { const [ch] = await Promise.all([A.p.waitForEvent('filechooser'), A.p.click('#at-fl')]); await ch.setFiles(FICHIER); await A.p.waitForSelector('#at-res'); return A.p.textContent('#at-res'); };
  let res = await lancer();
  verifier(res === '3 corrections retrouvées · 1 vol du fichier pas retrouvé dans le carnet (ignoré)', `« ${res} »`);
  let l = await lignes(A.p);
  verifier(l.length === 2, `2 vols dans « Corrigées » (${l.length})`);
  verifier(l[0].vol === v1.id && l[0].texte.includes('13/06/2026') && l[0].texte.includes('F-XZZX') && l[0].texte.includes('LFTW → LFML → LFTW') && l[0].texte.includes('Terrain intermédiaire, 0 att.')
    && l[0].texte.includes('Corrigé le 20/11/2026'), `vol corrigé le 20/11 en haut : « ${l[0].texte} »`);
  verifier(l[0].barre[0][0] === 'LFML : 0 att.' && l[0].barre[0][1] === 'line-through' && /^rgb\(179, 38, 30\)/.test(l[0].barre[0][2]) && l[0].vert[0][0] === 'LFML : 1 att.' && l[0].vert[0][1] === 'rgb(46, 125, 50)',
    'ancienne valeur barrée en rouge, nouvelle en vert');
  verifier(l[1].vol === v2.id && l[1].texte.includes('Intermédiaire = départ ou arrivée') && l[1].texte.includes('Intermédiaire : LFTW') && l[1].texte.includes('Intermédiaire : LFMV')
    && l[1].texte.includes('Corrigé : date inconnue'), `sans « Modifié le » : date inconnue, en bas : « ${l[1].texte} »`);
  verifier(JSON.stringify(await tabs(A.p)) === '["Corrigées (2)","Ignorées (0)"]', 'onglet « Corrigées (2) »');
  const fait = await reg(A.p, 'rattrapageCorrections');
  verifier(fait && fait.n === 3, 'rattrapage noté comme fait (il suit la synchro)');
  res = await lancer(); l = await lignes(A.p);
  verifier(res.startsWith('0 correction retrouvée') && l.length === 2, `relance : « ${res} », toujours 2 lignes (aucun doublon)`);
  const stock = JSON.stringify(await reg(A.p, 'anomaliesCorrigees'));
  verifier(!/DATE|AIRCRAFT|ROUTE/.test(stock) && stock.length < 2000, `seules les lignes « Corrigées » sont gardées (${stock.length} caractères), pas le fichier`);
  let apres = await etatCarnet(A.p);
  verifier(apres.vols === avant.vols && apres.totaux === avant.totaux && apres.csv === avant.csv && apres.pdf === avant.pdf, 'rattrapage : aucun vol modifié (ni « Modifié le »), totaux, CSV et PDF identiques');
  await A.p.click('#ou-x'); await onglet(A.p, 'plus');
  verifier(await badge(A.p) === '2', 'badge PLUS : 2');

  console.log('Appui sur une ligne : le vol s\'ouvre');
  await A.p.click('#pl-anom'); await A.p.waitForSelector('#at-l'); await A.p.click(`#at-l .lv[data-vol="${v1.id}"]`); await A.p.waitForSelector('#v-saisie:not([hidden])');
  verifier(await A.p.inputValue('#f-date') !== '' && await A.p.evaluate(() => document.querySelector('#f-dep').value) === 'LFTW' && await A.p.isHidden('#outil'), 'le vol du 13/06/2026 s\'ouvre');
  await A.p.click('#cancel'); await A.p.waitForSelector('#at-l');
  verifier(await A.p.isVisible('#at-l'), 'en le fermant : retour à « Anomalies traitées »');
  await A.p.click('#ou-x');

  console.log('Vol avec « ! » corrigé dans la nouvelle version ; vol sans « ! » modifié');
  const v3 = await volDu(A.p, '2026-08-01'), v4 = await volDu(A.p, '2026-09-09');
  const ouvrir = async id => { await onglet(A.p, 'carnet'); await A.p.click(`.flight[data-id="${id}"] .fl-route`); await A.p.waitForSelector('#v-saisie:not([hidden])'); };
  await ouvrir(v4.id); await A.p.click('#f-edit'); await A.p.fill('#f-rem', 'REMARQUE INVENTEE'); await A.p.click('#save'); await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(300);
  verifier((await reg(A.p, 'anomaliesCorrigees')).length === 2, 'vol sans « ! » modifié : aucune ligne');
  await ouvrir(v3.id);
  verifier(await A.p.isVisible('#an-cadre'), 'vol du 01/08 : cadre « Anomalie détectée »');
  await A.p.click('#f-edit'); await A.p.fill('#c-fn', '1h00'); await A.p.click('#save'); await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(300);
  verifier(await A.p.isHidden('#tv-modal'), 'pas d\'alerte « Temps de vol modifié »');
  await ouvrirAT(A.p); l = await lignes(A.p);
  verifier(l[0].vol === v3.id && l[0].texte.includes('Temps des fonctions différent du temps de vol') && l[0].barre[0][0] === 'CdB : 0h40' && l[0].vert[0][0] === 'CdB : 1h00'
    && l[0].texte.includes(`Corrigé le ${jourFr()}`), `nouvelle ligne en haut : « ${l[0].texte} »`);
  await A.p.click('#ou-x');

  console.log('Ignorer / Ne plus ignorer');
  const v5 = await volDu(A.p, '2026-09-20');
  await ouvrir(v5.id); await A.p.click('#an-ign'); await A.p.waitForTimeout(200); await A.p.click('#cancel'); await A.p.waitForSelector('#v-carnet:not([hidden])');
  await ouvrirAT(A.p); await choisir(A.p, 'i'); l = await lignes(A.p);
  verifier(l.length === 1 && l[0].vol === v5.id && l[0].texte.includes('Terrain intermédiaire, 0 att.') && l[0].texte.includes(`Ignoré le ${jourFr()}`) && l[0].texte.includes('Ne plus ignorer'),
    `ligne dans « Ignorées » : « ${l[0] && l[0].texte} »`);
  verifier(JSON.stringify(await tabs(A.p)) === '["Corrigées (3)","Ignorées (1)"]', 'onglets « Corrigées (3) » / « Ignorées (1) »');
  await A.p.click('#ou-x'); await onglet(A.p, 'plus');
  verifier(await badge(A.p) === '4', 'badge PLUS : 4 vols');
  await A.p.click('#pl-anom'); await A.p.waitForSelector('#at-l');
  for (const largeur of [360, 393]) {
    await A.p.setViewportSize({ width: largeur, height: 852 }); await A.p.waitForTimeout(200);
    for (const o of ['c', 'i']) {
      await choisir(A.p, o);
      const m = await A.p.evaluate(() => ({ deborde: document.documentElement.scrollWidth > innerWidth,
        zones: [...document.querySelectorAll('.an-onglets button, #at-l .lv, #at-l .lv-btn, #at-fl')].map(e => { const r = e.getBoundingClientRect(); return [e.id || e.className, Math.round(r.width), Math.round(r.height)]; }),
        police: Math.min(...[...document.querySelectorAll('#at-l .lv *')].filter(e => e.children.length === 0 && e.textContent.trim()).map(e => parseFloat(getComputedStyle(e).fontSize))) }));
      const petites = m.zones.filter(z => z[1] < 40 || z[2] < 40);
      verifier(!m.deborde && !petites.length && m.police >= 13.5, `${largeur} px, onglet ${o === 'c' ? 'Corrigées' : 'Ignorées'} : rien ne déborde, zones d'appui ≥ 40 px (${m.zones.length}), texte ≥ ${m.police} px${petites.length ? ' — ' + JSON.stringify(petites) : ''}`);
      await A.p.screenshot({ path: join(CAPT, `v062-${o === 'c' ? 'corrigees' : 'ignorees'}-${largeur}.png`), fullPage: true });
    }
  }
  await A.p.click('#ou-x'); await onglet(A.p, 'plus'); await A.p.screenshot({ path: join(CAPT, 'v062-plus.png') }); await A.p.click('#pl-anom'); await A.p.waitForSelector('#at-l');
  await choisir(A.p, 'i');
  const m5 = (await volDu(A.p, '2026-09-20')).modifieLe;
  await A.p.click(`#at-l [data-np="${v5.id}"]`); await A.p.waitForTimeout(300);
  verifier((await lignes(A.p)).length === 0 && (await A.p.evaluate(async id => (await import('./js/ui/anomalies.js')).anomaliesDe(id).length, v5.id)) === 1, '« Ne plus ignorer » : le « ! » revient, la ligne sort de la liste');
  verifier((await volDu(A.p, '2026-09-20')).modifieLe === m5, '« Modifié le » du vol inchangé');
  await A.p.click('#ou-x'); await onglet(A.p, 'carnet');
  verifier(await A.p.isVisible(`.flight[data-id="${v5.id}"] .fl-an`), 'triangle « ! » revenu sur sa carte');
  await ouvrir(v5.id); await A.p.click('#an-ign'); await A.p.waitForTimeout(200); await A.p.click('#cancel'); await A.p.waitForSelector('#v-carnet:not([hidden])'); // ignoré de nouveau (synchro)

  console.log('Vol supprimé : sa ligne disparaît');
  const v1b = await volDu(A.p, '2026-06-13');
  await ouvrir(v1b.id); await A.p.click('#f-edit'); await A.p.click('#del'); await A.p.click('#del-yes'); await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(300);
  await ouvrirAT(A.p);
  verifier(!(await lignes(A.p)).some(x => x.vol === v1.id) && JSON.stringify(await tabs(A.p)) === '["Corrigées (2)","Ignorées (1)"]', 'ligne du vol supprimé retirée (« Corrigées (2) »)');
  await A.p.click('#ou-x');

  console.log('Synchro A -> B ; fait sur A : pas de question sur B');
  const listeA = async X => { await ouvrirAT(X.p); await choisir(X.p, 'c'); const c = (await lignes(X.p)).map(x => x.texte); await choisir(X.p, 'i'); const i = (await lignes(X.p)).map(x => x.texte); await X.p.click('#ou-x'); return JSON.stringify([c, i]); };
  const refA = await listeA(A);
  await rejoindre(A.p, 'ref'); await actualiser(A.p);
  const B = await appareil('B'); await rejoindre(B.p, 'mod');
  const refB = await listeA(B);
  verifier(refB === refA, 'B : mêmes listes « Corrigées » et « Ignorées » que A');
  await base(B.p, { sansReglages: ['questionCorrections'] }); await B.p.waitForTimeout(4000);
  verifier(await reg(B.p, 'questionCorrections') === 'a-poser' && await B.p.isHidden('#rq-modal'), 'B (carnet avec des vols FlyLog, nouvelle version) : pas de question, déjà fait sur A');
  // ligne ajoutée sur chaque appareil avant la synchro : les deux gardées
  await A.ctx.setOffline(true);
  const ajouter = (X, id) => X.p.evaluate(async id => { const e = await import('./js/etat.js'), t = await import('./js/anomalies-traitees.js'), v = e.etat.vols[0];
    await e.enregistrerReglage('anomaliesCorrigees', t.ajouterCorrigees(e.reglage('anomaliesCorrigees'), [{ id, volId: v.id, le: new Date().toISOString(), origine: 'saisie', l: [{ cle: 'b', avant: ['Att. nuit : 0'], apres: ['Att. nuit : 1'] }] }])); }, id);
  await ajouter(A, 'essai-A'); await ajouter(B, 'essai-B'); await actualiser(B.p); await A.ctx.setOffline(false); await actualiser(A.p); await actualiser(B.p);
  const ids = async X => (await reg(X.p, 'anomaliesCorrigees')).map(x => x.id).filter(x => x.startsWith('essai')).sort().join();
  verifier(await ids(A) === 'essai-A,essai-B' && await ids(B) === 'essai-A,essai-B', 'ligne ajoutée sur A et sur B pendant la coupure : les deux gardées partout');
  const conflits = X => X.p.evaluate(async () => ((await import('./js/etat.js')).reglage('synchroEtat')?.conflits || []).length);
  verifier(await conflits(A) === 0 && await conflits(B) === 0, 'aucun conflit à choisir');

  console.log('Sauvegarde, restauration, ancienne sauvegarde');
  const refA2 = await listeA(A);
  await onglet(A.p, 'plus'); await A.p.click('#pl-save');
  const [dl] = await Promise.all([A.p.waitForEvent('download'), A.p.click('#sv-dl')]);
  const fichierSv = join(CAPT, 'v062-sauvegarde.json'); writeFileSync(fichierSv, readFileSync(await dl.path())); await A.p.click('#ou-x'); await onglet(A.p, 'carnet');
  const C = await appareil('C');
  const restaurer = async f => { await onglet(C.p, 'plus'); await C.p.click('#pl-restore');
    const [ch] = await Promise.all([C.p.waitForEvent('filechooser'), C.p.click('#rs-fichier')]); await ch.setFiles(f); await C.p.waitForSelector('#rs-ok'); await C.p.click('#rs-ok'); await C.p.waitForTimeout(900); await onglet(C.p, 'carnet'); };
  await restaurer(fichierSv);
  verifier(await listeA(C) === refA2, 'C restauré : mêmes listes que A');
  const sv = JSON.parse(readFileSync(fichierSv, 'utf8'));
  verifier(!sv.reglages.some(r => r.cle === 'questionCorrections'), 'la question (propre à l\'appareil) n\'est pas dans la sauvegarde');
  const vieux = { ...sv, versionApp: '0.60', reglages: sv.reglages.filter(r => !['anomaliesCorrigees', 'rattrapageCorrections'].includes(r.cle)), vols: sv.vols.map(v => { const { anomaliesIgnorees, ...r } = v; return r; }) };
  const fV = join(CAPT, 'v062-ancienne-sauvegarde.json'); writeFileSync(fV, JSON.stringify(vieux));
  await restaurer(fV);
  verifier(await listeA(C) === '[[],[]]', 'ancienne sauvegarde : listes vides');
  const volsC = (await vols(C.p)).map(v => v.id + v.modifieLe + v.tempsTotal).sort().join(), volsV = vieux.vols.map(v => v.id + v.modifieLe + v.tempsTotal).sort().join();
  verifier(volsC === volsV && await reg(C.p, 'rattrapageCorrections') === undefined, 'rien d\'autre ne change (mêmes vols)');

  console.log('Totaux, « à reporter », « ! »');
  apres = await etatCarnet(A.p);
  verifier(await nbRep(A.p) === repAvant, `vols « à reporter » inchangés (${repAvant})`);
  verifier(anomAvant === 2 && await nbAnom(A.p) === 0, `vols avec « ! » : ${anomAvant} avant, ${await nbAnom(A.p)} après (l'un corrigé, l'autre ignoré : ni la liste ni le rattrapage n'en changent le nombre)`);
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur (ni vrai NAS, ni VPS, ni Google)' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.62 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); faux.closeAllConnections?.(); faux.close(); srv.fermer();
}

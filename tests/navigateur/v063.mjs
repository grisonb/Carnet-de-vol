// v0.63 : R157 toutes les modifications des vols dans « Anomalies traitées » (onglet « Modifiés » ; « Corrigées » avec tous les champs
// changés ; enregistrement sans changement : rien ; retour à l'origine : carte retirée ; deux modifications : une carte ; vol créé dans
// l'app : seulement après sa première modification ; rond, « Ignorer », trace : rien ; question du premier lancement, « Plus tard »,
// rattrapage avec un FAUX fichier FlyLog (cartes « Corrigées » de la v0.62 complétées sans doublon, relance sans doublon) ; fait sur A :
// pas de question sur B ; synchro A -> B, sauvegarde, ancienne sauvegarde ; badge ; 360 / 393 px ; PDF, CSV, totaux inchangés).
// Carnet INVENTÉ, FAUX NAS v5, aucun serveur extérieur. Usage : node tests/navigateur/v063.mjs
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
  L('2026-06-13', 'LFTW|LFML|LFTW'),                                         // 1 : 0 att. corrigé en v0.62 (carte « Corrigées »), approches aussi
  L('2026-07-01', 'LFTW|LFTW'),                                              // 2 : remarque changée avant la mise à jour (« Modifiés »)
  L('2026-08-01', 'LFTW|LFTW', { DURATION_PIC: '0:40' }),                     // 3 : fonctions, corrigé dans la nouvelle version
  L('2026-09-09', 'LFTW|LFTW', { APPROACH_NR: '1' }),                        // 4 : approches changées puis remises
  L('2026-09-20', 'LFTW|LFTW'),                                              // 5 : rond, trace : rien
  L('2026-10-02', 'LFTW|LFMN|LFTW'),                                         // 6 : 0 att. ignoré : rien dans « Modifiés »
  L('2026-10-05', 'LFTW|LFTW'),                                              // 7 : enregistré sans rien changer : rien
];
const FICHIER = join(CAPT, 'v063-faux-flylog.csv');
writeFileSync(FICHIER, fauxFlyLog(LIGNES));

// ---------- Faux NAS v5 (synchro + vols NPF) ----------
const srv = await serveur();
const nas = { mdp: 'mot-de-passe-essai-63', rev: 0, el: new Map(), npf: new Map() };
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
const choisir = async (p, quel) => { await p.click({ c: '#at-c', m: '#at-m', i: '#at-i' }[quel]); await p.waitForTimeout(150); };
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


const cartes = async (p, o) => { await choisir(p, o); return lignes(p); };
const ouvrir = async (p, id) => { await onglet(p, 'carnet'); await p.click(`.flight[data-id="${id}"] .fl-route`); await p.waitForSelector('#v-saisie:not([hidden])'); };
const enregistrerFiche = async p => { await p.click('#save'); await p.waitForSelector('#v-carnet:not([hidden])'); await p.waitForTimeout(300); };
const appr = async (p, n) => { for (let i = 0; i < Math.abs(n); i++) await p.click(`[data-s="approches"][data-d="${n > 0 ? 1 : -1}"]`); };
const resume = c => c.map(x => `${x.vol}|${x.barre.map(b => b[0]).join('/')}>${x.vert.map(v => v[0]).join('/')}`).join(' ; ');

try {
  const A = await appareil('A');
  const version = await A.p.evaluate(async () => (await import('./js/version.js')).VERSION);
  verifier(Number(version.split('.')[1]) >= 63, `version ${version} (0.63 ou suivante)`);
  await onglet(A.p, 'plus'); await A.p.setInputFiles('#file-flylog', FICHIER); await A.p.waitForSelector('#im-ok'); await A.p.click('#im-ok'); await A.p.waitForSelector('.ctab'); await A.p.click('#ou-x');
  const V = {};
  for (const [k, d] of Object.entries({ 1: '2026-06-13', 2: '2026-07-01', 3: '2026-08-01', 4: '2026-09-09', 5: '2026-09-20', 6: '2026-10-02', 7: '2026-10-05' })) V[k] = await volDu(A.p, d);
  // état d'un téléphone en v0.62 : vol 1 corrigé (et ses approches), carte « Corrigées » de la v0.62 ; vol 2 modifié ; rattrapage v0.62 fait
  const carte062 = [{ id: `fl|${V[1].id}|a|LFML`, volId: V[1].id, le: '2026-11-20T08:00:00.000Z', origine: 'flylog', l: [{ cle: 'a|LFML', avant: ['LFML : 0 att.'], apres: ['LFML : 1 att.'] }] }];
  await A.p.evaluate(async c => { const e = await import('./js/etat.js'); await e.enregistrerReglage('anomaliesCorrigees', c); await e.enregistrerReglage('rattrapageCorrections', { le: '2026-11-20T08:00:00.000Z', n: 1 }); }, carte062);
  await base(A.p, { mettre: [{ ...V[1], escales: [{ ...V[1].escales[0], attJour: 1 }], attJour: 1, approches: 2, modifieLe: '2026-11-20T08:00:00.000Z' },
    { ...V[2], remarques: 'AVANT MAJ', modifieLe: '2026-11-21T08:00:00.000Z' }], sansReglages: ['questionModifications'] });

  console.log('Premier lancement de la nouvelle version : une seule question, « Plus tard »');
  await A.p.waitForSelector('#rq-modal:not([hidden])', { timeout: 8000 });
  verifier(await A.p.textContent('#rq-txt') === 'Compléter avec toutes les modifications déjà faites ?' && await A.p.textContent('#rq-oui') === 'Choisir le fichier FlyLog d\'origine' && await A.p.textContent('#rq-non') === 'Plus tard',
    'question « Compléter avec toutes les modifications déjà faites ? » / « Choisir le fichier FlyLog d\'origine » / « Plus tard » (rattrapage v0.62 déjà fait : posée quand même, une fois)');
  await A.p.screenshot({ path: join(CAPT, 'v063-question.png') });
  await A.p.click('#rq-non'); await A.p.reload(); await A.p.waitForSelector('body[data-pret="1"]'); await A.p.waitForTimeout(3500);
  verifier(await A.p.isHidden('#rq-modal'), '« Plus tard » : la question ne revient pas');
  await ouvrirAT(A.p);
  verifier(JSON.stringify(await tabs(A.p)) === '["Corrigées (1)","Modifiés (0)","Ignorées (0)"]' && await A.p.textContent('#at-fl') === 'Retrouver les modifications dans FlyLog',
    'trois onglets « Corrigées (1) », « Modifiés (0) », « Ignorées (0) » ; bouton « Retrouver les modifications dans FlyLog » en bas');
  let l = await cartes(A.p, 'c');
  verifier(l.length === 1 && resume(l) === `${V[1].id}|LFML : 0 att.>LFML : 1 att.`, `carte de la v0.62 gardée telle quelle : ${resume(l)}`);
  await A.p.click('#ou-x');

  console.log('Enregistrer sans rien changer : rien');
  await ouvrir(A.p, V[7].id); await A.p.click('#f-edit'); await enregistrerFiche(A.p);
  await ouvrir(A.p, V[5].id); await A.p.click('#f-edit'); await A.p.fill('#f-rem', ''); await enregistrerFiche(A.p);
  verifier(!Object.keys(await A.p.evaluate(async () => (await import('./js/etat.js')).etat.reglages)).some(k => k.startsWith('suivi-')), 'vol FlyLog ouvert puis enregistré sans changement : aucun suivi, aucune carte');

  console.log('Vol avec « ! » corrigé en changeant aussi les approches et la remarque');
  await ouvrir(A.p, V[3].id); await A.p.click('#f-edit'); await A.p.fill('#c-fn', '1h00'); await appr(A.p, 2); await A.p.fill('#f-rem', 'Entraînement'); await enregistrerFiche(A.p);
  await ouvrirAT(A.p); l = await cartes(A.p, 'c');
  verifier(l[0].vol === V[3].id && l[0].texte.includes('Temps des fonctions différent du temps de vol') && resume([l[0]]) === `${V[3].id}|Temps CdB : 0h40/Approches : 0/Remarque : (vide)>Temps CdB : 1h00/Approches : 2/Remarque : «\u00a0Entraînement\u00a0»`,
    `carte « Corrigées » avec les 3 champs : « ${l[0].texte} »`);
  verifier(l[0].barre.every(b => b[1] === 'line-through' && /^rgb\(179, 38, 30\)/.test(b[2])) && l[0].vert.every(v => v[1] === 'rgb(46, 125, 50)'), 'anciennes valeurs barrées en rouge, nouvelles en vert');
  verifier((await cartes(A.p, 'm')).length === 0, 'vol corrigé : pas aussi dans « Modifiés »');
  await A.p.click('#ou-x');

  console.log('Vol sans anomalie : approches changées, deux fois, puis remises');
  await ouvrir(A.p, V[4].id); await A.p.click('#f-edit'); await appr(A.p, 2); await enregistrerFiche(A.p);
  await ouvrirAT(A.p); l = await cartes(A.p, 'm');
  verifier(l.length === 1 && resume(l) === `${V[4].id}|Approches : 1>Approches : 3` && l[0].texte.includes(`Modifié le ${jourFr()}`), `carte « Modifiés » : « ${l[0] && l[0].texte} »`);
  await A.p.click('#ou-x');
  await ouvrir(A.p, V[4].id); await A.p.click('#f-edit'); await appr(A.p, 1); await enregistrerFiche(A.p);
  await ouvrirAT(A.p); l = await cartes(A.p, 'm');
  verifier(l.length === 1 && resume(l) === `${V[4].id}|Approches : 1>Approches : 4`, 'deux modifications : une seule carte, valeur d\'origine -> valeur actuelle');
  await A.p.click(`#at-l .lv[data-vol="${V[4].id}"]`); await A.p.waitForSelector('#v-saisie:not([hidden])');
  verifier(await A.p.textContent('#s-approches') === '4', 'appui sur la carte : le vol s\'ouvre');
  await A.p.click('#f-edit'); await appr(A.p, -3); await enregistrerFiche(A.p).catch(() => {}); await A.p.waitForSelector('#at-l');
  verifier((await cartes(A.p, 'm')).length === 0, 'approches remises à la valeur d\'origine : carte retirée');
  await A.p.click('#ou-x');

  console.log('Rond, « Ignorer », trace : rien ; vol créé dans l\'app : seulement après sa première modification');
  await onglet(A.p, 'carnet'); await A.p.locator(`.flight[data-id="${V[5].id}"] .fl-rep`).click(); await A.p.waitForTimeout(200);
  await ouvrir(A.p, V[6].id); await A.p.click('#an-ign'); await A.p.waitForTimeout(200); await A.p.click('#cancel'); await A.p.waitForSelector('#v-carnet:not([hidden])');
  await A.p.evaluate(async id => { const e = await import('./js/etat.js'), v = e.etat.vols.find(x => x.id === id); await e.enregistrerVol({ ...v, traceImportee: { nom: 'essai.gpx', format: 'gpx', n: 2, nOrigine: 2, t0: 0, pts: '' } }, { garderDate: true }); }, V[5].id);
  await A.p.click('#fab'); await A.p.waitForSelector('#v-saisie:not([hidden])'); await A.p.click('#tz-utc'); await A.p.fill('#f-t0', ''); await A.p.type('#f-t0', '1400'); await A.p.type('#f-t1', '1500'); await enregistrerFiche(A.p);
  const cree = (await vols(A.p)).find(v => v.source === 'saisie');
  await ouvrirAT(A.p);
  verifier((await cartes(A.p, 'm')).length === 0 && (await cartes(A.p, 'i')).length === 1, 'rond, « Ignorer » (onglet « Ignorées »), trace, vol créé : aucune carte « Modifiés »');
  await A.p.click('#ou-x');
  await ouvrir(A.p, cree.id); await A.p.click('#f-edit'); await appr(A.p, 1); await enregistrerFiche(A.p);
  await ouvrirAT(A.p); l = await cartes(A.p, 'm');
  verifier(l.length === 1 && resume(l) === `${cree.id}|Approches : 0>Approches : 1`, 'vol créé dans l\'app puis modifié : présent');
  await A.p.click('#ou-x');

  console.log('Rattrapage avec le faux fichier FlyLog');
  const avantR = await etatCarnet(A.p), anR = await nbAnom(A.p), repR = await nbRep(A.p);
  const lancer = async () => { if (await A.p.isVisible('#outil')) await A.p.click('#ou-x'); await ouvrirAT(A.p); const [ch] = await Promise.all([A.p.waitForEvent('filechooser'), A.p.click('#at-fl')]); await ch.setFiles(FICHIER); await A.p.waitForSelector('#at-res'); return A.p.textContent('#at-res'); };
  let res = await lancer();
  verifier(res === '3 vols modifiés retrouvés', `« ${res} » (vols 1, 2 et 3 ; le vol 4 est revenu à l'origine, le vol créé n'est pas dans FlyLog)`);
  const c1 = await cartes(A.p, 'c');
  const k1 = c1.find(x => x.vol === V[1].id);
  verifier(k1 && resume([k1]) === `${V[1].id}|LFML : 0 att./Approches : 0/Att. jour : 2>LFML : 1 att./Approches : 2/Att. jour : 1` && (k1.texte.match(/Terrain intermédiaire/g) || []).length === 1,
    `carte « Corrigées » de la v0.62 complétée avec tous les champs, sans doublon : ${resume([k1])}`);
  const m1 = await cartes(A.p, 'm');
  verifier(m1.some(x => resume([x]) === `${V[2].id}|Remarque : (vide)>Remarque : «\u00a0AVANT MAJ\u00a0»` && x.texte.includes('Modifié le 21/11/2026')), `« Modifiés » rempli : vol 2 (« Modifié le 21/11/2026 »)`);
  const tabs1 = JSON.stringify(await tabs(A.p));
  res = await lancer();
  verifier(res === '3 vols modifiés retrouvés' && JSON.stringify(await tabs(A.p)) === tabs1 && (await reg(A.p, 'anomaliesCorrigees')).length === 2, `relance : mêmes cartes, rien en double (${tabs1})`);
  let apres = await etatCarnet(A.p);
  verifier(apres.vols === avantR.vols && apres.totaux === avantR.totaux && apres.csv === avantR.csv && apres.pdf === avantR.pdf && await nbAnom(A.p) === anR && await nbRep(A.p) === repR,
    'rattrapage : aucun vol modifié (ni « Modifié le »), totaux, CSV, PDF, vols « ! » et « à reporter » identiques');
  await A.p.click('#ou-x'); await onglet(A.p, 'plus');
  const nb = JSON.parse(tabs1).reduce((s, t) => s + Number(t.match(/\((\d+)\)/)[1]), 0);
  verifier(await badge(A.p) === String(nb), `badge PLUS = vols des trois onglets (${nb})`);

  console.log('360 et 393 px');
  await A.p.click('#pl-anom'); await A.p.waitForSelector('#at-l');
  for (const largeur of [360, 393]) {
    await A.p.setViewportSize({ width: largeur, height: 852 }); await A.p.waitForTimeout(200);
    for (const o of ['c', 'm', 'i']) {
      await choisir(A.p, o);
      const m = await A.p.evaluate(() => ({ deborde: document.documentElement.scrollWidth > innerWidth,
        zones: [...document.querySelectorAll('.an-onglets button, #at-l .lv, #at-l .lv-btn, #at-fl')].map(e => { const r = e.getBoundingClientRect(); return [e.id || e.className, Math.round(r.width), Math.round(r.height)]; }),
        coupe: [...document.querySelectorAll('.an-onglets button')].some(b => b.scrollWidth > b.clientWidth + 1),
        police: Math.min(...[...document.querySelectorAll('#at-l .lv *, .an-onglets button')].filter(e => e.children.length === 0 && e.textContent.trim()).map(e => parseFloat(getComputedStyle(e).fontSize))) }));
      const petites = m.zones.filter(z => z[1] < 40 || z[2] < 40);
      verifier(!m.deborde && !m.coupe && !petites.length && m.police >= 13.5, `${largeur} px, onglet ${{ c: 'Corrigées', m: 'Modifiés', i: 'Ignorées' }[o]} : rien ne déborde ni n'est coupé, zones d'appui ≥ 40 px (${m.zones.length}), texte ≥ ${m.police} px${petites.length ? ' — ' + JSON.stringify(petites) : ''}`);
      await A.p.screenshot({ path: join(CAPT, `v063-${o}-${largeur}.png`), fullPage: true });
    }
  }
  await A.p.click('#ou-x');

  console.log('Synchro A -> B ; fait sur A : pas de question sur B');
  const listes = async X => { await ouvrirAT(X.p); const r = []; for (const o of ['c', 'm', 'i']) r.push((await cartes(X.p, o)).map(x => x.texte)); await X.p.click('#ou-x'); return JSON.stringify(r); };
  const refA = await listes(A);
  await rejoindre(A.p, 'ref'); await actualiser(A.p);
  const B = await appareil('B'); await rejoindre(B.p, 'mod');
  verifier(await listes(B) === refA, 'B : mêmes cartes dans les trois onglets');
  await base(B.p, { sansReglages: ['questionModifications'] }); await B.p.waitForTimeout(4000);
  verifier(await reg(B.p, 'questionModifications') === 'a-poser' && await B.p.isHidden('#rq-modal'), 'B (vols FlyLog, nouvelle version) : pas de question, déjà fait sur A');
  // modification sur B : arrive sur A
  await ouvrir(B.p, V[7].id); await B.p.click('#f-edit'); await appr(B.p, 1); await enregistrerFiche(B.p); await actualiser(B.p); await actualiser(A.p);
  await ouvrirAT(A.p);
  verifier((await cartes(A.p, 'm')).some(x => x.vol === V[7].id && x.vert[0][0] === 'Approches : 1'), 'vol modifié sur B : sa carte arrive sur A');
  await A.p.click('#ou-x');

  console.log('Sauvegarde, restauration, ancienne sauvegarde');
  const refA2 = await listes(A);
  await onglet(A.p, 'plus'); await A.p.click('#pl-save');
  const [dl] = await Promise.all([A.p.waitForEvent('download'), A.p.click('#sv-dl')]);
  const fichierSv = join(CAPT, 'v063-sauvegarde.json'); writeFileSync(fichierSv, readFileSync(await dl.path())); await A.p.click('#ou-x'); await onglet(A.p, 'carnet');
  const C = await appareil('C');
  const restaurer = async f => { await onglet(C.p, 'plus'); await C.p.click('#pl-restore');
    const [ch] = await Promise.all([C.p.waitForEvent('filechooser'), C.p.click('#rs-fichier')]); await ch.setFiles(f); await C.p.waitForSelector('#rs-ok'); await C.p.click('#rs-ok'); await C.p.waitForTimeout(900); await onglet(C.p, 'carnet'); };
  await restaurer(fichierSv);
  verifier(await listes(C) === refA2, 'C restauré : mêmes cartes que A');
  const sv = JSON.parse(readFileSync(fichierSv, 'utf8'));
  const vieux = { ...sv, versionApp: '0.61', reglages: sv.reglages.filter(r => !r.cle.startsWith('suivi-') && !['anomaliesCorrigees', 'rattrapageCorrections', 'rattrapageModifications'].includes(r.cle)) };
  const fV = join(CAPT, 'v063-ancienne-sauvegarde.json'); writeFileSync(fV, JSON.stringify(vieux));
  await restaurer(fV);
  const lv = JSON.parse(await listes(C));
  verifier(lv[0].length === 0 && lv[1].length === 0 && lv[2].length === 1, 'ancienne sauvegarde : « Corrigées » et « Modifiés » vides, l\'écran s\'ouvre (rien de cassé)');
  verifier((await vols(C.p)).length === sv.vols.length && JSON.stringify(await etatCarnet(C.p).then(e => e.totaux)) === JSON.stringify((await etatCarnet(A.p)).totaux), 'mêmes vols, mêmes totaux');

  console.log('Accueil, « à reporter », « ! »');
  const t0 = Date.now(); await A.p.evaluate(async () => { const e = await import('./js/etat.js'), l = []; for (let i = 0; i < 1500; i++) l.push({ cle: `suivi-essai${i}`, valeur: { o: { approches: '0' }, le: null } }); await e.enregistrerReglages(l); });
  const ms = await A.p.evaluate(async () => { const t = performance.now(); (await import('./js/ui/carnet.js')).rafraichirCarnet(); await new Promise(r => requestAnimationFrame(() => r())); return performance.now() - t; });
  const msPlus = await A.p.evaluate(async () => { const t = performance.now(); (await import('./js/ui/anomalies-traitees.js')).majBadgeAnomalies(); return performance.now() - t; });
  verifier(ms < 400 && msPlus < 300, `1 500 suivis en plus : accueil redessiné en ${Math.round(ms)} ms, badge PLUS en ${Math.round(msPlus)} ms`);
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur (ni vrai NAS, ni VPS, ni Google)' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.63 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); faux.closeAllConnections?.(); faux.close(); srv.fermer();
}

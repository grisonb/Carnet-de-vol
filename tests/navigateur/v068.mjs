// v0.68 : R166 frais d'escale (barème inventé : vol journée 87,00 ; France, Espagne, Portugal 174,00 Euro-Europe ; Canada 203,75 Monde ;
// pays sans montant) : vol journée, J+2 (paire, incomplet), détachements Euro (nuits modifiables, vols cochés tout seuls, comptés une
// fois) et Monde, montant manquant, une seule case à la fois, liste et total par année (1er janvier), PDF (résumé, ordre
// chronologique, vols, Dash en dixièmes), synchro A -> B, sauvegarde, ancienne sauvegarde, 360 / 393 px ; PDF EASA, CSV, totaux,
// « Modifié le » inchangés, pas d'alerte R150 ni de ligne « Anomalies traitées ». Carnet INVENTÉ, FAUX NAS v5. Usage : node tests/navigateur/v068.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2026-10-01T08:00:00Z';
const AVIONS = [{ id: 'a1', immat: 'F-XZZA', typeOACI: 'DH8D', modele: 'Dash 8 Q400 MR', constructeur: 'ESSAI', nom: '', indicatif: '', equipage: 'MP', moteurs: 'ME', moteur: 'T',
  surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', hexAdsb: '', creeLe: H, modifieLe: H }];
const C0 = { largCdbDash: 0, largInstrCdbDash: 0, largCopiDash: 0, largCopiCL: 0, ecopages: 0, amerrCL: 0, amerrSEP: 0, largPara: 0 };
const vol = (id, date, champs = {}) => ({ id, date, hDep: '09:00', hArr: '10:24', mode: 'utc', dep: 'LFTW', arr: 'LFTW', escales: [], avionId: 'a1', tempsTotal: 84, tempsMP: null,
  tempsSE: null, tempsME: null, tempsCdB: 84, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: '', nomInstructeur: '', nomExaminateur: '', missions: [], remarques: '', feux: 0,
  compteurs: { ...C0 }, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie', ordre: Date.parse(`${date}T09:00Z`),
  creeLe: H, modifieLe: H, ...champs });
const VOLS = [vol('j14', '2026-06-14', { escales: [{ code: 'LFML', attJour: 1, attNuit: 0 }], attJour: 2 }), vol('j2a', '2026-06-02', { arr: 'LFMN' }), vol('j2b', '2026-06-03', { dep: 'LFMN' }),
  vol('j2s', '2026-06-20'), vol('de06', '2026-07-06', { arr: 'LEMD' }), vol('de09', '2026-07-09', { dep: 'LEMD' }), vol('ca', '2026-08-01', { arr: 'CYUL' }), vol('ma', '2026-09-01', { arr: 'GMMN' }), // v0.70 (R178) : nuit = pays du dernier atterrissage
  vol('an20', '2025-12-20'), vol('an30', '2025-12-30')];

// ---------- Faux NAS v5 (synchro + vols NPF) ----------
const srv = await serveur({ dixiemesDefaut: null }); // départ de l'app : DH8D et CL2T allumés
const nas = { mdp: 'mot-de-passe-essai-68', rev: 0, el: new Map(), npf: new Map() };
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
const fini = (p, sel) => p.waitForFunction(s => { const e = document.querySelector(s); return e && e.textContent.trim() && !/en cours|Envoi :|Réception :|prêt \?/.test(e.textContent); }, sel, { timeout: 60000 });
async function rejoindre(p, role) {
  await onglet(p, 'plus'); await p.click('#pl-sync'); await p.click('#sy-nas'); await p.fill('#nas-adr', ADRESSE_NAS); await p.fill('#nas-mdp', nas.mdp); await p.click('#nas-ok'); await p.waitForTimeout(400); await p.click('#ou-x');
  await p.click('#pl-sync');
  if (role === 'ref') { await p.click('#sy-ref'); await p.click('#sr-ok'); await fini(p, '#sr-res'); } else { await p.click('#sy-mod'); await p.click('#sc-ok'); await fini(p, '#sc-res'); }
  await p.click('#ou-x'); await onglet(p, 'carnet');
}
const actualiser = async p => { await onglet(p, 'carnet'); await p.click('#rafraichir'); await p.waitForFunction(() => !document.getElementById('rafraichir').classList.contains('tourne'), null, { timeout: 30000 }); await p.waitForTimeout(400); };
const onglet = (p, v) => p.click(`.tabs button[data-v="${v}"]`);
const volDe = (p, id) => p.evaluate(async id => (await import('./js/etat.js')).etat.vols.find(v => v.id === id), id);
const remplir = async (p, vols) => {
  await p.evaluate(async ([avs, vs]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols'], 'readwrite'); for (const a of avs) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVIONS, vols]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
};
const ouvrir = async (p, id) => { await onglet(p, 'carnet'); await p.click(`.flight[data-id="${id}"] .fl-route`); await p.waitForSelector('#v-saisie:not([hidden])'); };
const fermer = async p => { await p.click('#cancel'); await p.waitForSelector('#v-carnet:not([hidden])'); };
const cases = p => p.$$eval('#fe-zone [data-fe]', l => Object.fromEntries(l.map(b => [b.dataset.fe, b.getAttribute('aria-checked') === 'true'])));
const cocher = async (p, id, t) => { await ouvrir(p, id); await p.click(`#fe-zone [data-fe="${t}"]`); await p.waitForTimeout(250); const c = await cases(p); const info = await p.textContent('#fe-info'); return { c, info }; };
const carnetEASA = p => p.evaluate(async () => { const e = await import('./js/etat.js'), t = await import('./js/totaux.js'), s = await import('./js/sauvegarde.js'), d = await import('./js/pdf.js');
  const v = [...e.etat.vols].reverse(); return JSON.stringify([t.calculerTotaux(v, e.etat.avions, '2026-12-31'), s.texteTableur(v, e.etat.avions, e.listeDesCompteurs()), d.paginer(v, e.etat.avions).map(x => [x.totalPage, x.cumul])]); });
const annee = async (p, a) => { await onglet(p, 'plus'); await p.click('#pl-frais'); await p.waitForSelector('#fr-l'); await p.click(`#fr-l [data-an="${a}"]`); await p.waitForSelector('#fa-l'); };
const lignes = p => p.$$eval('#fa-l .lv', l => l.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
const total = p => p.textContent('#fa-tot').then(t => t.replace(/\s/g, ' ').replace(/ /g, ' '));
async function bareme(p, journee, pays) {
  if (await p.isHidden('#fb-plie')) await p.click('#fb-plier'); // v0.70 (R171) : liste des pays repliée
  await p.fill('#fb-j', journee);
  const rows = await p.$$('#fb-pays .fb-row');
  for (let i = 0; i < pays.length; i++) {
    if (i >= rows.length) await p.click('#fb-add');
    const r = p.locator('#fb-pays .fb-row').nth(i);
    if (i > 0) await r.locator('.fb-nom').fill(pays[i][0]);
    await r.locator('.fb-m').fill(pays[i][1]);
    if (await r.locator('select.fb-z').count()) await r.locator('.fb-z').selectOption(pays[i][2]); // v0.69 : ligne du bulletin : zone du bulletin
  }
  await p.click('#fb-ok'); await p.waitForTimeout(300);
}
const detachement = async (p, du, au, pays, nuits = {}) => {
  await p.fill('#dt-du', du); await p.dispatchEvent('#dt-du', 'change'); await p.fill('#dt-au', au); await p.dispatchEvent('#dt-au', 'change');
  // v0.69 (R169) : le pays se tape (liste du barème, recherche par les premières lettres)
  await p.fill('#dt-pays', pays); await p.dispatchEvent('#dt-pays', 'change'); await p.waitForTimeout(100);
  for (const [d, x] of Object.entries(nuits)) { await p.fill(`#dt-nuits [data-nuit="${d}"]`, x); await p.dispatchEvent(`#dt-nuits [data-nuit="${d}"]`, 'change'); }
  await p.waitForTimeout(100);
  return { montant: await p.textContent('#dt-montant'), calc: await p.textContent('#dt-calc'), vols: await p.textContent('#dt-vols'),
    modifiees: await p.$$eval('#dt-nuits .dt-nuit.modifie', l => l.length) };
};

try {
  const A = await appareil('A'); await remplir(A.p, VOLS);
  const p = A.p, easa0 = await carnetEASA(p), modifs0 = JSON.stringify(VOLS.map(v => v.modifieLe));

  console.log('Plus › Frais d\'escale ; fiche du vol');
  await onglet(p, 'plus');
  verifier(await p.isVisible('#pl-frais') && (await p.textContent('#pl-frais b')) === 'Frais d\'escale', 'ligne « Frais d\'escale » dans le menu Plus');
  await ouvrir(p, 'j14');
  const ordre = await p.evaluate(() => { const z = document.getElementById('fe-zone'), r = document.getElementById('rules-open2'), t = document.querySelector('#v-saisie .c-tp');
    return !!(r.compareDocumentPosition(z) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(z.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING); });
  verifier(ordre && JSON.stringify(await p.$$eval('#fe-zone [data-fe]', l => l.map(b => b.textContent))) === '["VOL JOURNÉE","DÉTACHEMENT","J.1","J.2"]', 'zone « FRAIS D\'ESCALE » entre « Règles des pastilles » et « Temps du carnet » : VOL JOURNÉE, DÉTACHEMENT, J.1, J.2');
  for (const largeur of [360, 393]) {
    await p.setViewportSize({ width: largeur, height: 852 }); await p.waitForTimeout(150);
    await p.locator('#fe-zone').scrollIntoViewIfNeeded();
    const m = await p.evaluate(() => ({ deborde: document.documentElement.scrollWidth > innerWidth, h: [...document.querySelectorAll('#fe-zone [data-fe]')].map(b => Math.round(b.getBoundingClientRect().height)) }));
    verifier(!m.deborde && m.h.every(h => h >= 40), `${largeur} px : rien ne déborde, cases de ${m.h.join(' / ')} px`);
  }
  await p.screenshot({ path: join(CAPT, 'v068-fiche.png') });
  await fermer(p);

  console.log('Vol journée (en lecture, sans « Modifié le »)');
  let r = await cocher(p, 'j14', 'journee');
  verifier(r.c.journee && !r.c.j2 && !r.c.detachement && r.info.includes('montant à saisir'), `case cochée (vol en lecture) ; « ${r.info} »`);
  verifier(await p.isHidden('#tv-modal') && (await volDe(p, 'j14')).modifieLe === H && (await volDe(p, 'j14')).frais.type === 'journee', 'pas d\'alerte R150, « Modifié le » inchangé');
  await fermer(p);

  console.log('Barème 2026');
  await annee(p, '2026');
  verifier(await p.inputValue('#fb-pays .fb-row:first-child .fb-nom') === 'France', 'France présente d\'office (Euro-Europe)');
  await bareme(p, '87', [['France', '174,00', 'euro'], ['Espagne', '174,00', 'euro'], ['Portugal', '174,00', 'euro'], ['Canada', '203,75', 'monde'], ['Maroc', '', 'monde']]);
  let l = await lignes(p);
  verifier(l.some(x => x.startsWith('14/06/2026 · Vol journée 87,00 €') && x.includes('LFTW → LFML → LFTW')), `vol journée : 87,00 € (${l[0]})`);
  await p.screenshot({ path: join(CAPT, 'v068-bareme.png'), fullPage: true });
  await p.click('#ou-x');

  console.log('J.1 / J.2 (v0.70)');
  r = await cocher(p, 'j2a', 'j1');
  verifier(r.c.j1 && await p.isVisible('#fe-pays-z') && await p.inputValue('#fe-pays') === 'France' && r.info === 'J.1 incomplet : coche aussi le J.2 du lendemain', `J.1 coché : « Pays de la nuit » France (LFMN) ; « ${r.info} »`);
  await fermer(p);
  r = await cocher(p, 'j2b', 'j2');
  verifier(r.c.j2 && await p.isHidden('#fe-pays-z') && r.info === 'Avec le J.1 du 02/06 : 2 jours, nuit France, 1,5 × 174,00 € = 261,00 €', `J.2 : « ${r.info} »`);
  await fermer(p);
  r = await cocher(p, 'j2s', 'j2'); await fermer(p);
  verifier(r.info === 'J.2 incomplet : coche aussi le J.1 de la veille', 'J.2 seul : incomplet');

  console.log('Une seule case à la fois');
  r = await cocher(p, 'j14', 'j2');
  verifier(r.c.j2 && !r.c.journee, 'J.2 coché : VOL JOURNÉE décoché');
  await p.click('#fe-zone [data-fe="journee"]'); await p.waitForTimeout(200);
  verifier((await cases(p)).journee && !(await cases(p)).j2, 'VOL JOURNÉE de nouveau');
  await p.click('#fe-zone [data-fe="journee"]'); await p.waitForTimeout(200);
  verifier(Object.values(await cases(p)).every(x => !x), 'aucune case cochée possible');
  await p.click('#fe-zone [data-fe="journee"]'); await p.waitForTimeout(200); await fermer(p);

  console.log('Détachement Espagne (Euro-Europe)');
  await cocher(p, 'de06', 'journee'); await fermer(p); // coché « journée » avant : jamais compté deux fois
  await ouvrir(p, 'de06'); await p.click('#fe-zone [data-fe="detachement"]'); await p.waitForSelector('#dt-modal:not([hidden])');
  const d1 = await detachement(p, '2026-07-06', '2026-07-09', 'Espagne', { '2026-07-07': 'Portugal' });
  verifier(d1.montant === '609,00 €' && d1.calc === 'Zone euro, 4 jours : 1 + 1 + 1,5 indemnité × 174,00 €' && d1.modifiees === 1 && d1.vols.includes('06/07, 09/07'),
    `4 jours, nuits Espagne (LEMD) / Portugal (à la main) / Portugal (jour sans vol) : « ${d1.calc} » = ${d1.montant} ; vols du 06 et du 09`);
  for (const largeur of [360, 393]) { await p.setViewportSize({ width: largeur, height: 852 }); await p.waitForTimeout(150);
    verifier(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${largeur} px : fenêtre « Détachement » sans débordement`); }
  await p.screenshot({ path: join(CAPT, 'v068-detachement.png') });
  await p.click('#dt-ok'); await p.waitForTimeout(300);
  verifier((await cases(p)).detachement && (await p.textContent('#fe-info')) === 'Fait partie du détachement du 06/07/2026 au 09/07/2026' && await p.isVisible('#fe-voir'), 'vol du 06 : DÉTACHEMENT coché, rappel « Fait partie du détachement… » et « Voir le détachement »');
  await fermer(p); await ouvrir(p, 'de09');
  verifier((await cases(p)).detachement, 'vol du 09 : DÉTACHEMENT coché tout seul');
  await p.click('#fe-voir'); await p.waitForSelector('#dt-modal:not([hidden])');
  verifier(await p.inputValue('#dt-du') === '2026-07-06' && await p.isVisible('#dt-del'), '« Voir le détachement » : la fenêtre s\'ouvre');
  await p.click('#dt-no'); await fermer(p);

  console.log('Détachement Canada (Monde) et pays sans montant');
  await ouvrir(p, 'ca'); await p.click('#fe-zone [data-fe="detachement"]'); await p.waitForSelector('#dt-modal:not([hidden])');
  const d2 = await detachement(p, '2026-08-01', '2026-08-03', 'Canada');
  verifier(d2.montant === '611,25 €' && d2.calc.includes('Zone Monde, 3 jours : 3 indemnités × 203,75 €'), `3 jours Monde : « ${d2.calc} » = ${d2.montant}`);
  await p.click('#dt-ok'); await p.waitForTimeout(300); await fermer(p);
  await ouvrir(p, 'ma'); await p.click('#fe-zone [data-fe="detachement"]'); await p.waitForSelector('#dt-modal:not([hidden])');
  const d3 = await detachement(p, '2026-09-01', '2026-09-02', 'Maroc');
  verifier(d3.montant === 'Montant manquant', 'pays sans montant : « Montant manquant »');
  await p.click('#dt-ok'); await p.waitForTimeout(300); await fermer(p);

  console.log('Liste et total de l\'année ; changement d\'année au 1er janvier');
  await annee(p, '2026');
  l = await lignes(p);
  verifier(l[0].startsWith('01/09/2026 · Détachement 2 jours Montant manquant') && l.some(x => x.startsWith('06/07/2026 · Détachement 4 jours 609,00 € Espagne Nuit 07/07 : Portugal Nuit 08/07 : Portugal') && x.includes('3 nuits · 2 vols'))
    && l.some(x => x.startsWith('02/06/2026 · J.1 261,00 €') && x.includes('03/06/2026 · J.2')) && l.some(x => x.startsWith('20/06/2026 · J.2 incomplet 0,00 €')) && l.filter(x => x.includes('· Vol journée')).length === 1,
    `lignes, plus récente en haut : ${l.map(x => x.split(' ').slice(0, 3).join(' ')).join(' | ')}`);
  verifier((await total(p)) === '1 568,25 €', `total 2026 : ${await total(p)} (87,00 + 261,00 + 609,00 + 611,25)`);
  for (const largeur of [360, 393]) { await p.setViewportSize({ width: largeur, height: 852 }); await p.waitForTimeout(150);
    const m = await p.evaluate(() => ({ deborde: document.documentElement.scrollWidth > innerWidth, petites: [...document.querySelectorAll('#ou-c button, #ou-c input, #ou-c select, #fa-l .lv')].filter(e => e.getBoundingClientRect().height < 40 && e.offsetParent).map(e => e.id || e.className) }));
    verifier(!m.deborde && !m.petites.length, `${largeur} px : année lisible, zones d'appui ≥ 40 px${m.petites.length ? ' — ' + m.petites.join(',') : ''}`);
    await p.screenshot({ path: join(CAPT, `v068-annee-${largeur}.png`), fullPage: true }); }
  await p.click('#fa-l [data-ligne="j2|2026-06-02"]'); await p.waitForSelector('#v-saisie:not([hidden])');
  verifier((await p.inputValue('#f-date')) === '2026-06-02', 'appui sur une ligne : le vol s\'ouvre');
  await p.click('#cancel'); await p.waitForSelector('#fa-l');
  verifier(await p.isVisible('#fa-l'), 'en le fermant : retour à l\'année');
  await p.click('#ou-x');
  await cocher(p, 'an20', 'journee'); await fermer(p);
  await ouvrir(p, 'an30'); await p.click('#fe-zone [data-fe="detachement"]'); await p.waitForSelector('#dt-modal:not([hidden])');
  await detachement(p, '2025-12-30', '2026-01-02', 'France'); await p.click('#dt-ok'); await p.waitForTimeout(300); await fermer(p);
  await annee(p, '2025'); await bareme(p, '80', [['France', '160,00', 'euro']]);
  l = await lignes(p);
  // v0.69 (R167) : détachement à cheval sur deux années : nuits du 30 et du 31 en 2025 (2 × 160,00 saisi), nuit du 01 en 2026 (1,5 × 174,00)
  verifier(l.some(x => x.startsWith('30/12/2025 · Détachement 4 jours (partie 2025) 320,00 €') && x.includes('30/12 → 31/12/2025')) && (await total(p)) === '400,00 €', 'détachement du 30/12 au 02/01 : partie 2025 = 320,00 € ; total 2025 400,00 €');
  await p.click('#fa-ret'); await p.waitForSelector('#fr-l');
  const an = await p.$$eval('#fr-l [data-an]', l => l.map(b => b.innerText.replace(/\s+/g, ' ')));
  verifier(an.length === 2 && an[0].startsWith('2026') && an[0].includes('1 829,25 €') && an[1].includes('400,00 €'), `une ligne par année : ${an.join(' | ')}`);
  await p.screenshot({ path: join(CAPT, 'v068-annees.png') });
  await p.click('#ou-x');

  console.log('PDF de l\'année');
  const m = await p.evaluate(async () => (await import('./js/ui/frais.js')).modelePdf('2026'));
  verifier(JSON.stringify(m.resume.map(x => x.join(' | ').replace(/\u202f/g, ' '))) === JSON.stringify(['Vols journée | 1 | 87,00 €', 'J.1 / J.2 | 1 | 261,00 €', 'Détachements | 4 (11 jours, 7 nuits) | 1 481,25 €', 'Total 2026 |  | 1 829,25 €']),
    `résumé : ${m.resume.map(x => x.join(' ')).join(' · ')}`);
  const titres = m.lignes.map(x => x.titre);
  verifier(titres[0] === '01/01/2026 · Détachement 4 jours (partie 2026)' && m.lignes[0].detail.includes('Suite du détachement') && titres[1] === '02/06/2026 · J.1' && titres[2] === '14/06/2026 · Vol journée' && titres[3] === '20/06/2026 · J.2 incomplet' && titres.at(-1) === '01/09/2026 · Détachement 2 jours', `ordre chronologique : ${titres.join(' | ')}`);
  const j2 = m.lignes[1];
  verifier(j2.vols.length === 2 && JSON.stringify(j2.vols[0].slice(0, 9)) === JSON.stringify(['02/06/26', 'LFTW', '09h00', 'LFMN', '10h24', 'DH8D', 'F-XZZA', '1.4', 'CdB']) && j2.jours.map(j => j.titre).join(' | ') === '02/06/2026 · J.1 | 03/06/2026 · J.2' && j2.detail === 'Nuit France · 2 vols · 1,5 indemnité × 174,00 €',
    `lignes du carnet sous chaque ligne (Dash en dixièmes : ${j2.vols[0][7]}, heures de bloc ${j2.vols[0][2]})`);
  const d4 = m.lignes.find(x => x.titre === '06/07/2026 · Détachement 4 jours');
  verifier(d4.detail === 'Nuits : 06/07 Espagne · 07/07 Portugal · 08/07 Portugal — 06/07 → 09/07/2026 · 3 nuits · 2 vols · 1 + 1 + 1,5 indemnité × 174,00 €' && d4.jours[0].etapes === 'Espagne'
    && JSON.stringify(d4.pastilles) === '["Nuit 07/07 : Portugal","Nuit 08/07 : Portugal"]', `détail : nuits et calcul (« ${d4.detail} »)`);
  const pdf = await p.evaluate(async () => { const f = await import('./js/ui/frais.js'), d = f.dessinerPdf(window.jspdf.jsPDF, f.modelePdf('2026')), s = d.output();
    return { pages: d.getNumberOfPages(), euro: s.includes('1 829,25 \x80'), resume: s.includes('(RÉSUMÉ)') || s.includes('(R\xc9SUM\xc9)'), dix: s.includes('(1.4)') }; });
  verifier(pdf.pages >= 1 && pdf.euro && pdf.dix, `PDF dessiné (${pdf.pages} page) : « 1 829,25 € », temps « 1.4 »`);
  await annee(p, '2026');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#fa-pdf')]);
  verifier(/^frais-escale-2026.*\.pdf$/.test(dl.suggestedFilename()), `« Exporter 2026 en PDF » : ${dl.suggestedFilename()}`);
  writeFileSync(join(CAPT, 'v068-frais-2026.pdf'), readFileSync(await dl.path()));
  await p.click('#ou-x');

  console.log('Carnet EASA inchangé');
  verifier(await carnetEASA(p) === easa0, 'PDF EASA, CSV et totaux d\'heures identiques');
  const etatEtat = await p.evaluate(async () => { const e = await import('./js/etat.js'); return { modif: e.etat.vols.every(v => v.modifieLe === '2026-10-01T08:00:00Z'), corrigees: (e.reglage('anomaliesCorrigees') || []).length, suivis: Object.keys(e.etat.reglages).filter(k => k.startsWith('suivi-')).length }; });
  verifier(etatEtat.modif && !etatEtat.corrigees && !etatEtat.suivis, '« Modifié le » de tous les vols inchangé, aucune ligne « Anomalies traitées »');

  console.log('Synchro A -> B, sauvegarde, ancienne sauvegarde');
  const vue = async X => { await annee(X.p, '2026'); const r = [await lignes(X.p), await total(X.p)]; await X.p.click('#ou-x'); return JSON.stringify(r); };
  const refA = await vue(A);
  await rejoindre(p, 'ref'); await actualiser(p);
  const B = await appareil('B'); await rejoindre(B.p, 'mod');
  verifier(await vue(B) === refA, 'B : mêmes lignes et même total 2026 (cases, détachements et barème reçus)');
  await ouvrir(B.p, 'de09'); verifier((await cases(B.p)).detachement, 'B : vol du 09 coché « Détachement »'); await fermer(B.p);
  const json = await p.evaluate(async () => { const e = await import('./js/etat.js'), s = await import('./js/sauvegarde.js'); return JSON.stringify(s.creerSauvegarde(await e.contenuComplet())); });
  const C = await appareil('C');
  const restaurer = async f => { await onglet(C.p, 'plus'); await C.p.click('#pl-restore');
    const [ch] = await Promise.all([C.p.waitForEvent('filechooser'), C.p.click('#rs-fichier')]); await ch.setFiles(f); await C.p.waitForSelector('#rs-ok'); await C.p.click('#rs-ok'); await C.p.waitForTimeout(900); await onglet(C.p, 'carnet'); };
  const f1 = join(CAPT, 'v068-sauvegarde.json'); writeFileSync(f1, json); await restaurer(f1);
  verifier(await vue(C) === refA, 'C restauré : mêmes lignes et même total');
  const vieux = JSON.parse(json); vieux.versionApp = '0.67'; vieux.vols = vieux.vols.map(({ frais, ...v }) => v); vieux.reglages = vieux.reglages.filter(x => !/^(detachement|bareme)-/.test(x.cle));
  const f2 = join(CAPT, 'v068-ancienne.json'); writeFileSync(f2, JSON.stringify(vieux)); await restaurer(f2);
  await onglet(C.p, 'plus'); await C.p.click('#pl-frais'); await C.p.waitForSelector('#fr-l');
  verifier((await C.p.$$('#fr-l [data-an]')).length === 0, 'ancienne sauvegarde : rien de coché, aucune année');
  await C.p.click('#ou-x'); await ouvrir(C.p, 'j14'); verifier(Object.values(await cases(C.p)).every(x => !x), 'fiche : aucune case cochée'); await fermer(C.p);

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.68 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); faux.closeAllConnections?.(); faux.close(); srv.fermer();
}

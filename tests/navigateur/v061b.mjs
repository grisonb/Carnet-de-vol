// v0.61 (suite) : R155 anomalies signalées par un triangle « ! » (une de chaque sorte a à h, cas voisins corrects ; bouton jaune
// et filtre, bascule avec « À reporter » ; cadre « Anomalie détectée », correction, « Ignorer », retour après modification ;
// synchro A -> B, sauvegarde / restauration, ancienne sauvegarde ; 360 / 393 px ; PDF, CSV, totaux ; 4 000 vols). Carnet INVENTÉ,
// FAUX NAS v5, aucun serveur extérieur.
// Usage : node tests/navigateur/v061b.mjs
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
const AV_SIM = { id: 's1', immat: 'SIM-ESSAI', typeOACI: 'SIM', modele: 'Simulateur', constructeur: 'ESSAI', nom: '', indicatif: '', equipage: null, moteurs: null, moteur: null,
  surface: 'L', train: 'tricycle', etiquettes: [], sim: true, fstd: 'FFS', photo: null, remarques: '', hexAdsb: '', creeLe: H, modifieLe: H };
const AV_B = { ...AVIONS[0], id: 'a2', immat: 'F-XZZB' };
AVIONS.push(AV_SIM, AV_B);
const base = (id, date, champs = {}) => ({ id, date, hDep: '08:00', hArr: '09:30', mode: 'utc', dep: 'LFTW', arr: 'LFTW', escales: [], avionId: 'a1', tempsTotal: 90, tempsMP: null,
  tempsSE: null, tempsME: null, tempsCdB: 90, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: '', nomInstructeur: '', nomExaminateur: '', missions: [], remarques: '', feux: 0,
  compteurs: { ...C0 }, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie', ordre: Date.parse(`${date}T08:00Z`), creeLe: H, modifieLe: H, ...champs });
// Une anomalie de chaque sorte (a à h)…
const MAUVAIS = [
  base('a', '2026-10-01', { escales: [{ code: 'LFML', attJour: 0, attNuit: 0, approches: 0 }], attJour: 2 }),
  base('b', '2026-01-10', { hDep: '16:30', hArr: '18:30', tempsTotal: 120, tempsCdB: 120 }),
  base('c', '2026-10-03', { tempsNuit: 100 }),
  base('d', '2026-10-04', { tempsCdB: 60 }),
  base('e', '2026-10-05', { hDep: '14:00', hArr: '10:00' }),
  base('f1', '2026-10-06'), base('f2', '2026-10-06', { hDep: '09:00', hArr: '10:00', avionId: 'a2', tempsTotal: 60, tempsCdB: 60 }),
  base('g', '2026-10-07', { dep: 'LFTH', escales: [{ code: 'LFTH', attJour: 1, attNuit: 0, approches: 0 }], attJour: 2 }),
  base('h1', '2026-10-08'), base('h2', '2026-10-08', { aReporter: true }),
];
// … et des cas voisins corrects
const BONS = [
  base('ar', '2026-10-10'),
  base('minuit', '2026-10-11', { hDep: '23:00', hArr: '00:30', attJour: 0, attNuit: 1, tempsNuit: 90 }),
  base('t1', '2026-10-12', { hArr: '09:00', tempsTotal: 60, tempsCdB: 60 }), base('t2', '2026-10-12', { hDep: '09:00', hArr: '10:00', tempsTotal: 60, tempsCdB: 60 }),
  base('inst', '2026-10-13', { fonction: 'inst', tempsInst: 90, tempsCdB: 90, nomEleve: 'XYZ' }),
  base('etapes', '2026-10-14', { escales: [{ code: 'LFML', attJour: 1, attNuit: 0, approches: 0 }], attJour: 1 }),
  base('sim', '2026-10-15', { avionId: 's1', tempsTotal: 0, tempsCdB: 0, simTemps: 120, hArr: '07:00' }),
];
const VOLS = [...MAUVAIS, ...BONS];
const npf = { format: 'carnet-vol-npf', version: 1, id: 'npf-essai-61', exporteLe: '2026-11-20T10:00:00Z', date: '2026-11-19', blocDepart: '13:05', blocArrivee: '14:40',
  immat: 'F-XZZA', depart: 'LFTW', arrivee: 'LFML' };

// ---------- Faux NAS v5 (synchro + vols NPF) ----------
const srv = await serveur();
const nas = { mdp: 'mot-de-passe-essai-61b', rev: 0, el: new Map(), npf: new Map([[npf.id, npf]]) };
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
async function appareil(nom, { remplir = true, largeur = 393 } = {}) {
  const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: largeur, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
  await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|Access-Control|access control/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  if (remplir) {
    await p.evaluate(async ([avs, vs]) => {
      const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
      const t = db.transaction(['avions', 'vols'], 'readwrite');
      for (const a of avs) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
      await new Promise(ok => { t.oncomplete = ok; }); db.close();
    }, [AVIONS, VOLS]);
    await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  }
  return { p, ctx };
}
const onglet = (p, v) => p.click(`.tabs button[data-v="${v}"]`);
const volDe = (p, id) => p.evaluate(async id => (await import('./js/etat.js')).etat.vols.find(v => v.id === id), id);
const vols = p => p.evaluate(async () => (await import('./js/etat.js')).etat.vols);
const totaux = p => p.evaluate(async () => { const t = await import('./js/totaux.js'), e = await import('./js/etat.js'); return JSON.stringify(t.calculerTotaux(e.etat.vols, e.etat.avions, '2026-12-31')); });
const fini = (p, sel) => p.waitForFunction(s => { const e = document.querySelector(s); return e && e.textContent.trim() && !/en cours|Envoi :|Réception :|prêt \?/.test(e.textContent); }, sel, { timeout: 60000 });
async function rejoindre(p, role) {
  await onglet(p, 'plus'); await p.click('#pl-sync'); await p.click('#sy-nas'); await p.fill('#nas-adr', ADRESSE_NAS); await p.fill('#nas-mdp', nas.mdp); await p.click('#nas-ok'); await p.waitForTimeout(400); await p.click('#ou-x');
  await p.click('#pl-sync');
  if (role === 'ref') { await p.click('#sy-ref'); await p.click('#sr-ok'); await fini(p, '#sr-res'); } else { await p.click('#sy-mod'); await p.click('#sc-ok'); await fini(p, '#sc-res'); }
  await p.click('#ou-x'); await onglet(p, 'carnet');
}
const actualiser = async p => { await onglet(p, 'carnet'); await p.click('#rafraichir'); await p.waitForFunction(() => !document.getElementById('rafraichir').classList.contains('tourne'), null, { timeout: 30000 }); await p.waitForTimeout(400); };
const ronds = p => p.$$eval('#list .fl-rep', l => ({ n: l.length, verts: l.filter(r => r.classList.contains('on')).length, vides: l.filter(r => !r.classList.contains('on')).length }));
const ligne = p => p.evaluate(() => { const l = document.getElementById('rep-ligne'); return l.hidden ? null : { texte: [...l.children].filter(e => !e.hidden).map(e => e.textContent.trim()).join(' '), rouge: getComputedStyle(document.getElementById('rep-n')).color, presse: l.getAttribute('aria-pressed') }; });
const rond = (p, id) => p.locator(`.flight[data-id="${id}"] .fl-rep`);
const tousLesVols = async p => { for (let i = 0; i < 4 && await p.isVisible('#list-debut'); i++) await p.click('#list-debut'); await p.evaluate(async () => { for (let i = 0; i < 10; i++) { scrollTo(0, document.body.scrollHeight); await new Promise(r => setTimeout(r, 80)); } scrollTo(0, 0); }); };
// R154 : aucune bulle (ni texte) sous le rond ; zone d'appui ≥ 40 px, entièrement dans la carte
const mesureRonds = p => p.$$eval('#list .flight', cartes => cartes.map(c => {
  const r = c.querySelector('.fl-rep'); if (!r) return null;
  const z = r.getBoundingClientRect(), o = r.querySelector('svg').getBoundingClientRect(), k = c.getBoundingClientRect();
  // bulles : leur boîte ; lignes de texte (mission, heures, avion) : le texte lui-même (leur boîte, sans fond, va jusqu'au bord)
  const touche = b => b.right > z.left + 0.5 && b.left < z.right - 0.5 && b.bottom > z.top + 0.5 && b.top < z.bottom - 0.5;
  const sous = [...c.querySelectorAll('.chip')].filter(e => touche(e.getBoundingClientRect())).map(e => e.textContent);
  for (const e of c.querySelectorAll('.fl-rem, .fl-voir, .fl-meta, .fl-id')) { const rg = document.createRange(); rg.selectNodeContents(e); if ([...rg.getClientRects()].some(touche)) sous.push(e.className); }
  return { id: c.dataset.id, l: z.width, h: z.height, rond: [o.width, o.height], dedans: z.right <= k.right + 0.5 && z.bottom <= k.bottom + 0.5, sous };
}).filter(Boolean));

const triangles = p => p.$$eval('#list .flight', l => l.filter(c => c.querySelector('.fl-an')).map(c => c.dataset.id).sort());
const bouton = p => p.evaluate(() => { const b = document.getElementById('an-btn'); return b.hidden ? null : { texte: document.getElementById('an-n').textContent, presse: b.getAttribute('aria-pressed'), tri: b.querySelectorAll('.an-tri').length, h: b.getBoundingClientRect().height }; });
const affiches = p => p.$$eval('#list .flight', l => l.map(c => c.dataset.id).sort());
async function ouvrir(p, id) { await onglet(p, 'carnet'); await p.locator(`.flight[data-id="${id}"]`).scrollIntoViewIfNeeded(); await p.click(`.flight[data-id="${id}"] .fl-route`); await p.waitForSelector('#v-saisie:not([hidden])'); await p.waitForTimeout(200); }
const fermer = async p => { for (let i = 0; i < 3 && await p.isVisible('#v-saisie'); i++) { await p.click('#cancel'); await p.waitForTimeout(80); if (await p.isVisible('#ab-yes')) await p.click('#ab-yes'); } await p.waitForSelector('#v-carnet:not([hidden])'); };
const sansEtats = v => { const { anomaliesIgnorees, aReporter, reporteLe, ...r } = v; return r; };

try {
  const A = await appareil('A');
  const version = await A.p.evaluate(async () => (await import('./js/version.js')).VERSION);
  verifier(Number(version.split('.')[1]) >= 61, `version ${version} (0.61 ou suivante)`);
  const t0 = await totaux(A.p), vols0 = await vols(A.p);
  const csv = p => p.evaluate(async () => { const s = await import('./js/sauvegarde.js'), e = await import('./js/etat.js'); return s.texteTableur([...e.etat.vols].reverse(), e.etat.avions, e.listeDesCompteurs()); });
  const pdf = p => p.evaluate(async () => { const s = await import('./js/pdf.js'), e = await import('./js/etat.js'); return JSON.stringify(s.totauxPDF(e.etat.vols, e.etat.avions)); });
  const csv0 = await csv(A.p), pdf0 = await pdf(A.p);
  await tousLesVols(A.p);

  console.log('R155 : une anomalie de chaque sorte, cas voisins corrects');
  const attendus = MAUVAIS.map(v => v.id).sort();
  let tr = await triangles(A.p);
  verifier(JSON.stringify(tr) === JSON.stringify(attendus), `« ! » sur les ${tr.length} vols à anomalie (a à h) : ${tr.join(' ')}`);
  verifier(BONS.every(v => !tr.includes(v.id)), 'aucun « ! » sur : aller-retour LFTW → LFTW, vol passant minuit, vols qui se touchent, vol instructeur, 2 étapes 1 atterrissage, simulateur');
  verifier(JSON.stringify(await vols(A.p)) === JSON.stringify(vols0), 'la détection ne modifie aucun vol');
  const tri = await A.p.evaluate(() => { const s = document.querySelector('#list .fl-an svg'); return s && s.tagName === 'svg' && !/[⚠]/.test(document.querySelector('#list .fl-an').textContent); });
  verifier(tri, 'triangle jaune « ! » dessiné par l\'app (SVG, pas un emoji)');

  console.log('Bouton jaune et filtre');
  let b = await bouton(A.p);
  const hSocle = await A.p.evaluate(() => { const s = document.createElement('div'); s.className = 'socle'; s.innerHTML = '<div class="sc">X</div>'; document.getElementById('h-socle').after(s); const h = s.firstChild.getBoundingClientRect().height; s.remove(); return h; });
  verifier(b && b.texte === `${attendus.length} vols à vérifier` && b.tri === 2 && Math.abs(b.h - hSocle) < 0.5, `bouton « ⚠ ${b && b.texte} ⚠ » (triangle des deux côtés, ${b && b.h} px comme les cases OPS / IFR)`);
  const ordre = await A.p.evaluate(() => !!(document.getElementById('h-socle').compareDocumentPosition(document.getElementById('an-btn')) & Node.DOCUMENT_POSITION_FOLLOWING));
  verifier(ordre, 'sous les cases OPS / IFR');
  await A.p.click('#an-btn'); await A.p.waitForTimeout(300);
  verifier(JSON.stringify(await affiches(A.p)) === JSON.stringify(attendus) && (await bouton(A.p)).presse === 'true', 'appui : seulement les vols avec « ! »');
  await A.p.click('#rep-ligne'); await A.p.waitForTimeout(300);
  verifier(JSON.stringify(await affiches(A.p)) === '["h2"]' && (await bouton(A.p)).presse === 'false' && (await ligne(A.p)).presse === 'true', 'appui sur « À reporter » : son filtre remplace celui des anomalies (un seul à la fois)');
  await A.p.click('#an-btn'); await A.p.waitForTimeout(300);
  verifier((await ligne(A.p)).presse === 'false' && (await bouton(A.p)).presse === 'true', 'et inversement');
  await A.p.click('#an-btn'); await A.p.waitForTimeout(300);
  verifier((await affiches(A.p)).length === VOLS.length && (await bouton(A.p)).presse === 'false', 'nouvel appui : tous les vols');
  await A.p.screenshot({ path: join(CAPT, 'v061b-accueil.png') });

  console.log('Cadre « Anomalie détectée », correction');
  await ouvrir(A.p, 'c');
  const cadre = await A.p.evaluate(() => ({ visible: !document.getElementById('an-cadre').hidden, titre: document.querySelector('#an-cadre b').textContent.trim(), l: [...document.querySelectorAll('#an-l li')].map(x => x.textContent), btn: document.getElementById('an-ign').textContent, p: document.querySelectorAll('#an-cadre p').length }));
  verifier(cadre.visible && cadre.titre === 'Anomalie détectée' && JSON.stringify(cadre.l) === '["Temps de nuit (1h40) plus grand que le temps de vol (1h30)"]' && cadre.btn === 'Ignorer cette anomalie' && !cadre.p,
    `cadre jaune « ${cadre.titre} » : ${cadre.l.join(' | ')} ; bouton « ${cadre.btn} » ; aucune explication en plus`);
  const pos = await A.p.evaluate(() => document.getElementById('an-cadre').getBoundingClientRect().top < document.querySelector('#v-saisie .c-vol').getBoundingClientRect().top);
  verifier(pos, 'en haut de la fiche du vol');
  await A.p.screenshot({ path: join(CAPT, 'v061b-cadre.png') });
  await A.p.click('#f-edit'); await A.p.fill('#c-nuit', '0h30'); await A.p.click('#save'); await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(300);
  verifier(!(await triangles(A.p)).includes('c') && await A.p.isHidden('#tv-modal'), 'vol corrigé (nuit 0h30) : le « ! » disparaît de lui-même');
  await ouvrir(A.p, 'ar'); verifier(await A.p.isHidden('#an-cadre'), 'vol correct : pas de cadre'); await fermer(A.p);

  console.log('« Ignorer »');
  const dAvant = await volDe(A.p, 'd');
  await ouvrir(A.p, 'd'); // en lecture
  await A.p.click('#an-ign'); await A.p.waitForTimeout(400);
  verifier(await A.p.isHidden('#an-cadre') && await A.p.isHidden('#tv-modal'), 'en lecture : « Ignorer » cache le cadre, pas d\'alerte « Temps de vol modifié »');
  await fermer(A.p);
  const dApres = await volDe(A.p, 'd');
  verifier(!(await triangles(A.p)).includes('d') && JSON.stringify(sansEtats(dApres)) === JSON.stringify(sansEtats(dAvant)) && dApres.modifieLe === dAvant.modifieLe,
    '« ! » enlevé ; données du vol identiques (même « Modifié le »)');
  verifier((await bouton(A.p)).texte === `${attendus.length - 2} vols à vérifier`, `bouton : « ${(await bouton(A.p)).texte} »`);
  await ouvrir(A.p, 'd'); verifier(await A.p.isHidden('#an-cadre'), 'rouvert : plus de cadre (l\'anomalie ignorée ne revient pas)');
  await A.p.click('#f-edit'); await A.p.fill('#f-rem', 'REMARQUE SEULE'); await A.p.click('#save'); await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(300);
  verifier(!(await triangles(A.p)).includes('d'), 'remarque seule modifiée : toujours ignorée');
  await ouvrir(A.p, 'd'); await A.p.click('#f-edit'); await A.p.fill('#c-ifr', '2h00'); await A.p.click('#save'); await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(300);
  verifier((await triangles(A.p)).includes('d'), 'vol modifié ensuite (IFR 2h00 > 1h30) : le « ! » revient');
  await ouvrir(A.p, 'd');
  const cadreD = await A.p.$$eval('#an-l li', l => l.map(x => x.textContent));
  verifier(cadreD.length === 2 && await A.p.textContent('#an-ign') === 'Ignorer ces anomalies', `deux anomalies : ${cadreD.join(' | ')}`);
  await fermer(A.p);

  console.log('360 et 393 px : triangle et rond');
  for (const largeur of [360, 393]) {
    await A.p.setViewportSize({ width: largeur, height: 852 }); await A.p.waitForTimeout(250);
    const m = await A.p.$$eval('#list .flight.avec-an', cartes => cartes.map(c => {
      const t = c.querySelector('.fl-an').getBoundingClientRect(), r = c.querySelector('.fl-rep').getBoundingClientRect(), o = c.querySelector('.fl-rep svg').getBoundingClientRect(), k = c.getBoundingClientRect();
      const touche = (a, z) => a.right > z.left + 0.5 && a.left < z.right - 0.5 && a.bottom > z.top + 0.5 && a.top < z.bottom - 0.5;
      const sous = [...c.querySelectorAll('.chip')].filter(e => touche(e.getBoundingClientRect(), t) || touche(e.getBoundingClientRect(), r)).length
        + [...c.querySelectorAll('.fl-rem, .fl-meta, .fl-id')].filter(e => { const g = document.createRange(); g.selectNodeContents(e); return [...g.getClientRects()].some(x => touche(x, t) || touche(x, r)); }).length;
      return { id: c.dataset.id, tri: [t.width, t.height], chevauche: touche(t, r), zone: [r.width, r.height], rond: o.width, dedans: t.left >= k.left && t.bottom <= k.bottom, sous };
    }));
    const pb = m.filter(x => x.chevauche || x.zone[0] < 40 || x.zone[1] < 40 || x.sous || !x.dedans || x.tri[0] < 18);
    verifier(m.length >= 8 && !pb.length, `${largeur} px : ${m.length} cartes avec « ! » ; triangle ${m[0].tri.join(' × ')} px et rond ${m[0].rond} px sans chevauchement, zone d'appui du rond ${m[0].zone.join(' × ')} px, aucune bulle dessous${pb.length ? ' — ' + JSON.stringify(pb[0]) : ''}`);
    await A.p.evaluate(() => scrollTo(0, 0)); await A.p.screenshot({ path: join(CAPT, `v061b-accueil-${largeur}.png`) });
  }
  await A.p.setViewportSize({ width: 393, height: 852 });
  const ouvre = await A.p.evaluate(() => { const t = document.querySelector('#list .flight.avec-an .fl-an'); return getComputedStyle(t).pointerEvents; });
  verifier(ouvre === 'none', 'toucher le triangle ouvre le vol (il ne capte pas l\'appui)');

  console.log('Synchro A -> B, sauvegarde, ancienne sauvegarde');
  await ouvrir(A.p, 'g'); await A.p.click('#an-ign'); await A.p.waitForTimeout(300); await fermer(A.p);
  await rejoindre(A.p, 'ref'); await actualiser(A.p);
  const B = await appareil('B', { remplir: false }); await rejoindre(B.p, 'mod'); await tousLesVols(B.p);
  verifier(!(await triangles(B.p)).includes('g') && (await triangles(B.p)).includes('a'), 'B : « ! » ignoré sur A, ignoré aussi sur B');
  await onglet(A.p, 'plus'); await A.p.click('#pl-save');
  const [dl] = await Promise.all([A.p.waitForEvent('download'), A.p.click('#sv-dl')]);
  const fichierSv = join(CAPT, 'v061b-sauvegarde.json'); writeFileSync(fichierSv, readFileSync(await dl.path())); await A.p.click('#ou-x'); await onglet(A.p, 'carnet');
  const C = await appareil('C', { remplir: false });
  const restaurer = async f => { await onglet(C.p, 'plus'); await C.p.click('#pl-restore');
    const [ch] = await Promise.all([C.p.waitForEvent('filechooser'), C.p.click('#rs-fichier')]); await ch.setFiles(f); await C.p.waitForSelector('#rs-ok'); await C.p.click('#rs-ok'); await C.p.waitForTimeout(900); await onglet(C.p, 'carnet'); await tousLesVols(C.p); };
  await restaurer(fichierSv);
  verifier(JSON.stringify(await triangles(C.p)) === JSON.stringify(await triangles(A.p)), 'C restauré : mêmes « ! » que A (ignorés conservés)');
  const sans = o => { if (Array.isArray(o)) return o.map(sans); if (o && typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) if (k !== 'anomaliesIgnorees') r[k] = sans(v); return r; } return o; };
  const fAncienne = join(CAPT, 'v061b-ancienne.json'); writeFileSync(fAncienne, JSON.stringify(sans(JSON.parse(readFileSync(fichierSv, 'utf8')))));
  await restaurer(fAncienne);
  verifier((await triangles(C.p)).includes('g'), 'ancienne sauvegarde (sans l\'information) : rien d\'ignoré');

  console.log('PDF, CSV, totaux');
  // les seuls changements de données faits par ce test : nuit de « c », remarque et IFR de « d » ; on les remet pour comparer
  await A.p.evaluate(async ([c0, d0]) => { const e = await import('./js/etat.js'); for (const o of [c0, d0]) { const v = e.etat.vols.find(x => x.id === o.id); Object.assign(v, { tempsNuit: o.tempsNuit, tempsIFR: o.tempsIFR, remarques: o.remarques, modifieLe: o.modifieLe }); } },
    [vols0.find(v => v.id === 'c'), vols0.find(v => v.id === 'd')]);
  verifier(await totaux(A.p) === t0 && await csv(A.p) === csv0 && await pdf(A.p) === pdf0, 'les « ! » et « Ignorer » ne changent ni les totaux, ni le CSV, ni le PDF');

  console.log('4 000 vols inventés : l\'accueil ne ralentit pas');
  const G = await appareil('G', { remplir: false });
  await G.p.evaluate(async avs => {
    const vols = Array.from({ length: 4000 }, (_, k) => { const j = new Date(Date.UTC(2015, 0, 1) + k * 864e5).toISOString().slice(0, 10);
      return { id: `g${k}`, date: j, hDep: '08:00', hArr: '09:30', mode: 'utc', dep: 'LFTW', arr: k % 3 ? 'LFML' : 'LFTW', escales: k % 9 ? [] : [{ code: 'LFTH', attJour: k % 2, attNuit: 0 }], avionId: 'a1',
        tempsTotal: 90, tempsCdB: 90, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', missions: [], remarques: '', feux: 0, compteurs: {}, etiquettes: [], attJour: 2, attNuit: 0, approches: 0, tempsIFR: 0,
        tempsNuit: 0, simTemps: 0, source: 'saisie', ordre: k, creeLe: '2026-01-01T00:00:00Z', modifieLe: '2026-01-01T00:00:00Z' }; });
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols'], 'readwrite'); for (const a of avs) t.objectStore('avions').put(a); for (const v of vols) t.objectStore('vols').put(v);
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, AVIONS);
  await G.p.reload(); await G.p.waitForSelector('body[data-pret="1"]');
  const cdp = await G.ctx.newCDPSession(G.p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const mesure = await G.p.evaluate(async () => {
    const an = await import('./js/anomalies.js'), e = await import('./js/etat.js'), te = await import('./js/terrains.js'), c = await import('./js/ui/carnet.js');
    let t = performance.now(); const m = an.anomaliesDuCarnet(e.etat.vols, e.etat.avions, x => te.terrain(x)); const calcul = performance.now() - t;
    t = performance.now(); c.rafraichirCarnet({ haut: true }); const accueil = performance.now() - t; // le calcul est en cache (déjà fait au lancement)
    e.etat.revision++; t = performance.now(); c.rafraichirCarnet({ haut: true }); const accueilAvecCalcul = performance.now() - t;
    return { n: m.size, calcul, accueil, accueilAvecCalcul };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach();
  verifier(mesure.calcul < 250 && mesure.accueilAvecCalcul - mesure.accueil < 250, `4 000 vols, processeur ralenti ×4 : calcul des anomalies ${mesure.calcul.toFixed(0)} ms (${mesure.n} vols signalés), accueil ${mesure.accueil.toFixed(0)} ms (${mesure.accueilAvecCalcul.toFixed(0)} ms quand le carnet vient de changer)`);

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur (ni vrai NAS, ni VPS, ni Google)' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.61 (anomalies) réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); faux.closeAllConnections?.(); faux.close(); srv.fermer();
}

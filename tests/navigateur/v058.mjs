// v0.58 : R147 cases du bloc du vol centrées (saisie et fiche en lecture, 360 / 393 px, mesure au pixel) ; R148 Terrain
// intermédiaire : « LFML » grisé, Espace sur champ vide -> LFML (touche du PC et texte « » du clavier Android) ; R149 vols
// groupés (type, avion, saisie, temps tapé partout, nuit et atterrissages non recalculés, synchro faux NAS, sauvegarde) ;
// R150 alerte « Temps de vol modifié ». Carnet INVENTÉ, aucun serveur extérieur.
// Usage : node tests/navigateur/v058.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2026-11-01T08:00:00Z';
const avion = (id, immat, typeOACI, modele, champs = {}) => ({ id, immat, typeOACI, modele, constructeur: 'ESSAI', nom: '', indicatif: '', etiquettes: [], sim: false, photo: null,
  remarques: '', hexAdsb: '', surface: 'L', train: 'tricycle', equipage: 'SP', moteurs: 'SE', moteur: 'P', creeLe: H, modifieLe: H, ...champs });
const AVIONS = [avion('w1', 'F-XZZW', 'DR40', 'DR400'), avion('p1', 'F-XZZP', 'PA25', 'PA-25 Pawnee'), avion('p2', 'F-XZZQ', 'PA25', 'PA-25 Pawnee')];
const C0 = { largCdbDash: 0, largInstrCdbDash: 0, largCopiDash: 0, largCopiCL: 0, ecopages: 0, amerrCL: 0, amerrSEP: 0, largPara: 0 };
const vol = (id, jour, avionId, hDep, hArr, minutes, champs = {}) => ({ id, date: `2026-11-${jour}`, hDep, hArr, mode: 'utc', dep: 'LFTW', arr: 'LFTW', escales: [], avionId,
  tempsTotal: minutes, tempsSE: null, tempsME: null, tempsMP: null, tempsCdB: minutes, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: '', nomInstructeur: '', nomExaminateur: '',
  missions: [], remarques: '', feux: 0, compteurs: { ...C0 }, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie',
  ordre: Date.parse(`2026-11-${jour}T${hDep}Z`), creeLe: H, modifieLe: H, ...champs });
const VOLS = [vol('r1', '01', 'w1', '09:00', '10:30', 90), vol('r2', '02', 'w1', '10:00', '11:00', 60), vol('r3', '03', 'p1', '13:00', '13:40', 40, { remarques: 'ESSAI' })];
const T0 = { vols: 3, tempsTotal: 190, tempsCdB: 190, atterrissages: 3 }; // jeu inventé sans vol groupé

// ---------- Faux NAS v5 (synchro seulement) ----------
const srv = await serveur();
const nas = { mdp: 'mot-de-passe-essai-58', rev: 0, el: new Map() };
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
const avionDe = (p, id) => p.evaluate(async id => (await import('./js/etat.js')).etat.avions.get(id), id);
const reglageDe = (p, k) => p.evaluate(async k => (await import('./js/etat.js')).reglage(k), k);
const totaux = p => p.evaluate(async () => { const t = await import('./js/totaux.js'), e = await import('./js/etat.js'); return t.calculerTotaux(e.etat.vols, e.etat.avions, '2026-12-31'); });
const hm = m => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
const fini = (p, sel) => p.waitForFunction(s => { const e = document.querySelector(s); return e && e.textContent.trim() && !/en cours|Envoi :|Réception :|prêt \?/.test(e.textContent); }, sel, { timeout: 60000 });
async function rejoindre(p, role) {
  await onglet(p, 'plus'); await p.click('#pl-sync'); await p.click('#sy-nas'); await p.fill('#nas-adr', ADRESSE_NAS); await p.fill('#nas-mdp', nas.mdp); await p.click('#nas-ok'); await p.waitForTimeout(400); await p.click('#ou-x');
  await p.click('#pl-sync');
  if (role === 'ref') { await p.click('#sy-ref'); await p.click('#sr-ok'); await fini(p, '#sr-res'); } else { await p.click('#sy-mod'); await p.click('#sc-ok'); await fini(p, '#sc-res'); }
  await p.click('#ou-x'); await onglet(p, 'carnet');
}
async function ouvrirVol(p, id, modifier = true) {
  await onglet(p, 'carnet'); await p.locator(`.flight[data-id="${id}"]`).scrollIntoViewIfNeeded();
  await p.click(`.flight[data-id="${id}"]`); await p.waitForSelector('#v-saisie:not([hidden])');
  if (modifier && await p.isVisible('#f-edit')) await p.click('#f-edit');
}
const fermerVol = async p => { for (let i = 0; i < 3 && await p.isVisible('#v-saisie'); i++) { await p.click('#cancel'); await p.waitForTimeout(80); if (await p.isVisible('#ab-yes')) await p.click('#ab-yes'); } await p.waitForSelector('#v-carnet:not([hidden])'); };
const nouveauVol = async p => { await onglet(p, 'carnet'); await p.click('#fab'); await p.waitForSelector('#v-saisie:not([hidden])'); };
const choisirAvion = async (p, id, immat) => { await p.click('#ac-cur'); await p.fill('#ac-q', immat); await p.click(`#ac-res [data-ac="${id}"]`); await p.waitForTimeout(100); };
const heure = async (p, sel, h) => { await p.fill(sel, ''); await p.type(sel, h); };

// ---------- R147 : mesures ----------
// Texte (titre, nom du terrain) : boîte du texte dans sa case (.field)
const ecartsTexte = (p, sel) => p.evaluate(sel => {
  const el = document.querySelector(sel), r = document.createRange(); r.selectNodeContents(el);
  const t = r.getBoundingClientRect(), c = el.closest('.field').getBoundingClientRect();
  return { g: t.left - c.left, d: c.right - t.right, l: t.width };
}, sel);
// Contenu d'un champ (LFML, 13h24) : ENCRE mesurée au pixel sur une capture du champ (bords exclus)
async function ecartsEncre(p, sel) {
  const el = p.locator(sel); await el.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(60);
  const r = await el.boundingBox(), buf = await p.screenshot({ clip: r });
  return p.evaluate(async ([b64, w]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, Hh = c.height, k = Math.round(W / w), marge = Math.round(4 * k); // k = pixels de l'écran par px (×2) : mesure au pixel de l'écran
    const px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const fond = px(marge, Hh >> 1), diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    let premier = -1, dernier = -1;
    for (let x = marge; x < W - marge; x++) for (let y = Math.round(Hh * 0.2); y < Math.round(Hh * 0.8); y++) if (diff(px(x, y), fond) > 120) { if (premier < 0) premier = x; dernier = x; break; }
    return { g: premier / k, d: (W - 1 - dernier) / k, encre: premier >= 0 };
  }, [buf.toString('base64'), r.width]);
}
async function centrage(p, quoi) {
  for (const [sel, nom] of [['label[for="f-dep"]', 'titre Départ'], ['label[for="f-arr"]', 'titre Arrivée'], ['#n-dep', 'nom du terrain de départ'], ['#n-arr', 'nom du terrain d\'arrivée'],
    ['label[for="f-t0"]', 'titre Bloc Départ'], ['label[for="f-t1"]', 'titre Bloc Arrivée']]) {
    const e = await ecartsTexte(p, sel);
    verifier(e.l > 0 && Math.abs(e.g - e.d) <= 1, `${quoi} : ${nom} centré (${e.g.toFixed(2)} / ${e.d.toFixed(2)} px)`);
  }
  for (const [sel, nom] of [['#f-dep', 'contenu Départ'], ['#f-arr', 'contenu Arrivée'], ['#f-t0', 'contenu Bloc Départ'], ['#f-t1', 'contenu Bloc Arrivée'],
    ['#c-ifr', 'Temps IFR'], ['#c-nuit', 'Temps nuit']]) {
    const e = await ecartsEncre(p, sel);
    if (process.env.V058_SONDE) console.log('    sonde', quoi, nom, e.g, e.d); else verifier(e.encre && Math.abs(e.g - e.d) <= 1, `${quoi} : ${nom} centré au pixel (${e.g.toFixed(2)} / ${e.d.toFixed(2)} px)`);
  }
  verifier(await p.evaluate(() => ['f-rem', 'f-copi'].every(id => ['left', 'start'].includes(getComputedStyle(document.getElementById(id)).textAlign))), `${quoi} : grands champs (remarques, autre pilote) toujours à gauche`);
}
// « Rien d'autre ne bouge » : place, taille, couleur et police des cases avec et sans les règles v0.58
const geometrie = p => p.evaluate(() => [...document.querySelectorAll('#v-saisie .c-vol .field, #v-saisie .c-vol .field > *, #v-saisie .c-vol .mstep, #f-bloc')]
  .filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return [Math.round(r.x * 10), Math.round(r.y * 10), Math.round(r.width * 10), Math.round(r.height * 10), s.fontSize, s.fontWeight, s.color, s.backgroundColor].join(','); }).join('|'));
const sansReglesV058 = p => p.evaluate(() => { for (const f of document.styleSheets) { let r; try { r = f.cssRules; } catch { continue; }
  for (let i = r.length - 1; i >= 0; i--) if (r[i].selectorText && /\.c-vol \.(aprow|blocrow|apname)/.test(r[i].selectorText)) f.deleteRule(i); } });

try {
  const A = await appareil('A');
  const version = await A.p.evaluate(async () => (await import('./js/version.js')).VERSION);
  verifier(Number(version.split('.')[1]) >= 58, `version ${version} (0.58 ou suivante)`);
  const t0 = await totaux(A.p);
  verifier(t0.vols === T0.vols && t0.tempsTotal === T0.tempsTotal && t0.tempsCdB === T0.tempsCdB && t0.atterrissages === T0.atterrissages, `jeu inventé sans vol groupé : totaux identiques (${t0.vols} vols, ${hm(t0.tempsTotal)})`);

  console.log('R147 : cases du bloc du vol centrées');
  for (const largeur of [360, 393]) {
    await A.p.setViewportSize({ width: largeur, height: 852 });
    await nouveauVol(A.p); await A.p.click('#tz-utc');
    await A.p.fill('#f-dep', 'LFML'); await A.p.fill('#f-arr', 'LFMA'); await heure(A.p, '#f-t0', '1324'); await heure(A.p, '#f-t1', '1450');
    await A.p.waitForTimeout(150);
    await centrage(A.p, `saisie ${largeur} px`);
    await A.p.screenshot({ path: join(CAPT, `v058-centrage-${largeur}.png`) });
    await fermerVol(A.p);
  }
  await ouvrirVol(A.p, 'r1', false);
  verifier(await A.p.isVisible('#f-edit') && await A.p.textContent('#cancel') === 'Fermer', 'fiche du vol en lecture (« Fermer » + crayon)');
  await centrage(A.p, 'lecture 393 px');
  const avec = await geometrie(A.p); await sansReglesV058(A.p); const sans = await geometrie(A.p);
  verifier(avec === sans, 'rien d\'autre ne bouge (place, taille, couleur, police des cases identiques sans les règles v0.58)');
  await A.p.reload(); await A.p.waitForSelector('body[data-pret="1"]');

  console.log('R148 : Terrain intermédiaire, LFML par défaut');
  await nouveauVol(A.p); await A.p.click('#via-add'); await A.p.waitForSelector('#via-modal:not([hidden])');
  verifier(await A.p.getAttribute('#vm-icao', 'placeholder') === 'LFML', 'texte grisé « LFML »');
  await A.p.waitForTimeout(100); await A.p.focus('#vm-icao'); await A.p.keyboard.press('Space');
  verifier(await A.p.inputValue('#vm-icao') === 'LFML' && await A.p.textContent('#vm-name') === 'Marseille Provence', `PC : Espace sur champ vide -> ${await A.p.inputValue('#vm-icao')} « ${await A.p.textContent('#vm-name')} »`);
  await A.p.fill('#vm-icao', ''); await A.p.focus('#vm-icao'); await A.p.keyboard.insertText(' ');
  verifier(await A.p.inputValue('#vm-icao') === 'LFML' && await A.p.textContent('#vm-name') === 'Marseille Provence', 'clavier Android (texte « » sans touche) : LFML « Marseille Provence »');
  await A.p.fill('#vm-icao', ''); await A.p.type('#vm-icao', 'LFMA');
  verifier(await A.p.inputValue('#vm-icao') === 'LFMA' && await A.p.textContent('#vm-name') === 'Aix Les Milles', 'saisie normale LFMA : « Aix Les Milles »');
  await A.p.keyboard.press('Space');
  verifier(await A.p.inputValue('#vm-icao') === 'LFMA', 'Espace sur un champ rempli : rien ne change');
  await A.p.click('#vm-cancel');
  await A.p.click('#tz-lf'); await A.p.click('#via-add'); await A.p.waitForTimeout(120);
  verifier(await A.p.inputValue('#vm-icao') === 'LF', 'bouton LF allumé : « LF » au toucher');
  await A.p.keyboard.press('Space');
  verifier(await A.p.inputValue('#vm-icao') === 'LFML' && await A.p.textContent('#vm-name') === 'Marseille Provence', 'bouton LF allumé : Espace -> LFML');
  await A.p.click('#vm-ok');
  verifier(/LFML|Marseille/.test(await A.p.textContent('#via-list')), 'LFML ajouté comme terrain intermédiaire');
  await A.p.click('#tz-lf'); await fermerVol(A.p);

  console.log('R149 : Vols groupés : où la case apparaît');
  await nouveauVol(A.p); await choisirAvion(A.p, 'w1', 'XZZW');
  verifier(await A.p.isHidden('#vg-zone'), 'F-XZZW (DR400), rien de réglé : pas de case « Vols groupés »');
  await choisirAvion(A.p, 'p1', 'XZZP');
  verifier(await A.p.isHidden('#vg-zone'), 'F-XZZP (PA-25), type pas encore réglé : pas de case');
  await fermerVol(A.p);
  await onglet(A.p, 'plus'); await A.p.click('#pl-types'); await A.p.click('#ty-l [data-ty="PA25"]');
  verifier(await A.p.getAttribute('#te-vg', 'aria-checked') === 'false', 'fiche type PA25 : « Vols groupés » éteint par défaut');
  await A.p.click('#te-vg'); await A.p.click('#te-ok'); await A.p.waitForTimeout(300); await A.p.click('#ou-x');
  verifier(JSON.stringify(await reglageDe(A.p, 'volsGroupesTypes')) === '{"PA25":true}', 'type PA25 allumé (réglage partagé)');
  await A.p.click('#pl-avions'); await A.p.waitForSelector('#fl-list .acitem'); await A.p.click('[data-ed="p2"]'); await A.p.waitForSelector('#fiche:not([hidden])');
  verifier(await A.p.getAttribute('#fi-vg-sw', 'aria-checked') === 'true' && /Comme le type PA25/.test(await A.p.textContent('#fi-vg-h')), 'fiche F-XZZQ : suit son type (allumé)');
  await A.p.click('#fi-vg-sw');
  verifier(await A.p.getAttribute('#fi-vg-sw', 'aria-checked') === 'false' && /Réglé pour cet avion/.test(await A.p.textContent('#fi-vg-h')), 'fiche F-XZZQ : éteint pour cet avion');
  await A.p.click('#fi-save'); await A.p.waitForTimeout(400); await A.p.click('#fl-x');
  verifier((await avionDe(A.p, 'p2')).volsGroupes === false && (await avionDe(A.p, 'p1')).volsGroupes == null, 'F-XZZQ réglé à « non », F-XZZP comme le type');
  await nouveauVol(A.p); await choisirAvion(A.p, 'p1', 'XZZP');
  verifier(await A.p.isVisible('#vg-zone') && await A.p.getAttribute('#f-vg', 'aria-checked') === 'false', 'F-XZZP (type allumé) : case « Vols groupés » visible, éteinte');
  const ordre = await A.p.evaluate(() => { const z = document.getElementById('vg-zone'), b = document.querySelector('.blocrow'), r = document.getElementById('f-ifr').closest('.condrow');
    return !!(b.compareDocumentPosition(z) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(z.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING) && getComputedStyle(z.firstElementChild).backgroundColor === getComputedStyle(r.firstElementChild).backgroundColor; });
  verifier(ordre, 'case juste sous Bloc Départ / Bloc Arrivée, avant Règles / Appr / Temps IFR, même style');
  await choisirAvion(A.p, 'p2', 'XZZQ');
  verifier(await A.p.isHidden('#vg-zone'), 'F-XZZQ (éteint, son type allumé) : pas de case');
  await choisirAvion(A.p, 'w1', 'XZZW');
  verifier(await A.p.isHidden('#vg-zone'), 'F-XZZW : toujours pas de case');

  console.log('R149 : vol groupé 09h00 -> 12h30, temps tapé 1h45');
  await choisirAvion(A.p, 'p1', 'XZZP'); await A.p.click('#tz-utc');
  await heure(A.p, '#f-t0', '0900'); await heure(A.p, '#f-t1', '1230'); await A.p.waitForTimeout(100);
  verifier(await A.p.textContent('#f-bloc') === '3h30', 'interrupteur éteint : 3h30 (Bloc Arrivée − Bloc Départ)');
  await A.p.click('#f-vg');
  verifier(await A.p.isVisible('#f-bloc-in') && await A.p.isHidden('#f-bloc') && await A.p.inputValue('#f-bloc-in') === '3h30', 'allumé : le temps devient une case à taper (3h30 au départ)');
  await A.p.fill('#f-bloc-in', '145');
  verifier(await A.p.inputValue('#f-bloc-in') === '1h45' && await A.p.inputValue('#c-fn') === '1h45', `« 145 » -> 1h45 ; temps de fonction ${await A.p.inputValue('#c-fn')}`);
  const nuitAvant = await A.p.inputValue('#c-nuit');
  await heure(A.p, '#f-t1', '1830'); await A.p.waitForTimeout(100);
  verifier(await A.p.inputValue('#c-nuit') === nuitAvant && await A.p.textContent('#s-attNuit') === '0' && await A.p.inputValue('#f-bloc-in') === '1h45',
    'arrivée de nuit (18h30) : temps de nuit, atterrissages et temps tapé non recalculés');
  await heure(A.p, '#f-t1', '1230');
  for (let i = 0; i < 5; i++) await A.p.click('[data-s="attJour"][data-d="1"]');
  verifier(await A.p.textContent('#s-attJour') === '6' && await A.p.textContent('#s-attNuit') === '0', 'atterrissages à la main : 6 de jour');
  await A.p.screenshot({ path: join(CAPT, 'v058-vol-groupe.png') });
  await A.p.click('#f-ok'); await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(300);
  const g = (await A.p.evaluate(async () => (await import('./js/etat.js')).etat.vols.find(v => v.volsGroupes)));
  verifier(g && g.tempsTotal === 105 && g.tempsCdB === 105 && g.hDep === '09:00' && g.hArr === '12:30' && g.attJour === 6 && g.attNuit === 0 && g.tempsNuit === 0,
    `vol enregistré : 1h45 (pas 3h30), heures 09:00 / 12:30 gardées, 6 att. (${g && hm(g.tempsTotal)})`);
  const t1 = await totaux(A.p);
  verifier(t1.tempsTotal === T0.tempsTotal + 105 && t1.tempsCdB === T0.tempsCdB + 105, `totaux et fonction CdB : + 1h45 (${hm(t1.tempsTotal)})`);
  const fa = Object.entries(t1.parFamilleAnnee || {}).find(([k]) => /PA-25/.test(k));
  verifier(fa && fa[1] === 145, `« PA-25 / Année » : ${fa && hm(fa[1])} (40 min + 1h45)`);
  const carte = await A.p.textContent(`.flight[data-id="${g.id}"] .fl-bloc`);
  verifier(carte.trim() === '1h45', `carte du vol à l'accueil : ${carte.trim()}`);
  const haut = (await A.p.textContent('#h-total')).replace(/\s/g, ''), bande = await A.p.textContent('#h-strip');
  verifier(haut === hm(t1.tempsTotal) && bande.includes(hm(t1.tempsCdB)), `accueil : total ${haut}, bande « ${bande.replace(/\s+/g, ' ').trim()} »`);
  const pdf = await A.p.evaluate(async id => { const e = await import('./js/etat.js'), p = await import('./js/pdf.js'); const v = e.etat.vols.find(x => x.id === id); return p.valeursVol(v, e.etat.avions.get(v.avionId)); }, g.id);
  verifier(pdf.total === 105 && pdf.cdb === 105, 'PDF : temps total et CdB 1h45 (heures 09:00 / 12:30 : test unitaire v058)');

  console.log('R149 : relu, puis éteint de nouveau');
  await ouvrirVol(A.p, g.id, false);
  verifier(await A.p.isVisible('#vg-zone') && await A.p.inputValue('#f-bloc-in') === '1h45' && await A.p.evaluate(() => document.getElementById('f-bloc-in').readOnly), 'en lecture : case allumée, 1h45 (non modifiable)');
  await A.p.click('#f-vg', { force: true });
  verifier(await A.p.getAttribute('#f-vg', 'aria-checked') === 'true', 'en lecture : l\'interrupteur ne bouge pas');
  await A.p.click('#f-edit'); await A.p.click('#f-vg');
  verifier(await A.p.textContent('#f-bloc') === '3h30' && await A.p.isVisible('#f-bloc'), 'éteint de nouveau : retour à 3h30');
  await A.p.click('#f-ok'); await A.p.waitForSelector('#tv-modal:not([hidden])');
  verifier(/1h45 → 3h30 \(\+1h45\)/.test(await A.p.textContent('#tv-txt')), `R150 : ${await A.p.textContent('#tv-txt')}`);
  await A.p.click('#tv-ok'); await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(250);
  verifier((await volDe(A.p, g.id)).tempsTotal === 210 && !(await volDe(A.p, g.id)).volsGroupes, 'vol à 3h30, plus groupé');
  await ouvrirVol(A.p, g.id); await A.p.click('#f-vg'); await A.p.fill('#f-bloc-in', '1h45'); await A.p.click('#f-ok');
  await A.p.waitForSelector('#tv-modal:not([hidden])'); await A.p.click('#tv-ok'); await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(250);
  verifier((await volDe(A.p, g.id)).tempsTotal === 105 && (await volDe(A.p, g.id)).volsGroupes === true, 'regroupé : 1h45');

  console.log('R150 : alerte si le temps de vol change');
  const avantR1 = JSON.stringify(await volDe(A.p, 'r1')), total = (await totaux(A.p)).tempsTotal;
  await ouvrirVol(A.p, 'r1'); await heure(A.p, '#f-t1', '1045'); await A.p.click('#f-ok');
  await A.p.waitForSelector('#tv-modal:not([hidden])');
  const txt = await A.p.textContent('#tv-txt');
  verifier(txt === `Temps de vol modifié : 1h30 → 1h45 (+0h15). Ton total HdV passe de ${hm(total)} à ${hm(total + 15)}.`, `alerte : « ${txt} »`);
  verifier(await A.p.isVisible('#tv-ok') && /Enregistrer quand même/.test(await A.p.textContent('#tv-ok')) && /Annuler/.test(await A.p.textContent('#tv-no')), 'boutons « Enregistrer quand même » / « Annuler »');
  await A.p.click('#tv-no'); await A.p.waitForTimeout(200);
  verifier(await A.p.isVisible('#v-saisie') && await A.p.inputValue('#f-t1') === '10h45' && JSON.stringify(await volDe(A.p, 'r1')) === avantR1, 'Annuler : retour à la saisie, vol inchangé');
  await A.p.click('#f-ok'); await A.p.waitForSelector('#tv-modal:not([hidden])');
  await A.p.goBack(); await A.p.waitForTimeout(300);
  verifier(await A.p.isHidden('#tv-modal') && await A.p.isVisible('#v-saisie') && JSON.stringify(await volDe(A.p, 'r1')) === avantR1, 'flèche retour = Annuler');
  await A.p.click('#f-ok'); await A.p.waitForSelector('#tv-modal:not([hidden])'); await A.p.click('#tv-ok');
  await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(250);
  verifier((await volDe(A.p, 'r1')).tempsTotal === 105 && (await totaux(A.p)).tempsTotal === total + 15, 'Enregistrer quand même : vol à 1h45, total + 0h15');
  await ouvrirVol(A.p, 'r1'); await A.p.fill('#m-q', 'ESSAI MISSION'); await A.p.click('#m-res [data-mnew]'); await A.p.fill('#f-rem', 'ESSAI MODIFIÉ'); await A.p.click('#f-ok');
  await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(250);
  const r1 = await volDe(A.p, 'r1');
  verifier(await A.p.isHidden('#tv-modal') && r1.remarques === 'ESSAI MODIFIÉ' && r1.missions.includes('ESSAI MISSION') && r1.tempsTotal === 105, `mission et remarques seules : pas d'alerte, enregistré (${r1.missions.join(', ')})`);
  await nouveauVol(A.p); await choisirAvion(A.p, 'w1', 'XZZW'); await heure(A.p, '#f-t0', '1400'); await heure(A.p, '#f-t1', '1500'); await A.p.click('#f-ok');
  await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(250);
  const nb = await A.p.evaluate(async () => (await import('./js/etat.js')).etat.vols.length);
  verifier(await A.p.isHidden('#tv-modal') && nb === 5, `nouveau vol : pas d'alerte, enregistré (${nb} vols)`);

  console.log('Synchro A -> B (faux NAS), sauvegarde -> C');
  await rejoindre(A.p, 'ref');
  const B = await appareil('B', { remplir: false });
  await rejoindre(B.p, 'mod');
  const gB = await volDe(B.p, g.id);
  verifier(gB && gB.volsGroupes === true && gB.tempsTotal === 105 && gB.hDep === '09:00' && gB.hArr === '12:30' && (await avionDe(B.p, 'p2')).volsGroupes === false
    && JSON.stringify(await reglageDe(B.p, 'volsGroupesTypes')) === '{"PA25":true}' && JSON.stringify(await totaux(B.p)) === JSON.stringify(await totaux(A.p)),
  'appareil B : vol groupé (1h45, 09:00 / 12:30), interrupteurs de l\'avion et du type, totaux identiques');
  await ouvrirVol(B.p, g.id, false);
  verifier(await B.p.isVisible('#vg-zone') && await B.p.inputValue('#f-bloc-in') === '1h45', 'appareil B : vol groupé affiché'); await fermerVol(B.p);
  await onglet(A.p, 'plus'); await A.p.click('#pl-save');
  const [dl] = await Promise.all([A.p.waitForEvent('download'), A.p.click('#sv-dl')]);
  const fichierSv = join(CAPT, 'v058-sauvegarde.json'); writeFileSync(fichierSv, readFileSync(await dl.path())); await A.p.click('#ou-x');
  const C = await appareil('C', { remplir: false });
  await onglet(C.p, 'plus'); await C.p.click('#pl-restore');
  const [ch] = await Promise.all([C.p.waitForEvent('filechooser'), C.p.click('#rs-fichier')]);
  await ch.setFiles(fichierSv); await C.p.waitForSelector('#rs-ok'); await C.p.click('#rs-ok'); await C.p.waitForTimeout(800);
  const gC = await volDe(C.p, g.id);
  verifier(gC && gC.volsGroupes === true && gC.tempsTotal === 105 && (await avionDe(C.p, 'p2')).volsGroupes === false
    && JSON.stringify(await reglageDe(C.p, 'volsGroupesTypes')) === '{"PA25":true}' && JSON.stringify(await totaux(C.p)) === JSON.stringify(await totaux(A.p)),
  'appareil C restauré : vol groupé, interrupteurs, totaux identiques');

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur (ni vrai NAS, ni VPS, ni Google)' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.58 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); faux.closeAllConnections?.(); faux.close(); srv.fermer();
}

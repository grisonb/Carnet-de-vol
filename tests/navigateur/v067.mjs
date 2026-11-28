// v0.67 : R163 att. de nuit sans temps de nuit ; R164 (corrigé) « Temps en dixièmes » par TYPE d'avion (DH8D et CL2T allumés d'office) :
// accueil (temps encadré, bulles IFR / Nuit) et fiche du vol (temps, IFR, nuit, Temps du carnet, saisie « 0.2 » = 12 min, vols groupés)
// en dixièmes avec un point pour ces types seulement ; interrupteur de la fiche du type (éteint / allumé : aucun vol modifié) ; totaux,
// PDF, CSV, alerte R150 toujours en heures et minutes ; ancien réglage « Format Tps de Vol » (R165 retiré) reçu par la synchro ou
// restauré : ignoré ; 360 / 393 px. Carnet INVENTÉ, FAUX NAS v5, aucun serveur extérieur. Usage : node tests/navigateur/v067.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2026-10-01T08:00:00Z';
const avion = (id, immat, typeOACI, champs = {}) => ({ id, immat, typeOACI, modele: typeOACI, constructeur: 'ESSAI', nom: '', indicatif: '', equipage: 'MP', moteurs: 'ME', moteur: 'T',
  surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', hexAdsb: '', creeLe: H, modifieLe: H, ...champs });
const AVIONS = [avion('a1', 'F-XZZA', 'DH8D', { volsGroupes: true }), avion('a2', 'F-XZZB', 'CL2T', { surface: 'A' }), avion('a3', 'F-XZZC', 'DR40', { equipage: 'SP', moteurs: 'SE', moteur: 'P' })];
const C0 = { largCdbDash: 0, largInstrCdbDash: 0, largCopiDash: 0, largCopiCL: 0, ecopages: 0, amerrCL: 0, amerrSEP: 0, largPara: 0 };
const hh = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const vol = (id, jour, t, champs = {}) => ({ id, date: `2026-10-${String(jour).padStart(2, '0')}`, hDep: '08:00', hArr: hh(480 + t), mode: 'utc', dep: 'LFTW', arr: 'LFTW', escales: [], avionId: 'a1',
  tempsTotal: t, tempsMP: null, tempsSE: null, tempsME: null, tempsCdB: t, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: '', nomInstructeur: '', nomExaminateur: '',
  missions: [], remarques: '', feux: 0, compteurs: { ...C0 }, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie',
  ordre: Date.parse(`2026-10-${String(jour).padStart(2, '0')}T08:00Z`), creeLe: H, modifieLe: H, ...champs });
const VOLS = [
  vol('d84', 1, 84), vol('d86', 2, 86), vol('d87', 3, 87), vol('d14', 4, 14), vol('d128', 5, 128, { tempsIFR: 108 }),
  vol('nuit14', 6, 60, { tempsNuit: 14 }), vol('r163', 7, 60, { avionId: 'a3', attJour: 0, attNuit: 1 }),
  vol('cl84', 8, 84, { avionId: 'a2' }), vol('dr84', 9, 84, { avionId: 'a3', tempsIFR: 78, tempsNuit: 14 }),
  vol('groupe', 11, 90, { hArr: '13:00', volsGroupes: true }),
];

// ---------- Faux NAS v5 (synchro + vols NPF) ----------
const srv = await serveur({ dixiemesDefaut: null }); // départ de l'app : DH8D et CL2T allumés
const nas = { mdp: 'mot-de-passe-essai-67', rev: 0, el: new Map(), npf: new Map() };
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
const etatVols = p => p.evaluate(async () => JSON.stringify((await import('./js/etat.js')).etat.vols.map(v => [v.id, v.tempsTotal, v.tempsNuit, v.tempsIFR, v.tempsCdB, v.modifieLe]).sort()));
const volDe = (p, id) => p.evaluate(async id => (await import('./js/etat.js')).etat.vols.find(v => v.id === id), id);
const blocs = p => p.$$eval('#list .flight', l => Object.fromEntries(l.map(c => [c.dataset.id, { t: c.querySelector('.fl-bloc').textContent, chips: [...c.querySelectorAll('.chip')].map(x => x.textContent), dix: !!c.querySelector('.fl-dix') }])));
const remplir = async (p, vols, reglages = []) => {
  await p.evaluate(async ([avs, vs, rs]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols', 'reglages'], 'readwrite'); for (const a of avs) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
    for (const r of rs) t.objectStore('reglages').put(r);
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVIONS, vols, reglages]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
};
const ouvrir = async (p, id) => { await onglet(p, 'carnet'); await p.click(`.flight[data-id="${id}"] .fl-route`); await p.waitForSelector('#v-saisie:not([hidden])'); };
const enregistrer = async (p, alerte = false) => { await p.click('#f-ok'); await p.waitForTimeout(300); if (await p.isVisible('#tv-modal')) { if (!alerte) throw new Error('alerte R150 inattendue'); await p.click('#tv-ok'); } await p.waitForSelector('#v-carnet:not([hidden])'); };
const sorties = p => p.evaluate(async () => { const e = await import('./js/etat.js'), s = await import('./js/sauvegarde.js'), d = await import('./js/pdf.js'), t = await import('./js/totaux.js');
  const v = [...e.etat.vols].reverse(); return JSON.stringify({ csv: s.texteTableur(v, e.etat.avions, e.listeDesCompteurs()).split('\n').map(l => l.split(';').slice(0, -2).join(';')),
    pdf: d.paginer(v, e.etat.avions).map(pg => [pg.totalPage, pg.cumul]), tot: t.calculerTotaux(v, e.etat.avions, '2026-12-31'), haut: document.getElementById('h-total').textContent }); });
const typeDx = async (p, code, allume) => {
  await onglet(p, 'plus'); await p.click('#pl-types'); await p.click(`#ty-l [data-ty="${code}"]`); await p.waitForSelector('#te-dx');
  const avant = await p.getAttribute('#te-dx', 'aria-checked');
  if ((avant === 'true') !== allume) await p.click('#te-dx');
  await p.click('#te-ok'); await p.waitForTimeout(300); await p.click('#ou-x'); await onglet(p, 'carnet');
  return avant;
};

try {
  const A = await appareil('A'); await remplir(A.p, VOLS);
  const p = A.p, carnet0 = await etatVols(p), sorties0 = await sorties(p);

  console.log('R165 retiré : plus de réglage « Format Tps de Vol »');
  await onglet(p, 'plus');
  verifier(!(await p.$('#pl-format')) && !(await p.textContent('#v-plus')).includes('Format Tps de Vol'), 'Mes réglages : plus de « Format Tps de Vol »');

  console.log('R164 : accueil, dixièmes pour les types Dash 8 et CL2T seulement');
  await onglet(p, 'carnet');
  let b = await blocs(p);
  verifier(b.d84.t === '1.4' && b.d86.t === '1.4' && b.d87.t === '1.5' && b.d14.t === '0.2' && b.d128.t === '2.1', 'DH8D : 1h24 -> 1.4 ; 1h26 -> 1.4 ; 1h27 -> 1.5 ; 0h14 -> 0.2 ; 2h08 -> 2.1 (point, même cadre)');
  verifier(b.cl84.t === '1.4' && b.dr84.t === '1h24', 'CL2T : 1.4 ; DR40 (autre type) : 1h24');
  verifier(b.d128.chips.includes('IFR 1.8') && b.nuit14.chips.includes('Nuit 0.2') && b.dr84.chips.includes('IFR 1h18') && b.dr84.chips.includes('Nuit 0h14'), 'bulles : « IFR 1.8 », « Nuit 0.2 » (DH8D) ; « IFR 1h18 », « Nuit 0h14 » (DR40)');
  verifier(Object.values(b).every(x => !x.dix), 'plus de petit temps à gauche (R161)');
  const total = (await p.textContent('#h-total')).replace(/\s/g, ''), attenduH = await p.evaluate(async t => (await import('./js/temps.js')).hm(t).replace(/\s/g, ''), VOLS.reduce((s, v) => s + v.tempsTotal, 0));
  verifier(total === attenduH && (await p.textContent('#h-quick')).includes('h'), `TOTAL HdV ${total} et 3 / 7 / 30 jours en heures et minutes (comme en v0.66)`);
  for (const largeur of [360, 393]) {
    await p.setViewportSize({ width: largeur, height: 852 }); await p.waitForTimeout(250);
    const pb = await p.$$eval('#list .flight', l => l.filter(c => c.scrollWidth > c.clientWidth + 1 || [...c.querySelectorAll('.chip,.fl-bloc')].some(x => x.getBoundingClientRect().right > c.getBoundingClientRect().right + 0.5)).map(c => c.dataset.id));
    verifier(!pb.length && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${largeur} px : rien ne déborde`);
    await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: join(CAPT, `v067-accueil-${largeur}.png`) });
  }

  console.log('R163 : att. de nuit sans temps de nuit');
  verifier(await p.isVisible('.flight[data-id="r163"] .fl-an') && (await p.textContent('#an-n')) === '1 vol à vérifier', '« ! » sur le vol et bouton jaune');
  await ouvrir(p, 'r163');
  verifier((await p.textContent('#an-l')).includes('Att. de nuit sans temps de nuit'), 'cadre « Anomalie détectée » : « Att. de nuit sans temps de nuit »');
  await p.click('#an-ign'); await p.waitForTimeout(200); await p.click('#cancel'); await p.waitForSelector('#v-carnet:not([hidden])');
  verifier(await p.isHidden('.flight[data-id="r163"] .fl-an'), '« Ignorer » : le « ! » disparaît');

  console.log('R164 : fiche du vol');
  await ouvrir(p, 'nuit14');
  verifier(await p.inputValue('#c-nuit') === '0.2' && await p.textContent('#f-bloc') === '1.0' && (await p.textContent('#r-tot')) === '1.0' && await p.inputValue('#c-fn') === '1.0',
    'DH8D : nuit 0.2, temps 1.0, « Temps du carnet » en dixièmes');
  const heures = await p.inputValue('#f-t1'); await p.click('#cancel'); await p.waitForSelector('#v-carnet:not([hidden])');
  verifier(/^\d\dh\d\d$/.test(heures), `heures de bloc inchangées (${heures})`);
  await ouvrir(p, 'dr84');
  verifier(await p.textContent('#f-bloc') === '1h24' && await p.inputValue('#c-nuit') === '0h14' && await p.inputValue('#c-ifr') === '1h18', 'DR40 : 1h24, nuit 0h14, IFR 1h18');
  await p.click('#cancel'); await p.waitForSelector('#v-carnet:not([hidden])');
  await ouvrir(p, 'nuit14'); await p.click('#f-edit'); await p.fill('#f-rem', 'REMARQUE'); await enregistrer(p);
  verifier((await volDe(p, 'nuit14')).tempsNuit === 14, 'enregistré sans toucher la nuit : 14 min gardées (pas 12)');
  await ouvrir(p, 'nuit14'); await p.click('#f-edit'); await p.fill('#c-nuit', '0.2'); await enregistrer(p);
  verifier((await volDe(p, 'nuit14')).tempsNuit === 12, 'nuit tapée « 0.2 » : 12 min enregistrées');
  await ouvrir(p, 'nuit14'); await p.click('#f-edit'); await p.fill('#c-nuit', '0,3'); await enregistrer(p);
  verifier((await volDe(p, 'nuit14')).tempsNuit === 18, '« 0,3 » (virgule du clavier) : 18 min');
  await ouvrir(p, 'groupe'); await p.click('#f-edit');
  verifier(await p.inputValue('#f-bloc-in') === '1.5', 'vol groupé : temps saisi affiché 1.5');
  await p.fill('#f-bloc-in', '1.4'); await p.waitForTimeout(100); await p.click('#f-ok'); await p.waitForTimeout(300);
  const alerte = (await p.textContent('#tv-txt')).trim();
  verifier(alerte.startsWith('Temps de vol modifié : 1h30 → 1h24 (−0h06). Ton total HdV passe de'), `alerte R150 en heures et minutes : « ${alerte} »`);
  await p.click('#tv-ok'); await p.waitForSelector('#v-carnet:not([hidden])');
  verifier((await volDe(p, 'groupe')).tempsTotal === 84, 'vol groupé saisi « 1.4 » : 84 min');

  console.log('Interrupteur « Temps en dixièmes » de la fiche du type');
  const avantTypes = await etatVols(p), sortiesAvant = await sorties(p);
  verifier(await typeDx(p, 'DH8D', false) === 'true', 'fiche du type DH8D : « Temps en dixièmes » allumé d\'office ; on l\'éteint');
  b = await blocs(p);
  verifier(b.d84.t === '1h24' && b.d128.chips.includes('IFR 1h48') && b.cl84.t === '1.4', 'DH8D éteint : ses vols repassent en 1h24 (CL2T reste en dixièmes)');
  verifier(await typeDx(p, 'DR40', true) === 'false', 'fiche du type DR40 : éteint d\'office ; on l\'allume');
  b = await blocs(p);
  verifier(b.dr84.t === '1.4' && b.dr84.chips.includes('Nuit 0.2'), 'DR40 allumé : ses vols passent en dixièmes');
  await ouvrir(p, 'dr84'); verifier(await p.inputValue('#c-nuit') === '0.2', 'fiche du vol DR40 en dixièmes'); await p.click('#cancel'); await p.waitForSelector('#v-carnet:not([hidden])');
  verifier(await etatVols(p) === avantTypes, 'aucun vol modifié par les interrupteurs');
  const sortiesApres = await sorties(p);
  verifier(sortiesApres === sortiesAvant, 'totaux, haut de l\'accueil, PDF et CSV identiques avec ou sans interrupteurs');
  verifier(JSON.parse(sortiesApres).csv.some(l => l.includes(';1:24;')) && !JSON.parse(sortiesApres).csv.some(l => /;\d+\.\d;/.test(l)), 'CSV en heures et minutes');

  console.log('Synchro A -> B (et ancien réglage « Format Tps de Vol » ignoré)');
  await rejoindre(p, 'ref'); await actualiser(p);
  nas.rev++; nas.el.set('reglages/formatTemps', { rev: nas.rev, supprime: false, donnees: { cle: 'formatTemps', valeur: 'dixieme' }, appareil: 'tel-ancien', le: new Date().toISOString() });
  const B = await appareil('B'); await rejoindre(B.p, 'mod');
  const bb = await blocs(B.p);
  verifier(bb.d84.t === '1h24' && bb.dr84.t === '1.4' && bb.cl84.t === '1.4', 'B : mêmes réglages des types (DH8D éteint, DR40 et CL2T allumés)');
  verifier((await B.p.evaluate(async () => (await import('./js/etat.js')).reglage('formatTemps'))) === undefined && (await B.p.textContent('#h-total')).includes('h'), 'ancien réglage « Format Tps de Vol » reçu : ignoré (rien de changé)');
  const C = await appareil('C');
  const sv = JSON.parse(await p.evaluate(async () => { const e = await import('./js/etat.js'), s = await import('./js/sauvegarde.js'); return JSON.stringify(s.creerSauvegarde(await e.contenuComplet())); }));
  sv.reglages.push({ cle: 'formatTemps', valeur: 'dixieme' });
  const f = join(CAPT, 'v067-sauvegarde-avec-ancien-reglage.json'); writeFileSync(f, JSON.stringify(sv));
  await onglet(C.p, 'plus'); await C.p.click('#pl-restore');
  const [ch] = await Promise.all([C.p.waitForEvent('filechooser'), C.p.click('#rs-fichier')]); await ch.setFiles(f); await C.p.waitForSelector('#rs-ok'); await C.p.click('#rs-ok'); await C.p.waitForTimeout(900); await onglet(C.p, 'carnet');
  const cc = await blocs(C.p);
  verifier(cc.d84.t === '1h24' && cc.dr84.t === '1.4' && (await C.p.textContent('#h-total')).includes('h'), 'sauvegarde restaurée (avec l\'ancien réglage) : réglages des types gardés, ancien réglage sans effet');
  verifier(JSON.stringify(JSON.parse(carnet0).map(x => x[0])) === JSON.stringify(JSON.parse(await etatVols(p)).map(x => x[0])), 'mêmes vols');
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.67 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); faux.closeAllConnections?.(); faux.close(); srv.fermer();
}

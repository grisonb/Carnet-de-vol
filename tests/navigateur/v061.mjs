// v0.61 : R154 rond « reporté sur le carnet papier » (carnet existant : tous reportés ; nouveau vol, vol NPF-Q400 : à reporter ;
// appui sur le rond sans ouvrir le vol ; ligne « À reporter » et filtre ; synchro A -> B, conflit du rond seul : le plus récent
// gagne ; sauvegarde / restauration, ancienne sauvegarde ; 360 / 393 px : aucune bulle sous le rond, zone d'appui ≥ 40 px ;
// PDF, CSV, totaux inchangés). Carnet INVENTÉ, FAUX NAS v5 (+ vols NPF), aucun serveur extérieur.
// Usage : node tests/navigateur/v061.mjs
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
// 50 vols inventés « d'avant la mise à jour » (sans l'information) ; quelques-uns chargés de bulles (feu, IFR, nuit, compteurs)
const VOLS = Array.from({ length: 50 }, (_, k) => {
  const j = String(1 + (k % 28)).padStart(2, '0'), mois = k < 28 ? '09' : '10', charge = k % 5 === 0;
  return { id: `v${k + 1}`, date: `2026-${mois}-${j}`, hDep: '10:00', hArr: '11:30', mode: 'utc', dep: 'LFTW', arr: k % 3 ? 'LFTW' : 'LFML', escales: [], avionId: 'a1',
    tempsTotal: 90, tempsMP: null, tempsSE: null, tempsME: null, tempsCdB: 90, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: charge ? 'ABC' : '', nomInstructeur: '',
    nomExaminateur: '', missions: charge ? ['FEU n°' + (k + 1) + ' ESSAI'] : [], remarques: '', feux: charge ? 1 : 0, compteurs: { ...C0, ...(charge ? { largCdbDash: 3, largInstrCdbDash: 1 } : {}) },
    etiquettes: [], attJour: charge ? 3 : 1, attNuit: charge ? 1 : 0, approches: charge ? 2 : 0, tempsIFR: charge ? 30 : 0, tempsNuit: charge ? 20 : 0, simTemps: 0,
    source: 'saisie', ordre: Date.parse(`2026-${mois}-${j}T10:00Z`) + k, creeLe: H, modifieLe: H };
});
const npf = { format: 'carnet-vol-npf', version: 1, id: 'npf-essai-61', exporteLe: '2026-11-20T10:00:00Z', date: '2026-11-19', blocDepart: '13:05', blocArrivee: '14:40',
  immat: 'F-XZZA', depart: 'LFTW', arrivee: 'LFML' };

// ---------- Faux NAS v5 (synchro + vols NPF) ----------
const srv = await serveur();
const nas = { mdp: 'mot-de-passe-essai-61', rev: 0, el: new Map(), npf: new Map([[npf.id, npf]]) };
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
// v0.66 (R162) : plus de ligne « À reporter sur le carnet » : on compte les vols à reporter dans le carnet, et la ligne ne doit plus exister
const aReporter = p => p.evaluate(async () => (await import('./js/report.js')).nbAReporter((await import('./js/etat.js')).etat.vols));
const sansLigne = p => p.evaluate(() => !document.getElementById('rep-ligne') && ![...document.querySelectorAll('#v-carnet button')].some(b => /reporter/i.test(b.textContent)));
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

try {
  const A = await appareil('A');
  const version = await A.p.evaluate(async () => (await import('./js/version.js')).VERSION);
  verifier(Number(version.split('.')[1]) >= 61, `version ${version} (0.61 ou suivante)`);
  const t0 = await totaux(A.p);
  const csv0 = await A.p.evaluate(async () => { const s = await import('./js/sauvegarde.js'), e = await import('./js/etat.js'); return s.texteTableur([...e.etat.vols].reverse(), e.etat.avions, e.listeDesCompteurs()); });
  const pdf0 = await A.p.evaluate(async () => { const p = await import('./js/pdf.js'), e = await import('./js/etat.js'); return JSON.stringify(p.totauxPDF(e.etat.vols, e.etat.avions)); });

  console.log('Carnet existant de 50 vols : tous reportés');
  await tousLesVols(A.p);
  let r = await ronds(A.p);
  verifier(r.n === 50 && r.verts === 50, `50 ronds verts (${r.verts} verts, ${r.vides} vides)`);
  verifier(await aReporter(A.p) === 0 && await sansLigne(A.p), 'aucun vol à reporter, aucune ligne « À reporter »');
  verifier((await vols(A.p)).every(v => !('aReporter' in v) && v.modifieLe === H), 'aucun vol réécrit (pas de nouveau champ, même date d\'enregistrement)');
  const style = await A.p.evaluate(() => { const c = document.querySelector('#list .fl-rep .rond') /* v0.69 : le rond (le cercle noir des frais est à part) */, s = getComputedStyle(c), coche = getComputedStyle(document.querySelector('#list .fl-rep path'));
    return { w: c.getBoundingClientRect().width + parseFloat(s.strokeWidth), b: s.strokeWidth, fond: s.fill, coche: coche.stroke }; });
  verifier(style.w === 16 && style.b === '1.5px' && style.fond === 'rgb(46, 125, 50)' && style.coche === 'rgb(255, 255, 255)', `rond 16 px, trait ${style.b}, vert plein (${style.fond}) avec ✓ blanc`);

  for (const largeur of [360, 393]) {
    await A.p.setViewportSize({ width: largeur, height: 852 }); await A.p.waitForTimeout(250);
    const m = await mesureRonds(A.p);
    const pb = m.filter(x => x.l < 40 || x.h < 40 || !x.dedans || x.sous.length);
    verifier(m.length >= 40 && !pb.length, `${largeur} px : ${m.length} cartes, zone d'appui ${m[0].l} × ${m[0].h} px dans la carte, aucune bulle ni texte sous le rond${pb.length ? ' — ' + JSON.stringify(pb.slice(0, 2)) : ''}`);
    await A.p.evaluate(() => scrollTo(0, 0)); await A.p.screenshot({ path: join(CAPT, `v061-accueil-${largeur}.png`) });
  }

  console.log('Nouveau vol saisi : à reporter');
  await A.p.click('#fab'); await A.p.waitForSelector('#v-saisie:not([hidden])'); await A.p.click('#tz-utc');
  await A.p.fill('#f-t0', ''); await A.p.type('#f-t0', '1400'); await A.p.type('#f-t1', '1500');
  await A.p.click('#f-ok'); await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(400);
  const nouveau = (await vols(A.p)).find(v => !v.id.startsWith('v'));
  verifier(nouveau && nouveau.aReporter === true, 'vol enregistré avec « à reporter »');
  verifier(await rond(A.p, nouveau.id).getAttribute('aria-checked') === 'false', 'rond vide sur sa carte');
  verifier(await aReporter(A.p) === 1 && await sansLigne(A.p), '1 vol à reporter, et pas de ligne « À reporter » (v0.66, R162)');
  await A.p.screenshot({ path: join(CAPT, 'v061-a-reporter.png') });
  await rond(A.p, nouveau.id).click(); await A.p.waitForTimeout(400);
  verifier(await A.p.isVisible('#v-carnet') && await A.p.isHidden('#v-saisie'), 'appui sur le rond : le vol ne s\'ouvre pas');
  verifier(await rond(A.p, nouveau.id).getAttribute('aria-checked') === 'true' && !(await volDe(A.p, nouveau.id)).aReporter && await aReporter(A.p) === 0,
    'rond vert, plus de vol à reporter');
  verifier(await A.p.isHidden('#tv-modal'), 'pas d\'alerte « Temps de vol modifié »');
  await rond(A.p, nouveau.id).click(); await A.p.waitForTimeout(300);
  verifier((await volDe(A.p, nouveau.id)).aReporter === true && await aReporter(A.p) === 1, 'nouvel appui : de nouveau à reporter');
  await A.p.click(`.flight[data-id="${nouveau.id}"] .fl-route`); await A.p.waitForSelector('#v-saisie:not([hidden])');
  verifier(await A.p.isVisible('#v-saisie'), 'appui sur le vol (hors rond) : le vol s\'ouvre');
  await A.p.click('#cancel'); await A.p.waitForSelector('#v-carnet:not([hidden])');

  console.log('Vol importé de NPF-Q400 (faux NAS) : à reporter');
  await rejoindre(A.p, 'ref'); await actualiser(A.p);
  await A.p.waitForSelector('#npf-bandeau:not([hidden])', { timeout: 15000 });
  await A.p.click('#npf-bandeau'); await A.p.waitForSelector('#npf-l'); await A.p.click('#npf-l .npfv >> nth=0'); await A.p.waitForSelector('#v-saisie:not([hidden])'); await A.p.waitForTimeout(400);
  await A.p.click('#f-ok'); await A.p.waitForSelector('#v-carnet:not([hidden])'); await A.p.waitForTimeout(500);
  const vNpf = (await vols(A.p)).find(v => v.npfId === npf.id);
  verifier(vNpf && vNpf.aReporter === true && await rond(A.p, vNpf.id).getAttribute('aria-checked') === 'false', 'vol NPF-Q400 enregistré : rond vide');
  verifier(await aReporter(A.p) === 2 && await sansLigne(A.p), '2 vols à reporter (v0.66, R162 : ligne et filtre « À reporter » supprimés)');

  console.log('Synchro A -> B, puis décocher sur A');
  await actualiser(A.p);
  const B = await appareil('B', { remplir: false }); await rejoindre(B.p, 'mod');
  verifier((await volDe(B.p, nouveau.id)).aReporter === true && (await volDe(B.p, 'v1')).aReporter === undefined && await aReporter(B.p) === 2, 'B : mêmes états (2 à reporter, les anciens reportés)');
  await rond(A.p, nouveau.id).click(); await A.p.waitForTimeout(300); await actualiser(A.p);
  await rond(A.p, 'v50').scrollIntoViewIfNeeded(); await rond(A.p, 'v50').click(); await A.p.waitForTimeout(300); await actualiser(A.p); // ancien vol décoché sur A
  await actualiser(B.p);
  verifier(!(await volDe(B.p, nouveau.id)).aReporter && (await volDe(B.p, 'v50')).aReporter === true && await aReporter(B.p) === 2, 'B : coché / décoché comme sur A');
  // le rond changé des deux côtés avant la synchro : le plus récent gagne, sans conflit à choisir
  await A.ctx.setOffline(true);
  await rond(A.p, vNpf.id).click(); await A.p.waitForTimeout(300);           // A : coché
  await B.p.waitForTimeout(50); await rond(B.p, vNpf.id).click(); await B.p.waitForTimeout(300); // B : coché aussi, plus tard
  await rond(B.p, vNpf.id).click(); await B.p.waitForTimeout(300);           // B : décoché (le plus récent)
  await actualiser(B.p); await A.ctx.setOffline(false); await actualiser(A.p); await actualiser(B.p);
  const conflits = X => X.p.evaluate(async () => ((await import('./js/etat.js')).reglage('synchroEtat')?.conflits || []).length);
  verifier((await volDe(A.p, vNpf.id)).aReporter === true && (await volDe(B.p, vNpf.id)).aReporter === true && await conflits(A) === 0 && await conflits(B) === 0,
    'rond changé des deux côtés : le plus récent (B, « à reporter ») gagne sur A et B, aucun conflit à choisir');

  console.log('Sauvegarde, restauration, ancienne sauvegarde');
  await onglet(A.p, 'plus'); await A.p.click('#pl-save');
  const [dl] = await Promise.all([A.p.waitForEvent('download'), A.p.click('#sv-dl')]);
  const fichierSv = join(CAPT, 'v061-sauvegarde.json'); writeFileSync(fichierSv, readFileSync(await dl.path())); await A.p.click('#ou-x'); await onglet(A.p, 'carnet');
  const etatA = (await vols(A.p)).map(v => [v.id, !!v.aReporter]).sort().join();
  const C = await appareil('C', { remplir: false });
  const restaurer = async f => { await onglet(C.p, 'plus'); await C.p.click('#pl-restore');
    const [ch] = await Promise.all([C.p.waitForEvent('filechooser'), C.p.click('#rs-fichier')]); await ch.setFiles(f); await C.p.waitForSelector('#rs-ok'); await C.p.click('#rs-ok'); await C.p.waitForTimeout(900); await onglet(C.p, 'carnet'); };
  await restaurer(fichierSv);
  verifier((await vols(C.p)).map(v => [v.id, !!v.aReporter]).sort().join() === etatA && await aReporter(C.p) === await aReporter(A.p), `C restauré : même état que A (${await aReporter(C.p)} à reporter)`);
  const ancienne = JSON.parse(readFileSync(fichierSv, 'utf8'));
  const sans = o => { if (Array.isArray(o)) return o.map(sans); if (o && typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) if (k !== 'aReporter' && k !== 'reporteLe') r[k] = sans(v); return r; } return o; };
  const fAncienne = join(CAPT, 'v061-ancienne-sauvegarde.json'); writeFileSync(fAncienne, JSON.stringify(sans(ancienne)));
  await restaurer(fAncienne);
  verifier((await vols(C.p)).every(v => !v.aReporter) && await aReporter(C.p) === 0, 'ancienne sauvegarde (sans l\'information) : tous les vols reportés');

  console.log('PDF, CSV, totaux');
  const vA = await vols(A.p), anciens = vA.filter(v => v.id.startsWith('v'));
  const t1 = await A.p.evaluate(async ids => { const t = await import('./js/totaux.js'), e = await import('./js/etat.js'); return JSON.stringify(t.calculerTotaux(e.etat.vols.filter(v => ids.includes(v.id)), e.etat.avions, '2026-12-31')); }, anciens.map(v => v.id));
  const csv1 = await A.p.evaluate(async ids => { const s = await import('./js/sauvegarde.js'), e = await import('./js/etat.js'); return s.texteTableur([...e.etat.vols.filter(v => ids.includes(v.id))].reverse(), e.etat.avions, e.listeDesCompteurs()); }, anciens.map(v => v.id));
  const pdf1 = await A.p.evaluate(async ids => { const p = await import('./js/pdf.js'), e = await import('./js/etat.js'); return JSON.stringify(p.totauxPDF(e.etat.vols.filter(v => ids.includes(v.id)), e.etat.avions)); }, anciens.map(v => v.id));
  verifier(t1 === t0 && csv1 === csv0 && pdf1 === pdf0, 'les 50 vols (dont un décoché) : totaux, CSV et PDF identiques à avant');
  verifier(!/report/i.test(csv1.split(/\r?\n/)[0]), 'CSV : aucune colonne « reporté »');

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur (ni vrai NAS, ni VPS, ni Google)' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.61 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); faux.closeAllConnections?.(); faux.close(); srv.fermer();
}

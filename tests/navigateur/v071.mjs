// v0.71 : R179 un seul titre par mois sur l'accueil (liste complète, liste ouverte sur un vol ancien puis remontée, recherche, vols de
// soirée en heure locale) ; R180 décocher un vol seul ; R181 J.1 coche J.2 le lendemain ; R182 bandeau fixe et boutons ronds brillants ;
// R183 modifications sans le crayon -> Valider (Fermer abandonne) ; rond papier de l'accueil instantané ; 360 / 393 px ; totaux et PDF
// EASA inchangés. Carnet INVENTÉ (plusieurs centaines de vols), aucun serveur extérieur. Usage : node tests/navigateur/v071.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2025-10-01T08:00:00Z';
const AVIONS = [{ id: 'a1', immat: 'F-XZZA', typeOACI: 'DH8D', modele: 'Dash 8 Q400 MR', constructeur: 'ESSAI', nom: '', indicatif: '', equipage: 'MP', moteurs: 'ME', moteur: 'T',
  surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', hexAdsb: '', creeLe: H, modifieLe: H }];
const C0 = { largCdbDash: 0, largInstrCdbDash: 0, largCopiDash: 0, largCopiCL: 0, ecopages: 0, amerrCL: 0, amerrSEP: 0, largPara: 0 };
const vol = (id, date, dep, arr, h, champs = {}) => ({ id, date, hDep: h, hArr: `${String((+h.slice(0, 2) + 1) % 24).padStart(2, '0')}${h.slice(2)}`, mode: 'utc', dep, arr, escales: [], avionId: 'a1',
  tempsTotal: 60, tempsMP: null, tempsSE: null, tempsME: null, tempsCdB: 60, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: '', nomInstructeur: '', nomExaminateur: '', missions: [],
  remarques: '', feux: 0, compteurs: { ...C0 }, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie',
  ordre: Date.parse(`${date}T${h}Z`), creeLe: H, modifieLe: H, ...champs });
const jour = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
// Plusieurs centaines de vols de janvier à octobre 2024 : 1 à 3 vols par jour, certains en heure locale le soir (22h30 UTC le dernier
// jour du mois = le 1er du mois suivant à Paris : la carte montre la date locale)
const VOLS = [];
for (let i = 0; i < 300; i++) {
  const d = jour('2024-01-02', i), n = 1 + (i % 3);
  for (let k = 0; k < n; k++) VOLS.push(vol(`m${i}-${k}`, d, 'LFTW', k === 1 ? 'LFML' : 'LFTW', `${String(7 + 3 * k).padStart(2, '0')}:00`, i === 150 && k === 0 ? { remarques: 'CIBLE ESSAI' } : {}));
  if (jour(d, 1).slice(8) === '01') VOLS.push(vol(`soir${i}`, d, 'LFTW', 'LFTW', '22:30', { mode: 'loc' })); // dernier jour du mois, le soir
}
const FRAIS = [
  vol('c1', '2025-12-03', 'LFTW', 'LFTH', '07:00'), vol('c2', '2025-12-03', 'LFTH', 'LFPB', '10:00'), vol('c3', '2025-12-03', 'LFPB', 'LFTW', '14:00'),
  vol('a1', '2025-11-17', 'LFTW', 'LFTH', '07:00'), vol('a2', '2025-11-17', 'LFTH', 'LFPB', '10:00'),
  vol('b1', '2025-11-18', 'LFPB', 'LFRN', '07:00'), vol('b2', '2025-11-18', 'LFRN', 'LEMD', '09:00', { frais: { type: 'journee', le: H } }),
  vol('b3', '2025-11-18', 'LEMD', 'LFPB', '12:00'), vol('b4', '2025-11-18', 'LFPB', 'LFTW', '15:00'),
  vol('f1', '2025-10-20', 'LFTW', 'LFML', '07:00', { remarques: 'FICHE ESSAI' }),
];

const srv = await serveur();
const { chromium } = playwright();
const nav = await chromium.launch();
const bloquees = [], erreurs = [];
const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
const p = await ctx.newPage();
p.on('pageerror', e => erreurs.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/i.test(m.text())) erreurs.push(m.text()); });
const onglet = v => p.click(`.tabs button[data-v="${v}"]`);
const vols = () => p.evaluate(async () => Object.fromEntries((await import('./js/etat.js')).etat.vols.map(v => [v.id, v])));
const types = async ids => { const v = await vols(); return Object.fromEntries(ids.map(id => [id, (v[id].frais && v[id].frais.type) || null])); };
const ouvrir = async id => { await onglet('carnet'); await p.click(`.flight[data-id="${id}"] .fl-route`); await p.waitForSelector('#v-saisie:not([hidden])'); };
const fermer = async () => { await p.click('#cancel'); await p.waitForSelector('#v-carnet:not([hidden])'); };
const valider = async () => { await p.click('#f-ok'); await p.waitForTimeout(250); };
const cocher = async (id, t) => { await ouvrir(id); await p.click(`#fe-zone [data-fe="${t}"]`); await p.waitForTimeout(150); await valider(); await fermer(); };
const lignesFrais = () => p.evaluate(async () => (await import('./js/ui/frais.js')).lignesActuelles().map(x => ({ id: x.id, vols: x.vols.map(v => v.id) })));
// Titres de mois de la liste : nombre, doublons, et chaque carte sous le titre de SON mois (date montrée sur la carte)
const titres = () => p.evaluate(async () => {
  const { dateAffichee } = await import('./js/ui/carnet.js'), { etat } = await import('./js/etat.js'), { MOIS } = await import('./js/temps.js'), par = new Map(etat.vols.map(v => [v.id, v]));
  // le titre tel qu'il est écrit (« mars 2025 ») ; chaque carte doit être sous le titre du mois de la date qu'elle montre
  const libelle = m => `${MOIS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`.toLowerCase();
  let courant = null, mal = 0, cartes = 0; const vus = [], mois = new Set();
  for (const e of document.querySelector('#list').children) {
    if (e.matches('h3.month')) { courant = e.textContent.trim().toLowerCase(); vus.push(courant); continue; }
    const c = e.querySelector('.flight'); if (!c) continue;
    cartes++; const m = dateAffichee(par.get(c.dataset.id)).slice(0, 7); mois.add(m); if (libelle(m) !== courant) mal++;
  }
  return { n: vus.length, doublons: vus.length - new Set(vus).size, mois: mois.size, mal, cartes };
});
const toutCharger = async () => { for (let k = 0; k < 80; k++) { await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(60); } };
const toutRemonter = async () => { for (let k = 0; k < 80; k++) { await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(60); if (await p.isHidden('#list-debut')) break; } };
const carnetEASA = () => p.evaluate(async () => { const e = await import('./js/etat.js'), t = await import('./js/totaux.js'), d = await import('./js/pdf.js');
  const v = [...e.etat.vols].reverse(); return JSON.stringify([t.calculerTotaux(v, e.etat.avions, '2026-12-31'), d.paginer(v, e.etat.avions).map(x => [x.totalPage, x.cumul])]); });

try {
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.evaluate(async ([avs, vs]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols'], 'readwrite'); for (const a of avs) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVIONS, [...VOLS, ...FRAIS]]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  verifier(Number((await p.evaluate(async () => (await import('./js/version.js')).VERSION)).split('.')[1]) >= 71, 'version 0.71 ou suivante');
  const easa0 = await carnetEASA();

  console.log(`R179 : un seul titre par mois (${VOLS.length + FRAIS.length} vols inventés)`);
  await toutCharger();
  let t = await titres();
  verifier(t.cartes === VOLS.length + FRAIS.length && t.n === t.mois && !t.doublons && !t.mal, `liste complète : ${t.n} titres pour ${t.mois} mois, ${t.cartes} cartes, chaque carte sous son mois`);
  const soir = await p.evaluate(async () => { const { dateAffichee } = await import('./js/ui/carnet.js'), { etat } = await import('./js/etat.js'); const v = etat.vols.find(x => x.id.startsWith('soir')); return [v.date, dateAffichee(v)]; });
  verifier(soir[0].slice(0, 7) !== soir[1].slice(0, 7), `vol de soirée en heure locale : ${soir[0]} UTC, montré le ${soir[1]} (sous le titre du mois montré)`);
  // liste ouverte sur un vol ancien (« Voir dans le carnet »), puis remontée jusqu'en haut : les vols plus récents s'ajoutent au-dessus
  await p.evaluate(() => scrollTo(0, 0));
  await p.click('#q-open'); await p.fill('#q', 'CIBLE'); await p.waitForTimeout(400);
  t = await titres();
  verifier(t.n === 1 && !t.mal, 'recherche : un seul titre');
  await p.click('#list .flight[data-id="m150-0"] [data-voir]'); await p.waitForTimeout(600);
  verifier(await p.isVisible('#list-debut'), 'liste ouverte sur le vol cherché (vols plus récents pas encore affichés)');
  await toutRemonter(); await toutCharger();
  t = await titres();
  verifier(t.n === t.mois && !t.doublons && !t.mal && t.cartes === VOLS.length + FRAIS.length, `après remontée : ${t.n} titres pour ${t.mois} mois, aucun en double`);
  // retour d'un vol ouvert loin dans la liste (la liste reprend à sa place)
  await p.locator('#list .flight[data-id="m40-0"] .fl-route').scrollIntoViewIfNeeded(); await p.click('#list .flight[data-id="m40-0"] .fl-route'); await p.waitForSelector('#v-saisie:not([hidden])');
  await fermer(); await toutRemonter(); await toutCharger();
  t = await titres();
  verifier(t.n === t.mois && !t.doublons && !t.mal, `retour d'un vol ancien : ${t.n} titres pour ${t.mois} mois`);
  // avec un filtre (recherche texte : les vols vers LFML)
  await p.evaluate(() => scrollTo(0, 0)); await p.click('#q-open').catch(() => {}); await p.fill('#q', 'LFML'); await p.waitForTimeout(400); await toutCharger();
  t = await titres();
  verifier(t.cartes > 100 && t.n === t.mois && !t.doublons && !t.mal, `filtre « LFML » : ${t.cartes} vols, ${t.n} titres pour ${t.mois} mois`);
  await p.fill('#q', ''); await p.waitForTimeout(300); await p.evaluate(() => scrollTo(0, 0));
  for (const largeur of [360, 393]) { await p.setViewportSize({ width: largeur, height: 852 }); await p.waitForTimeout(150); await p.screenshot({ path: join(CAPT, `v071-accueil-${largeur}.png`) }); }
  await p.setViewportSize({ width: 393, height: 852 });
  const q = await p.$('#q'); if (q && await q.isVisible()) await p.fill('#q', '');

  console.log('R180 : décocher un vol seul');
  await cocher('c1', 'journee');
  verifier(JSON.stringify(await types(['c1', 'c2', 'c3'])) === '{"c1":"journee","c2":"journee","c3":"journee"}', 'VOL JOURNÉE coché sur un vol : les trois vols du jour');
  await cocher('c2', 'journee');
  verifier(JSON.stringify(await types(['c1', 'c2', 'c3'])) === '{"c1":"journee","c2":null,"c3":"journee"}', 'décocher le 2e : les deux autres restent');
  let l = (await lignesFrais()).find(x => x.id === 'journee|2025-12-03');
  verifier(l && JSON.stringify(l.vols.sort()) === '["c1","c3"]', 'la ligne n\'a que les deux vols cochés');
  await cocher('c1', 'journee'); await cocher('c3', 'journee');
  verifier(!(await lignesFrais()).some(x => x.id === 'journee|2025-12-03'), 'plus aucun vol coché : la ligne disparaît');
  await cocher('c3', 'journee');
  verifier(JSON.stringify(await types(['c1', 'c2', 'c3'])) === '{"c1":null,"c2":null,"c3":"journee"}', 'vols décochés à la main : pas recochés tout seuls');

  console.log('R181 : J.1 coche J.2 le lendemain');
  await cocher('a1', 'j1');
  verifier(JSON.stringify(await types(['a1', 'a2', 'b1', 'b2', 'b3', 'b4'])) === '{"a1":"j1","a2":"j1","b1":"j2","b2":"journee","b3":"j2","b4":"j2"}', 'J.1 le 17 : J.2 tout seul sur les vols du 18, le vol déjà en VOL JOURNÉE le reste');
  await cocher('b3', 'j2');
  verifier(JSON.stringify(await types(['b1', 'b2', 'b3', 'b4'])) === '{"b1":"j2","b2":"journee","b3":null,"b4":"j2"}', 'un J.2 décoché seul');
  await cocher('a1', 'j1'); await cocher('a2', 'j1');
  verifier(JSON.stringify(await types(['a1', 'a2', 'b1', 'b2', 'b3', 'b4'])) === '{"a1":null,"a2":null,"b1":null,"b2":"journee","b3":null,"b4":null}', 'J.1 décoché sur toute la journée : les J.2 mis tout seuls retirés');

  console.log('R182 : bandeau fixe et boutons ronds brillants');
  const bandeau = () => p.evaluate(() => {
    const b = id => { const e = document.getElementById(id), r = e.getBoundingClientRect(), s = getComputedStyle(e); return { vis: !!e.offsetParent, l: Math.round(r.width), h: Math.round(r.height), rond: s.borderRadius === '50%', fond: s.backgroundImage, haut: Math.round(r.top) }; };
    const h = document.querySelector('#v-saisie .formhead').getBoundingClientRect();
    return { x: b('cancel'), crayon: b('f-edit'), ok: b('f-ok'), titre: document.getElementById('f-title').textContent, haut: Math.round(h.top), bas: Math.round(h.bottom),
      lecture: document.getElementById('v-saisie').classList.contains('lecture'), deborde: document.documentElement.scrollWidth > innerWidth };
  });
  for (const largeur of [360, 393]) {
    await p.setViewportSize({ width: largeur, height: 852 }); await ouvrir('f1');
    await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(200);
    const b = await bandeau();
    verifier(b.haut <= 1 && b.bas > 40 && b.x.vis && b.crayon.vis && !b.ok.vis && b.titre === 'Vol', `${largeur} px : défilé jusqu'en bas, bandeau toujours en haut (Fermer, « Vol », crayon)`);
    verifier([b.x, b.crayon].every(x => x.rond && x.l >= 48 && x.h >= 48) && b.x.fond.includes('240, 58, 43') && b.crayon.fond.includes('47, 143, 224') && !b.deborde,
      `${largeur} px : Fermer rouge et crayon bleu, ronds brillants de ${b.x.l} px, rien ne déborde`);
    await p.screenshot({ path: join(CAPT, `v071-bandeau-lecture-${largeur}.png`) });
    await p.click('#f-edit'); await p.waitForTimeout(150);
    const e = await bandeau();
    verifier(!e.lecture && !e.crayon.vis && e.ok.vis && e.ok.rond && e.ok.l >= 48 && e.ok.fond.includes('63, 194, 43') && e.titre === 'Modifier le vol', `${largeur} px : crayon -> rond vert avec une coche, titre « Modifier le vol »`);
    await p.screenshot({ path: join(CAPT, `v071-bandeau-modifier-${largeur}.png`) });
    await p.fill('#f-rem', `FICHE ${largeur}`); await valider();
    const apres = await bandeau();
    verifier(apres.lecture && apres.titre === 'Vol' && apres.crayon.vis && await p.isVisible('#v-saisie') && (await vols()).f1.remarques === `FICHE ${largeur}`, `${largeur} px : Valider : enregistré, retour au vol en lecture`);
    await fermer();
  }
  await p.setViewportSize({ width: 393, height: 852 });
  await ouvrir('f1'); await p.click('#f-edit'); await p.fill('#f-rem', 'NE PAS GARDER'); await p.click('#cancel');
  verifier(await p.isVisible('#ab-modal'), 'Fermer après une modification au crayon : « Abandonner la saisie ? »');
  await p.click('#ab-yes'); await p.waitForSelector('#v-carnet:not([hidden])');
  verifier((await vols()).f1.remarques === 'FICHE 393', 'abandonné : rien d\'enregistré');

  console.log('R183 : modification sans le crayon');
  await ouvrir('f1'); await p.click('#fe-zone [data-fe="journee"]'); await p.waitForTimeout(150);
  let b = await bandeau();
  verifier(b.lecture && b.ok.vis && !b.crayon.vis && b.titre === 'Modifier le vol' && !(await vols()).f1.frais, 'VOL JOURNÉE coché sans le crayon : bouton vert Valider, rien d\'enregistré');
  await p.click('#cancel');
  verifier(await p.isVisible('#v-carnet') && await p.isHidden('#ab-modal') && !(await vols()).f1.frais, 'Fermer : sans question, rien d\'enregistré');
  await ouvrir('f1'); verifier(!(await p.$eval('#fe-zone [data-fe="journee"]', x => x.getAttribute('aria-checked') === 'true')), 'rouvert : case pas cochée');
  const modif0 = (await vols()).f1.modifieLe;
  await p.click('#fe-zone [data-fe="journee"]'); await valider();
  b = await bandeau();
  verifier((await vols()).f1.frais.type === 'journee' && b.lecture && b.crayon.vis && !b.ok.vis && (await vols()).f1.modifieLe === modif0, 'Valider : enregistré (« Modifié le » inchangé), retour au crayon');
  await fermer();
  await p.evaluate(() => scrollTo(0, 0));
  const id0 = await p.$eval('#list .flight', c => c.dataset.id);
  const r0 = !!(await vols())[id0].aReporter;
  await p.locator(`.flight[data-id="${id0}"] .fl-rep`).click(); await p.waitForTimeout(250);
  verifier(!!(await vols())[id0].aReporter !== r0 && await p.isHidden('#v-saisie'), `rond papier de l'accueil : instantané (vol ${id0})`);
  await p.locator(`.flight[data-id="${id0}"] .fl-rep`).click(); await p.waitForTimeout(250);

  console.log('R184 : « Du » complète -> curseur dans « Au »');
  const actif = () => p.evaluate(() => document.activeElement && document.activeElement.id);
  // champ texte JJ/MM/AAAA (accueil) : on tape les chiffres ; champ date : on tape jour, mois, année
  const essai = async (du, chiffres) => { await p.fill(du, ''); await p.focus(du); await p.keyboard.type(chiffres, { delay: 15 }); await p.waitForTimeout(150); return actif(); };
  const ENDROITS = [
    ['accueil (filtre de dates)', '#p-du', '#p-au', async () => { await onglet('carnet'); await p.evaluate(() => scrollTo(0, 0)); if (await p.isHidden('#periode')) await p.click('#q-open'); }],
    ['Totaux (Dates)', '#per-du', '#per-au', async () => { await onglet('totaux'); await p.click('#per [data-p="dates"]'); }],
    ['export PDF EASA (Dates)', '#xp-du', '#xp-au', async () => { await onglet('plus'); await p.click('#pl-pdf'); await p.click('#xp-per [data-p="dates"]'); }],
    ['fenêtre Détachement', '#dt-du', '#dt-au', async () => { await ouvrir('f1'); await p.click('#fe-zone [data-fe="detachement"]'); await p.waitForSelector('#dt-modal:not([hidden])'); }],
  ];
  const fin = { 'export PDF EASA (Dates)': () => p.click('#ou-x'), 'fenêtre Détachement': async () => { await p.click('#dt-no'); await fermer(); } };
  for (const largeur of [360, 393]) {
    await p.setViewportSize({ width: largeur, height: 852 });
    for (const [nom, du, au, aller] of ENDROITS) {
      await aller();
      const ok = await essai(du, '01012025'), val = await p.inputValue(du);
      const reste = await essai(du, '010120');
      verifier(ok === au.slice(1) && /2025/.test(val) && reste === du.slice(1), `${largeur} px, ${nom} : 01/01/2025 dans « Du » -> curseur dans « Au » ; 01/01/20 -> le curseur reste dans « Du »`);
      await p.focus(du); verifier(await actif() === du.slice(1), `${largeur} px, ${nom} : on peut revenir dans « Du »`);
      verifier(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${largeur} px, ${nom} : rien ne déborde`);
      if (fin[nom]) await fin[nom]();
    }
  }
  await p.setViewportSize({ width: 393, height: 852 });
  await onglet('carnet'); await p.fill('#p-du', ''); await p.dispatchEvent('#p-du', 'input'); await p.fill('#p-au', ''); await p.dispatchEvent('#p-au', 'input'); await p.waitForTimeout(300);

  verifier(await carnetEASA() === easa0, 'totaux d\'heures et PDF EASA inchangés');
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.71 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); srv.fermer();
}

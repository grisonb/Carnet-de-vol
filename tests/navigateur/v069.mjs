// v0.69 : R169 barèmes officiels 2022 à 2025 dans la fenêtre « Barème » (marques bulletin / modifié / ajouté, recherche, saisie d'avant la
// mise à jour gardée, 2026 vide), choix du pays par les premières lettres ; R167 détachement à cheval sur deux années (deux lignes, même
// détachement) ; R168 toutes les étapes (liste, PDF) ; R170 cercle noir autour du rond des vols avec frais (360 / 393 px : ne touche ni le
// triangle ni les bulles). Carnet INVENTÉ, aucun serveur extérieur. Usage : node tests/navigateur/v069.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { mkdirSync } from 'node:fs';
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
const L = '2026-11-27T08:00:00Z';
const VOLS = [
  vol('jr', '2025-06-14', { frais: { type: 'journee', le: L } }),                                     // vol journée reporté
  vol('jn', '2025-06-15', { frais: { type: 'journee', le: L }, aReporter: true }),                    // vol journée pas encore reporté
  vol('j2a', '2025-07-02', { frais: { type: 'j2', pays: 'France', le: L }, arr: 'LFQQ', escales: [{ code: 'LFML', attJour: 1, attNuit: 0 }], attJour: 2 }),
  vol('j2b', '2025-07-03', { frais: { type: 'j2', le: L }, dep: 'LFQQ', escales: [{ code: 'LFML', attJour: 1, attNuit: 0 }], attJour: 2 }),
  vol('de', '2025-12-30'), vol('de2', '2026-01-02'),                                                  // dans le détachement
  vol('sans', '2025-08-01'),                                                                          // sans frais
  vol('an', '2025-08-05', { frais: { type: 'journee', le: L }, escales: [{ code: 'LFML', attJour: 0, attNuit: 0 }] }), // frais + « ! »
];
// Avant la mise à jour : barème 2025 déjà saisi à la main (Espagne 180,00, vol journée 90,00) ; barème 2026 saisi (France 180,00)
const REGLAGES = [
  { cle: 'bareme-2025', valeur: { annee: '2025', journee: 9000, pays: [{ nom: 'France', montant: 17400, zone: 'euro' }, { nom: 'Espagne', montant: 18000, zone: 'euro' }], le: L } },
  { cle: 'bareme-2026', valeur: { annee: '2026', journee: 9000, pays: [{ nom: 'France', montant: 18000, zone: 'euro' }], le: L } },
  { cle: 'detachement-x', valeur: { id: 'x', du: '2025-12-30', au: '2026-01-02', pays: 'France', nuits: {}, le: L } },
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
const annee = async a => { await onglet('plus'); await p.click('#pl-frais'); await p.waitForSelector('#fr-l'); await p.click(`#fr-l [data-an="${a}"]`); await p.waitForSelector('#fa-l'); };
const ligneBareme = nom => p.evaluate(n => { const r = [...document.querySelectorAll('#fb-pays .fb-row')].find(x => x.querySelector('.fb-nom').value === n);
  return r && { m: r.querySelector('.fb-m').value, z: r.querySelector('.fb-z').value, tag: (r.querySelector('.fb-tag') || {}).textContent || '', info: (r.querySelector('.fb-info') || {}).textContent || '', h: !r.hidden }; }, nom);
const lignes = () => p.$$eval('#fa-l .lv', l => l.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
const carnet = () => p.evaluate(async () => { const e = await import('./js/etat.js'), t = await import('./js/totaux.js'), s = await import('./js/sauvegarde.js'), d = await import('./js/pdf.js');
  const v = [...e.etat.vols].reverse(); return JSON.stringify([t.calculerTotaux(v, e.etat.avions, '2026-12-31'), s.texteTableur(v, e.etat.avions, e.listeDesCompteurs()), d.paginer(v, e.etat.avions).map(x => [x.totalPage, x.cumul]), (await import('./js/ui/anomalies.js')).anomaliesActuelles().size]); });

try {
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.evaluate(async ([avs, vs, rs]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols', 'reglages'], 'readwrite'); for (const a of avs) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v); for (const r of rs) t.objectStore('reglages').put(r);
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVIONS, VOLS, REGLAGES]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  verifier(Number((await p.evaluate(async () => (await import('./js/version.js')).VERSION)).split('.')[1]) >= 69, 'version 0.69 ou suivante');
  const carnet0 = await carnet();

  console.log('R169 : barème 2025 du bulletin dans la fenêtre « Barème »');
  await annee('2025');
  let x = await ligneBareme('France');
  verifier(x && x.m === '174,00' && x.z === 'euro' && x.tag === 'bulletin', 'France 174,00 Euro-Europe (bulletin)');
  verifier(JSON.stringify(await ligneBareme('Tunisie')).includes('"m":"125,00","z":"euro"'), 'Tunisie 125,00 Euro-Europe');
  const jp = await ligneBareme('Japon'), tk = await ligneBareme('Japon – Tokyo');
  verifier(jp.m === '147,54' && jp.z === 'monde' && tk.m === '173,55' && tk.z === 'monde', 'Japon 147,54 et « Japon – Tokyo » 173,55 (Monde)');
  const es = await ligneBareme('Espagne');
  verifier(es.m === '180,00' && es.tag === 'modifié' && es.info.includes('bulletin : 174,00 €') && await p.inputValue('#fb-j') === '90,00', 'saisie d\'avant la mise à jour gardée : Espagne 180,00 « modifié » (bulletin 174,00), vol journée 90,00');
  const da = await ligneBareme('Danemark');
  verifier(da.info.includes('dès le 27/11 : 289,35 €'), `montant daté affiché : « ${da.info} »`);
  await p.fill('#fb-q', 'jap'); await p.dispatchEvent('#fb-q', 'input');
  const vis = await p.$$eval('#fb-pays .fb-row', l => l.filter(r => !r.hidden).map(r => r.querySelector('.fb-nom').value));
  verifier(JSON.stringify(vis) === '["Japon","Japon – Tokyo"]', `recherche « jap » : ${vis.join(', ')}`);
  await p.fill('#fb-q', ''); await p.dispatchEvent('#fb-q', 'input');
  await p.locator('#fb-pays .fb-row', { has: p.locator('.fb-nom[value="Japon"]') }).locator('.fb-m').fill('150,00');
  await p.click('#fb-ok'); await p.waitForTimeout(300);
  const reg = await p.evaluate(async () => (await import('./js/etat.js')).reglage('bareme-2025'));
  verifier(JSON.stringify(reg.pays.map(q => q.nom).sort()) === '["Espagne","Japon"]' && reg.journee === 9000 && (await ligneBareme('Japon')).tag === 'modifié',
    'enregistré : seulement ce qui diffère du bulletin (Espagne, Japon « modifié »), vol journée gardé');
  for (const largeur of [360, 393]) {
    await p.setViewportSize({ width: largeur, height: 852 }); await p.waitForTimeout(150);
    verifier(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${largeur} px : barème lisible, rien ne déborde`);
  }
  await p.screenshot({ path: join(CAPT, 'v069-bareme-2025.png') });

  console.log('R167 : détachement du 30/12/2025 au 02/01/2026');
  let l = await lignes();
  verifier(l.some(t => t.startsWith('Détachement 4 jours (partie 2025) 348,00 €') && t.includes('30/12 → 31/12/2025')), 'partie 2025 : 2 × 174,00 = 348,00 €');
  verifier(l.some(t => t.startsWith('Vol journée 90,00 €')), 'vol journée 2025 au montant saisi (90,00 €)');

  console.log('R168 : toutes les étapes');
  verifier(l.some(t => t.startsWith('J+2') && t.includes('LFTW → LFML → LFQQ → LFML → LFTW')), 'J+2 : « LFTW → LFML → LFQQ → LFML → LFTW »');
  const m = await p.evaluate(async () => (await import('./js/ui/frais.js')).modelePdf('2025'));
  verifier(m.etapes.some(r => r[1] === 'LFTW → LFML → LFQQ → LFML → LFTW') && m.lignes.some(r => r.etapes === 'LFTW → LFML → LFQQ → LFML → LFTW'), 'PDF : étapes dans le résumé et sous la ligne');
  const debut = m.lignes.find(r => r.titre.includes('(partie 2025)'));
  verifier(debut && debut.titre.includes('— début (détachement du 30/12/2025 au 02/01/2026)') && debut.vols.length === 1, 'PDF 2025 : « début », avec les vols de sa partie');
  await p.click('#fa-ret'); await p.click('#fr-l [data-an="2026"]'); await p.waitForSelector('#fa-l');
  l = await lignes();
  verifier(l.some(t => t.startsWith('Détachement 4 jours (partie 2026) 270,00 €') && t.includes('01/01 → 02/01/2026')), 'partie 2026 : 1,5 × 180,00 (barème 2026 saisi) = 270,00 €');
  verifier(await p.inputValue('#fb-pays .fb-row:first-child .fb-nom') === 'France' && (await p.$$('#fb-pays .fb-row')).length === 1 && !(await p.$('#fb-pays .fb-tag')), '2026 : barème à la main comme avant (pas de bulletin)');
  const m26 = await p.evaluate(async () => (await import('./js/ui/frais.js')).modelePdf('2026'));
  verifier(m26.lignes.some(r => r.titre.includes('(partie 2026) — suite')), 'PDF 2026 : « suite »');
  await p.click('#fa-l [data-ligne^="det|x"]'); await p.waitForSelector('#dt-modal:not([hidden])');
  verifier(await p.inputValue('#dt-du') === '2025-12-30', 'les deux parties ouvrent le même détachement');
  await p.click('#dt-no'); await p.click('#ou-x');

  console.log('Choix du pays par les premières lettres');
  await onglet('carnet'); await p.click('.flight[data-id="j2a"] .fl-route'); await p.waitForSelector('#v-saisie:not([hidden])');
  const liste = await p.evaluate(() => { const i = document.getElementById('fe-pays'), d = document.getElementById(i.getAttribute('list')); return [...d.options].map(o => o.value); });
  verifier(liste.includes('Japon – Tokyo') && liste.includes('Tunisie') && liste.length > 100, `« Pays de la nuit » : liste du barème 2025 (${liste.length} pays)`);
  await p.fill('#fe-pays', 'japon – tokyo'); await p.dispatchEvent('#fe-pays', 'change'); await p.waitForTimeout(250);
  verifier(await p.inputValue('#fe-pays') === 'Japon – Tokyo' && (await p.evaluate(async () => (await import('./js/etat.js')).etat.vols.find(v => v.id === 'j2a').frais.pays)) === 'Japon – Tokyo', 'tapé en minuscules : « Japon – Tokyo » retenu');
  await p.fill('#fe-pays', 'Atlantide'); await p.dispatchEvent('#fe-pays', 'change'); await p.waitForTimeout(250);
  verifier(await p.inputValue('#fe-pays') === 'Japon – Tokyo' && (await p.textContent('#toast')).includes('n\'est pas dans le barème 2025'), 'pays inconnu : refusé avec un message');
  await p.click('#cancel'); await p.waitForSelector('#v-carnet:not([hidden])');

  console.log('R170 : cercle noir autour du rond');
  const ronds = () => p.$$eval('#list .flight', l => Object.fromEntries(l.map(c => { const r = c.querySelector('.fl-rep'), a = r && r.querySelector('.fe-anneau');
    return [c.dataset.id, { frais: r.classList.contains('frais'), visible: !!a && getComputedStyle(a).display !== 'none', on: r.classList.contains('on') }]; })));
  let r = await ronds();
  verifier(r.jr.frais && r.jr.visible && r.jr.on && r.jn.frais && !r.jn.on, 'vol journée : cercle, reporté (vert) et pas encore reporté (blanc)');
  verifier(r.j2a.frais && r.j2b.frais && r.de.frais && r.de2.frais && !r.sans.frais && !r.sans.visible, 'J+2 (les deux vols), vols du détachement : cercle ; vol sans frais : rond inchangé');
  for (const largeur of [360, 393]) {
    await p.setViewportSize({ width: largeur, height: 852 }); await p.waitForTimeout(200);
    const mes = await p.$$eval('#list .flight', l => l.map(c => {
      const a = c.querySelector('.fl-rep.frais .fe-anneau'); if (!a) return null;
      const b = a.getBoundingClientRect(), z = { left: b.left - 1, right: b.right + 1, top: b.top - 1, bottom: b.bottom + 1 };
      const touche = e => { const q = e.getBoundingClientRect(); return q.right > z.left && q.left < z.right && q.bottom > z.top && q.top < z.bottom; };
      return { id: c.dataset.id, d: Math.round((b.width + 2) * 10) / 10, tri: [...c.querySelectorAll('.fl-an')].some(touche), bulles: [...c.querySelectorAll('.chip')].filter(touche).map(e => e.textContent) };
    }).filter(Boolean));
    const pb = mes.filter(x => x.tri || x.bulles.length);
    verifier(mes.length >= 5 && !pb.length && mes.every(x => x.d >= 23 && x.d <= 25) && mes.some(x => x.id === 'an'), `${largeur} px : cercle de ${mes[0].d} px, ne touche ni le triangle « ! » ni les bulles (${mes.length} vols)${pb.length ? ' — ' + JSON.stringify(pb) : ''}`);
    await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: join(CAPT, `v069-cercles-${largeur}.png`) });
  }
  await p.locator('.flight[data-id="jr"] .fl-rep').click(); await p.waitForTimeout(250);
  verifier(await p.isHidden('#v-saisie') && !(await ronds()).jr.on && (await ronds()).jr.frais, 'le rond reste cliquable (décoché), le cercle reste');
  await p.locator('.flight[data-id="jr"] .fl-rep').click(); await p.waitForTimeout(250);
  await p.click('.flight[data-id="jr"] .fl-route'); await p.waitForSelector('#v-saisie:not([hidden])');
  await p.click('#fe-zone [data-fe="journee"]'); await p.waitForTimeout(200); await p.click('#cancel'); await p.waitForSelector('#v-carnet:not([hidden])');
  r = await ronds();
  verifier(!r.jr.frais && !r.jr.visible && r.jr.on, 'frais décochés : le cercle disparaît, le rond reste vert');

  verifier(await carnet() === carnet0, 'totaux, PDF EASA, CSV et anomalies inchangés');
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.69 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); srv.fermer();
}

// v0.64 : R158 altisurface sans code OACI (att. et appr. modifiables, « ! » disparu) ; R159 nuit gardée (atterrissages, remarque,
// terrain intermédiaire validé : rien ne change ; heure changée : recalculée), nuit tapée jamais remplacée, « Remettre 0h12 » ;
// R160 nuit calculée arrondie à 6 min ; R161 dixièmes sur l'accueil (couleur, taille, 360 / 393 px) ; PDF, CSV, totaux inchangés.
// Carnet INVENTÉ, aucun serveur extérieur. Usage : node tests/navigateur/v064.mjs
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
const hh = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const base = (id, date, champs = {}) => ({ id, date, hDep: '08:00', hArr: '09:30', mode: 'utc', dep: 'LFTW', arr: 'LFTW', escales: [], avionId: 'a1', tempsTotal: 90, tempsMP: null,
  tempsSE: null, tempsME: null, tempsCdB: 90, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: '', nomInstructeur: '', nomExaminateur: '', missions: [], remarques: '', feux: 0,
  compteurs: { ...C0 }, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'flylog', ordre: Date.parse(`${date}T08:00Z`), creeLe: H, modifieLe: H, ...champs });
const duree = (id, date, t, champs = {}) => base(id, date, { hDep: '08:00', hArr: hh(480 + t), tempsTotal: t, tempsCdB: t, ...champs });
const VOLS = [
  base('alti', '2026-10-20', { escales: [{ code: '', nom: 'ALTISURFACE ESSAI', lat: 45.3, lon: 6.5, attJour: 0, attNuit: 0, approches: 0 }] }),
  // vol de fin de journée à Marseille : la nuit FlyLog (0h12) n'est pas celle que l'app calculerait
  base('nuit', '2026-01-10', { dep: 'LFML', arr: 'LFML', hDep: '16:30', hArr: '17:44', tempsTotal: 74, tempsCdB: 74, tempsNuit: 12 }),
  // le même avec un terrain intermédiaire, et un temps de vol FlyLog (76) différent des heures (74)
  base('nesc', '2026-01-11', { dep: 'LFML', arr: 'LFML', hDep: '16:30', hArr: '17:44', tempsTotal: 76, tempsCdB: 76, tempsNuit: 12, attJour: 1,
    escales: [{ code: 'LFMV', attJour: 0, attNuit: 0, approches: 0 }] }),
  duree('d84', '2026-10-24', 84), duree('d70', '2026-10-23', 70), duree('d32', '2026-10-22', 32),
  duree('groupe', '2026-10-21', 87, { hArr: '14:00', volsGroupes: true }),
  duree('feu', '2026-10-25', 86, { missions: ['FEU n°12 ESSAI'], feux: 1 }),
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
const vol = id => p.evaluate(async id => (await import('./js/etat.js')).etat.vols.find(v => v.id === id), id);
const ouvrir = async id => { await onglet('carnet'); await p.click(`.flight[data-id="${id}"] .fl-route`); await p.waitForSelector('#v-saisie:not([hidden])'); await p.click('#f-edit'); };
const enregistrer = async (tempsChange = false) => { await p.click('#save'); await p.waitForTimeout(300);
  if (await p.isVisible('#tv-modal')) { if (!tempsChange) throw new Error('alerte « Temps de vol modifié » inattendue'); await p.click('#tv-ok'); } await p.waitForSelector('#v-carnet:not([hidden])'); };
const etatCarnet = () => p.evaluate(async () => { const e = await import('./js/etat.js'), t = await import('./js/totaux.js'), s = await import('./js/sauvegarde.js'), d = await import('./js/pdf.js');
  const v = e.etat.vols; return JSON.stringify([t.calculerTotaux(v, e.etat.avions, '2026-12-31'), s.texteTableur([...v].reverse(), e.etat.avions, e.listeDesCompteurs()), d.totauxPDF([...v].reverse(), e.etat.avions)]); });

try {
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.evaluate(async ([avs, vs]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols'], 'readwrite');
    for (const a of avs) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVIONS, VOLS]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  const version = await p.evaluate(async () => (await import('./js/version.js')).VERSION);
  verifier(Number(version.split('.')[1]) >= 64, `version ${version} (0.64 ou suivante)`);
  const carnet0 = await etatCarnet();

  // v0.67 (R164) : le petit temps « 1,4 » de R161 est retiré (le temps encadré suit le format choisi : test v067.mjs)
  console.log('R161 -> R164 : plus de petit temps en dixièmes à gauche du temps de vol');
  for (const largeur of [360, 393]) {
    await p.setViewportSize({ width: largeur, height: 852 }); await p.waitForTimeout(250);
    const m = await p.$$eval('#list .flight', l => l.map(c => ({ dix: !!c.querySelector('.fl-dix'), bloc: c.querySelector('.fl-bloc').textContent, deborde: c.scrollWidth > c.clientWidth + 1 })));
    const par = Object.fromEntries((await p.$$eval('#list .flight', l => l.map(c => c.dataset.id))).map((id, k) => [id, m[k]]));
    verifier(m.every(x => !x.dix && !x.deborde) && par.d84.bloc === '1h24' && par.groupe.bloc === '1h27', `${largeur} px : aucun « .fl-dix », temps en heures (format « Heures » du serveur de test), rien ne déborde`);
  }
  verifier(await etatCarnet() === carnet0, 'affichage seulement : totaux, CSV et PDF inchangés');

  console.log('R158 : altisurface sans code OACI');
  await ouvrir('alti');
  await p.click('#via-list .viachip.sans-code'); await p.waitForSelector('#via-modal:not([hidden])');
  verifier((await p.textContent('#vm-name')).includes('ALTISURFACE ESSAI'), `fenêtre du terrain : « ${await p.textContent('#vm-name')} »`);
  await p.click('[data-vm="attJour"][data-d="1"]'); await p.click('[data-vm="approches"][data-d="1"]'); await p.click('#vm-ok');
  verifier(await p.isHidden('#via-modal'), '« Valider » accepté sans code');
  const bulle = await p.textContent('#via-list .viachip');
  verifier(/1 att/.test(bulle) && /1 appr/.test(bulle) && bulle.includes('ALTISURFACE ESSAI'), `bulle : « ${bulle.replace(/\s+/g, ' ').trim()} »`);
  await enregistrer();
  let v = await vol('alti');
  verifier(v.escales[0].attJour === 1 && v.escales[0].approches === 1 && v.escales[0].nom === 'ALTISURFACE ESSAI' && !v.escales[0].code && v.approches === 1,
    'enregistré : 1 att., 1 appr., nom inchangé, sans code');
  verifier(!(await p.evaluate(async () => (await import('./js/ui/anomalies.js')).anomaliesDe('alti').length)) && await p.isHidden('.flight[data-id="alti"] .fl-an'), '« ! » disparu');

  console.log('R159 : la nuit ne change plus en silence');
  await ouvrir('nuit'); await p.click('[data-s="attJour"][data-d="1"]'); await enregistrer();
  v = await vol('nuit');
  verifier(v.tempsNuit === 12 && v.attJour + v.attNuit === 2, 'atterrissages changés (2, le nouveau rangé de nuit par la règle R134) : nuit 0h12 gardée');
  await ouvrir('nuit'); await p.fill('#f-rem', 'REMARQUE ESSAI'); await enregistrer();
  verifier((await vol('nuit')).tempsNuit === 12, 'remarque changée : nuit 0h12 gardée');
  await ouvrir('nesc'); await p.click('#via-list .viachip'); await p.click('[data-vm="attJour"][data-d="1"]'); await p.click('#vm-ok');
  verifier(await p.inputValue('#c-nuit') === '0h12' && await p.textContent('#f-bloc') === '1h16', 'terrain intermédiaire validé (cas du 0h12 -> 0h14) : nuit 0h12 et temps de vol FlyLog 1h16 gardés à l\'écran');
  await enregistrer();
  v = await vol('nesc');
  verifier(v.tempsNuit === 12 && v.tempsTotal === 76 && v.tempsCdB === 76 && v.escales[0].attJour === 1 && v.attJour + v.attNuit === 2, 'enregistré : nuit 0h12, temps 1h16, temps CdB gardés ; atterrissage ajouté');
  await ouvrir('nuit'); await p.fill('#f-t1', ''); await p.type('#f-t1', '1814'); await p.waitForTimeout(150);
  const calc = await p.evaluate(async () => { const t = await import('./js/temps.js'); return t.lireDuree(document.querySelector('#c-nuit').value); });
  const brut = await p.evaluate(async () => { const n = await import('./js/nuit.js'), t = await import('./js/terrains.js'), lf = t.terrain('LFML');
    return n.minutesDeNuit(Date.parse('2026-01-10T16:30:00Z'), 104, [lf, lf]); });
  verifier(calc !== 12 && calc % 6 === 0 && Math.abs(calc - brut) <= 3, `heure d'arrivée changée : nuit recalculée ${calc} min (calcul brut ${brut} min, arrondi au dixième)`);
  await enregistrer(true); // heure changée : le temps de vol aussi (alerte R150 normale)
  verifier((await vol('nuit')).tempsNuit === calc, `enregistrée : ${calc} min`);

  console.log('R159 : « Remettre 0h12 » dans « Anomalies traitées »');
  await onglet('plus'); await p.click('#pl-anom'); await p.waitForSelector('#at-l'); await p.click('#at-c'); await p.waitForTimeout(150); // arrivée de nuit avec 0 att. nuit : corrigée par l'atterrissage ajouté
  const carte = p.locator('#at-l .lv[data-vol="nuit"]');
  const bouton = carte.locator('[data-remettre]');
  const bb = await bouton.boundingBox();
  verifier(await bouton.textContent() === 'Remettre 0h12' && bb.height >= 40 && bb.width >= 40 && (await carte.innerText()).includes('Nuit : 0h12'), `bouton « Remettre 0h12 » sous la ligne Nuit (${Math.round(bb.width)} × ${Math.round(bb.height)} px)`);
  await p.screenshot({ path: join(CAPT, 'v064-remettre.png') });
  await bouton.click(); await p.waitForTimeout(300);
  v = await vol('nuit');
  verifier(v.tempsNuit === 12 && v.hArr === '18:14' && v.tempsTotal === 104, 'nuit d\'origine remise dans le vol (heures et temps inchangés : rien recalculé)');
  verifier(!(await p.locator('#at-l .lv[data-vol="nuit"]').innerText()).includes('Nuit :') && await p.isHidden('#tv-modal'), 'ligne « Nuit » retirée (la carte reste pour l\'heure changée), pas d\'alerte R150');
  await p.click('#ou-x');

  console.log('R159 : nuit tapée à la main jamais remplacée');
  await ouvrir('nuit'); await p.fill('#c-nuit', '0h17'); await enregistrer();
  verifier((await vol('nuit')).tempsNuit === 17, 'nuit tapée 0h17 enregistrée');
  await ouvrir('nuit'); await p.fill('#f-t1', ''); await p.type('#f-t1', '1830'); await p.waitForTimeout(150);
  verifier(await p.inputValue('#c-nuit') === '0h17', 'heure changée ensuite : 0h17 reste');
  await enregistrer(true);
  verifier((await vol('nuit')).tempsNuit === 17, 'enregistrée : 0h17');

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.64 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); srv.fermer();
}

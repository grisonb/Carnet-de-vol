// v0.65 : R158b terrain intermédiaire sans code OACI venu d'un import FlyLog (le nom est rangé dans « code » : « COL ÉTÉ ESSAI ») :
// « Terrain sans code OACI » (information), « Valider » garde atterrissages et approches, « ! » disparu, ligne « Anomalies traitées »,
// nuit inchangée ; nom tapé à la main (minuscules) ; code à 4 lettres inconnu : comme avant. Téléphone 360 / 393 px (bouton LF actif
// et inactif) et PC. Carnet et terrains INVENTÉS, aucun serveur extérieur. Usage : node tests/navigateur/v065.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';
import { fauxFlyLog } from '../outils/faux-flylog.js';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const FICHIER = join(CAPT, 'v065-faux-flylog.csv');
writeFileSync(FICHIER, fauxFlyLog([
  { DATE: '2026-02-09', DEPARTURE_AIRPORT: 'LFTW', ARRIVAL_AIRPORT: 'LFTW', ROUTE: 'LFTW|COL ÉTÉ ESSAI|PLATEAU DES ESSAIS|LFTW', AIRCRAFT_TYPE: 'DR40',
    AIRCRAFT_REGISTRATION: 'FXZZD', DURATION_BLOCK: '1:30', LDGS_DAY: '1', TIME_BLOCK_START: '10:00', TIME_BLOCK_END: '11:30', DURATION_PIC: '1:30', DURATION_NIGHT: '0:00', NAME_PIC: 'SELF' },
]));

const srv = await serveur();
const { chromium } = playwright();
const nav = await chromium.launch();
const bloquees = [], erreurs = [];

async function essai(nom, options, lf) {
  console.log(`${nom} (bouton LF ${lf ? 'actif' : 'inactif'})`);
  const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block', ...options });
  await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
  await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.click('.tabs button[data-v="plus"]'); await p.setInputFiles('#file-flylog', FICHIER); await p.waitForSelector('#im-ok'); await p.click('#im-ok'); await p.waitForSelector('.ctab'); await p.click('#ou-x');
  await p.evaluate(async lf => (await import('./js/etat.js')).ecrireReglageDiscret('prefixeLF', lf), lf);
  // vols tapés à la main : un nom en minuscules sans code, un nom seul (champ « nom »), un code à 4 lettres inconnu
  await p.evaluate(async () => {
    const e = await import('./js/etat.js'), v0 = e.etat.vols[0];
    const copie = (id, date, escales) => ({ ...structuredClone(v0), id, date, escales, source: 'saisie', ordre: Date.parse(`${date}T10:00Z`) });
    await e.enregistrerVol(copie('main', '2026-02-10', [{ code: 'altisurface des essais', attJour: 0, attNuit: 0, approches: 0 }]), { garderDate: true });
    await e.enregistrerVol(copie('nom', '2026-02-11', [{ code: '', nom: 'pré de l\'essai', attJour: 0, attNuit: 0, approches: 0 }]), { garderDate: true });
    await e.enregistrerVol(copie('zz', '2026-02-12', [{ code: 'ZZQX', attJour: 0, attNuit: 0, approches: 0 }]), { garderDate: true });
  });
  await p.click('.tabs button[data-v="carnet"]');
  const fl = await p.evaluate(async () => (await import('./js/etat.js')).etat.vols.find(v => v.source === 'flylog'));
  verifier(fl.escales.map(x => x.code).join(' | ') === 'COL ÉTÉ ESSAI | PLATEAU DES ESSAIS', 'import FlyLog : les noms sont rangés dans « code » (comme le vrai carnet)');
  const etatVol = id => p.evaluate(async id => { const e = await import('./js/etat.js'), a = await import('./js/ui/anomalies.js');
    return { v: e.etat.vols.find(v => v.id === id), an: a.anomaliesDe(id).map(x => x.cle), c: (e.reglage('anomaliesCorrigees') || []).filter(x => x.volId === id).flatMap(x => x.l.map(y => y.cle)) }; }, id);
  const ouvrir = async id => { await p.click(`.flight[data-id="${id}"] .fl-route`); await p.waitForSelector('#v-saisie:not([hidden])'); await p.click('#f-edit'); };
  const terrainSansCode = async (n, att, appr = 0) => {
    await p.click(`#via-list .viachip >> nth=${n}`); await p.waitForSelector('#via-modal:not([hidden])'); await p.waitForTimeout(120);
    const r = { champ: await p.inputValue('#vm-icao'), msg: await p.textContent('#vm-name'), rouge: await p.evaluate(() => document.getElementById('vm-name').classList.contains('bad')),
      zone: await p.locator('#vm-ok').boundingBox() };
    for (let k = 0; k < att; k++) await p.click('[data-vm="attJour"][data-d="1"]');
    for (let k = 0; k < appr; k++) await p.click('[data-vm="approches"][data-d="1"]');
    await p.click('#vm-ok'); await p.waitForTimeout(150);
    return { ...r, ferme: await p.isHidden('#via-modal') };
  };
  const enregistrer = async () => { await p.click('#save'); await p.waitForTimeout(300); if (await p.isVisible('#tv-modal')) throw new Error('alerte R150 inattendue'); await p.waitForSelector('#v-carnet:not([hidden])'); };

  await ouvrir(fl.id);
  let r = await terrainSansCode(0, 3, 1);
  verifier(r.msg === 'COL ÉTÉ ESSAI · Terrain sans code OACI' && !r.rouge && r.champ === '' && r.ferme && r.zone.height >= 40,
    `« ${r.msg} » (information, pas en rouge), champ du code vide, « Valider » accepté`);
  await p.screenshot({ path: join(CAPT, `v065-${nom.replace(/\W+/g, '-')}-lf${lf ? 1 : 0}.png`) });
  r = await terrainSansCode(1, 3);
  verifier(r.msg === 'PLATEAU DES ESSAIS · Terrain sans code OACI' && r.ferme, 'second terrain sans code : accepté aussi');
  await enregistrer();
  let x = await etatVol(fl.id);
  verifier(JSON.stringify(x.v.escales.map(e => [e.code, e.attJour, e.approches])) === '[["COL ÉTÉ ESSAI",3,1],["PLATEAU DES ESSAIS",3,0]]' && x.v.approches === 1,
    'enregistré : 3 att. sur chaque terrain, 1 appr., noms inchangés');
  verifier(!x.an.length && JSON.stringify(x.c) === '["a|COL ÉTÉ ESSAI","a|PLATEAU DES ESSAIS"]' && await p.isHidden(`.flight[data-id="${fl.id}"] .fl-an`), '« ! » disparu, lignes dans « Anomalies traitées »');
  verifier(x.v.tempsNuit === fl.tempsNuit && x.v.tempsTotal === fl.tempsTotal, 'nuit et temps de vol inchangés (R159)');

  await ouvrir('main'); r = await terrainSansCode(0, 3); await enregistrer(); x = await etatVol('main');
  verifier(r.msg === 'altisurface des essais · Terrain sans code OACI' && r.ferme && x.v.escales[0].attJour === 3 && x.v.escales[0].code === 'altisurface des essais' && !x.an.length,
    'nom tapé à la main en minuscules : accepté, gardé, « ! » disparu');
  await ouvrir('nom'); r = await terrainSansCode(0, 2); await enregistrer(); x = await etatVol('nom');
  verifier(r.msg === 'pré de l\'essai · Terrain sans code OACI' && x.v.escales[0].attJour === 2 && x.v.escales[0].nom === 'pré de l\'essai' && !x.an.length, 'nom seul (champ « nom ») : accepté, gardé');
  await ouvrir('zz'); r = await terrainSansCode(0, 1); await enregistrer(); x = await etatVol('zz');
  verifier(r.champ === 'ZZQX' && r.msg === 'Terrain inconnu : vérifie le code' && r.rouge && r.ferme && x.v.escales[0].code === 'ZZQX' && x.v.escales[0].attJour === 1,
    'code à 4 lettres inconnu : comme avant (« Terrain inconnu : vérifie le code », en rouge ; « Valider » accepté)');
  const deborde = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  verifier(!deborde, 'rien ne déborde');
  await ctx.close();
}

try {
  await essai('Téléphone 360 px', { viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, true);
  await essai('Téléphone 393 px', { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, false);
  await essai('PC', { viewport: { width: 1280, height: 860 } }, true);
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.65 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); srv.fermer();
}

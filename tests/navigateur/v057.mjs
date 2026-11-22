// v0.57 : R147 « Amerrissages SEP » n'est plus coché d'office sur les monomoteurs piston (DR400, C172, CAP 10 jamais réglés) ;
// un vol avec une valeur l'affiche toujours ; un type ou un avion réglé à la main garde son choix ; « Pour le type » marche ;
// Dash 8 et CL-415 inchangés ; totaux identiques. Carnet v0.56 INVENTÉ (réglages déjà faits), aucun serveur extérieur.
// Usage : node tests/navigateur/v057.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2026-11-01T08:00:00Z';
const avion = (id, immat, typeOACI, modele, sep, champs = {}) => ({ id, immat, typeOACI, modele, constructeur: 'ESSAI', nom: '', indicatif: '', etiquettes: [], sim: false, photo: null,
  remarques: '', hexAdsb: '', surface: 'L', train: 'tricycle', creeLe: H, modifieLe: H,
  ...(sep ? { equipage: 'SP', moteurs: 'SE', moteur: 'P' } : { equipage: 'MP', moteurs: 'ME', moteur: 'T' }), ...champs });
const AVIONS = [avion('d1', 'F-XZZD', 'DR40', 'DR400', true), avion('k1', 'F-XZZK', 'C172', '172', true), avion('p1', 'F-XZZP', 'CP10', 'CAP 10', true),
  avion('t1', 'F-XZZT', 'TB20', 'TB20 Trinidad', true), // type TB20 réglé à la main (Amerrissages SEP coché)
  avion('r1', 'F-XZZR', 'DR40', 'DR400', true, { compteursPropres: ['amerrSEP'] }), // avion réglé à la main
  avion('a1', 'F-XZZA', 'DH8D', 'Dash 8 Q400 MR', false), avion('c1', 'F-XZZX', 'CL2T', 'CL-415', false, { surface: 'A' })];
const C0 = { largCdbDash: 0, largInstrCdbDash: 0, largCopiDash: 0, largCopiCL: 0, ecopages: 0, amerrCL: 0, amerrSEP: 0, largPara: 0 };
const vol = (id, jour, avionId, minutes, compteurs = {}) => ({ id, date: `2026-11-${jour}`, hDep: '10:00', hArr: '11:00', mode: 'utc', dep: 'LFTW', arr: 'LFTW', escales: [], avionId,
  tempsTotal: minutes, tempsCdB: minutes, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: '', nomInstructeur: '', nomExaminateur: '', missions: [], remarques: '', feux: 0,
  compteurs: { ...C0, ...compteurs }, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie', ordre: Date.parse(`2026-11-${jour}T10:00Z`),
  creeLe: H, modifieLe: H });
const VOLS = [vol('v1', '01', 'd1', 60), vol('v2', '02', 'k1', 50), vol('v3', '03', 'p1', 40), vol('v4', '04', 'd1', 30, { amerrSEP: 2 }), vol('v5', '05', 't1', 45),
  vol('v6', '06', 'r1', 35), vol('v7', '07', 'a1', 90, { largCdbDash: 1 }), vol('v8', '08', 'c1', 70, { ecopages: 4 }), vol('v9', '09', 'k1', 25)];
const REGLAGES = [{ cle: 'compteursTypes', valeur: { TB20: ['amerrSEP'] }, modifieLe: H }];

const srv = await serveur();
const { chromium } = playwright();
const nav = await chromium.launch();
const bloquees = [], erreurs = [];
try {
  const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/i.test(m.text())) erreurs.push(m.text()); });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.evaluate(async ([avs, vs, rg]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols', 'reglages'], 'readwrite');
    for (const a of avs) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v); for (const x of rg) t.objectStore('reglages').put(x);
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVIONS, VOLS, REGLAGES]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  verifier(await p.textContent('#pl-version') === 'v0.57' || (await p.evaluate(async () => (await import('./js/version.js')).VERSION)) === '0.57', 'version 0.57');
  const totaux = () => p.evaluate(async () => { const t = await import('./js/totaux.js'), e = await import('./js/etat.js'); return JSON.stringify(t.calculerTotaux(e.etat.vols, e.etat.avions)); });
  const t0 = await totaux();
  const T = JSON.parse(t0);
  verifier(T.vols === 9 && T.tempsTotal === 445 && T.atterrissages === 9 && T.amerrSEP === 2 && T.ecopages === 4 && T.largCdbDash === 1, `totaux : ${T.vols} vols, ${T.tempsTotal} min, ${T.atterrissages} att., Amerrissages SEP ${T.amerrSEP}`);
  const vols = () => p.evaluate(async () => JSON.stringify((await import('./js/etat.js')).etat.vols));
  const avantVols = await vols();

  const ouvrir = async id => {
    await p.click('.tabs button[data-v="carnet"]'); await p.locator(`.flight[data-id="${id}"]`).scrollIntoViewIfNeeded();
    await p.click(`.flight[data-id="${id}"]`); await p.waitForSelector('#v-saisie:not([hidden])');
  };
  const fermer = async () => { for (let i = 0; i < 3 && await p.isVisible('#v-saisie'); i++) { await p.click('#cancel'); await p.waitForTimeout(80); if (await p.isVisible('#ab-yes')) await p.click('#ab-yes'); } };
  const affiches = () => p.$$eval('#ctrs .step:not([hidden])', l => l.map(s => (s.id === 'feu-row' ? 'Feux' : s.firstElementChild.textContent.trim())));
  const voir = async (id, attendu, msg) => { await ouvrir(id); const a = await affiches(); verifier(JSON.stringify(a) === JSON.stringify(attendu), `${msg} : ${a.join(', ') || 'aucun compteur'}`); await fermer(); };

  console.log('R147 : monomoteurs jamais réglés');
  await voir('v1', [], 'DR400 (F-XZZD)');
  await voir('v2', [], 'C172 (F-XZZK)');
  await voir('v3', [], 'CAP 10 (F-XZZP)');
  await voir('v4', ['Amerrissages SEP'], 'DR400 avec 2 amerrissages : affiché');
  console.log('Réglages faits à la main : gardés');
  await voir('v5', ['Amerrissages SEP'], 'type TB20 coché à la main');
  await voir('v6', ['Amerrissages SEP'], 'avion F-XZZR réglé à la main');
  console.log('Dash 8 et CL-415 : comme en v0.56');
  await voir('v7', ['Feux', 'Largages CdB Dash', 'Largages instruction CdB Dash'], 'Dash 8');
  await voir('v8', ['Feux', 'Largages copi CL', 'Écopages', 'Amerrissages CL'], 'CL-415');
  console.log('Plus › Types d\'avion : C172 sans case cochée ; « Pour le type » marche');
  await p.click('.tabs button[data-v="plus"]'); await p.click('#pl-types'); await p.click('#ty-l [data-ty="C172"]');
  verifier(!(await p.$$eval('#te-cps .cbox', l => l.some(b => b.getAttribute('aria-checked') === 'true'))), 'type C172 : aucun compteur coché');
  await p.click('#ou-x');
  await ouvrir('v9'); if (await p.isVisible('#f-edit')) await p.click('#f-edit');
  await p.click('#ctr-open'); await p.locator('#cptm-list .cbox', { hasText: /^Amerrissages SEP$/ }).click();
  await p.locator('#cpc-b button', { hasText: 'Pour le type' }).click(); await p.waitForTimeout(250); await p.click('#cptm-x');
  verifier((await affiches()).includes('Amerrissages SEP'), 'cocher « Pour le type » sur un C172 : affiché'); await fermer();
  await voir('v2', ['Amerrissages SEP'], 'autre vol C172 : affiché aussi');
  await voir('v1', [], 'DR400 : toujours rien');
  verifier(await totaux() === t0 && await vols() === avantVols, 'aucune valeur, aucun vol, aucun total ne change');
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur');
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''));
  console.log('\nv0.57 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); srv.fermer();
}

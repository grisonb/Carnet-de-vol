// v0.41 : R102 lancement tout bleu nuit (#0f1b35 = bord de l'icône) : background_color du manifeste et écran de lancement
// interne plein écran (sans la page derrière), retiré quand le carnet est prêt ; theme_color, id, start_url, scope inchangés.
// R103 contour gris 1,5 px #aab3c2 + légère ombre des cartes de vols (sombre adapté ; simulation : contour rouge gardé).
// Téléphone (Chromium 390 px clair / sombre, 360 px), PC, iPad (WebKit). Vols INVENTÉS.
// Captures : tests/navigateur/captures/v041-*.png (non commitées). Usage : node tests/navigateur/v041.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2026-11-15T08:00:00Z';
const AVION = { id: 'a1', immat: 'F-XZZA', typeOACI: 'DH8D', modele: 'Dash 8 Q400', constructeur: 'ESSAI', nom: 'M91', indicatif: '', equipage: 'MP', moteurs: 'ME',
  moteur: 'T', surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', creeLe: H, modifieLe: H };
const vol = (id, jour, champs) => ({ id, date: `2026-11-${jour}`, hDep: '10:00', hArr: '11:30', mode: 'utc', dep: 'LFTW', arr: 'LFTW', escales: [], avionId: 'a1',
  tempsTotal: 90, tempsMP: null, tempsSE: null, tempsME: null, tempsCdB: 90, fonction: 'cdb', nomCdB: 'SELF', nomCopi: 'ZZX', missions: [], remarques: '', feux: 0,
  compteurs: {}, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie', ordre: Date.parse(`2026-11-${jour}T10:00Z`),
  creeLe: H, modifieLe: H, ...champs });
const VOLS = [
  vol('v-feu', '14', { missions: ['FEU n°60 ESSAI'], feux: 1, compteurs: { largCdbDash: 2 } }),
  vol('v-ent', '13', { missions: ['ENT. OPS'] }),
  vol('v-ifr', '12', { missions: ['TRANSPORT ESSAI'], tempsIFR: 60, approches: 2 }),
  vol('v-sim', '11', { missions: ['FEU n°61 ESSAI'], feux: 1, simulation: true }),
];

const srv = await serveur();
const { chromium, webkit } = playwright();
const nav = await chromium.launch(), navSafari = await webkit.launch();
const erreurs = [], bloquees = [];
async function appareil(nom, moteur, options, { lent = false } = {}) {
  const ctx = await moteur.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block', ...options });
  await ctx.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname !== '127.0.0.1') { bloquees.push(u.href); return r.abort(); }
    // chargement lent du programme de l'app : l'écran de lancement reste le temps de le regarder
    if (lent && /\/js\/app\.js$/.test(u.pathname)) await new Promise(ok => setTimeout(ok, 2500));
    return r.continue();
  });
  await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|access control/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  return { ctx, p };
}
async function remplir(p) {
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.evaluate(async ([a, vs]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols'], 'readwrite'); t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVION, VOLS]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
}
const cartes = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#list .flight')].map(c => { const s = getComputedStyle(c);
  return [c.dataset.id, { bord: s.borderTopWidth + ' ' + s.borderTopColor, gauche: s.borderLeftWidth + ' ' + s.borderLeftColor, ombre: s.boxShadow }]; })));
function controlerCartes(nom, theme, c) {
  // contour 1,5 px = bord 1 px + liseré 0,5 px de la même couleur (Chrome arrondit un bord fractionnaire à 1 px)
  const coul = theme === 'clair' ? 'rgb(170, 179, 194)' : 'rgb(76, 93, 114)', bord = '1px ' + coul;
  const ombre = theme === 'clair' ? 'rgba(20, 30, 50, 0.14) 0px 2px 6px 0px' : 'rgba(0, 0, 0, 0.5) 0px 2px 6px 0px';
  for (const id of ['v-feu', 'v-ent', 'v-ifr']) {
    verifier(c[id].bord === bord && c[id].gauche === bord && c[id].ombre === `${coul} 0px 0px 0px 0.5px, ${ombre}`,
      `${nom} ${theme} : ${id} : contour ${coul} 1 + 0,5 = 1,5 px, ombre ${ombre}`);
  }
  verifier(c['v-sim'].bord.startsWith('2px rgb(198, 40, 40)') && c['v-sim'].ombre === ombre, `${nom} ${theme} : vol de simulation : contour rouge gardé (${c['v-sim'].bord})`);
}

try {
  console.log('Manifeste');
  const tel = await appareil('téléphone', nav, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const T = tel.p;
  await remplir(T);
  const m = await T.evaluate(async () => (await fetch('manifest.webmanifest', { cache: 'no-store' })).json());
  verifier(m.background_color === '#0f1b35' && m.theme_color === '#1f4e79' && m.id === '/Carnet-de-vol/' && m.start_url === './' && m.scope === './',
    `background_color ${m.background_color} ; theme_color (${m.theme_color}), id, start_url, scope inchangés`);

  console.log('Écran de lancement interne');
  const lent = await appareil('téléphone (lancement lent)', nav, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, { lent: true });
  const L = lent.p;
  await L.goto(srv.url, { waitUntil: 'commit' });
  await L.waitForSelector('#lancement', { state: 'visible' }); await L.waitForTimeout(400);
  const e = await L.evaluate(() => { const l = document.getElementById('lancement'), r = l.getBoundingClientRect(), s = getComputedStyle(l);
    const centre = document.elementFromPoint(innerWidth / 2, 40), img = l.querySelector('img').getBoundingClientRect();
    return { fond: s.backgroundColor, plein: r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight, dessus: l.contains(centre),
      icone: Math.abs((img.left + img.right) / 2 - innerWidth / 2) < 2 && Math.abs((img.top + img.bottom) / 2 - innerHeight / 2) < 2, pret: document.body.dataset.pret || '' }; });
  verifier(e.fond === 'rgb(15, 27, 53)' && e.plein && e.dessus && e.icone && e.pret === '', `pendant le lancement : tout l'écran ${e.fond}, icône au centre, rien de la page derrière`);
  await L.screenshot({ path: join(CAPT, 'v041-01-tel-390-lancement.png') });
  await L.waitForSelector('body[data-pret="1"]', { timeout: 20000 });
  verifier(await L.isHidden('#lancement') && await L.isVisible('#v-carnet'), 'carnet prêt : l\'écran de lancement disparaît, le carnet s\'affiche');

  console.log('Cartes des vols (téléphone 390 px)');
  for (const theme of ['clair', 'sombre']) {
    await T.emulateMedia({ colorScheme: theme === 'clair' ? 'light' : 'dark' });
    controlerCartes('téléphone', theme, await cartes(T));
    await T.screenshot({ path: join(CAPT, `v041-0${theme === 'clair' ? 2 : 3}-tel-390-cartes-${theme}.png`) });
  }
  await T.emulateMedia({ colorScheme: 'light' });
  await T.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  controlerCartes('téléphone (thème choisi dans l\'app)', 'sombre', await cartes(T));

  console.log('360 px, PC, iPad');
  const S = (await appareil('360 px', nav, { viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).p;
  await remplir(S); controlerCartes('360 px', 'clair', await cartes(S));
  const P = (await appareil('PC', nav, { viewport: { width: 1280, height: 800 } })).p;
  await remplir(P); controlerCartes('PC', 'clair', await cartes(P));
  const I = (await appareil('iPad', navSafari, { viewport: { width: 1080, height: 810 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1' })).p;
  await remplir(I);
  verifier(await I.isHidden('#lancement'), 'iPad : écran de lancement retiré une fois prêt');
  for (const theme of ['clair', 'sombre']) { await I.emulateMedia({ colorScheme: theme === 'clair' ? 'light' : 'dark' }); controlerCartes('iPad', theme, await cartes(I)); }

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.41 réussie.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await nav.close(); await navSafari.close(); srv.fermer();
}

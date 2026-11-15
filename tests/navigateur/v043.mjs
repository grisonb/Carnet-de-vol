// v0.43 : R106 date des cartes de vols remontée d'environ 4 px ; rien d'autre ne bouge (trajet, ligne avion, heures,
// étiquettes, remarque, pastille du temps, hauteur de la carte : mesurés avec et sans la règle de la v0.43) ; taille et
// graisse de la date inchangées ; haut des chiffres non coupé. Téléphone (Chromium 390 et 360 px, clair / sombre), PC,
// iPad (WebKit). Vols INVENTÉS. Captures : tests/navigateur/captures/v043-*.png (non commitées). Usage : node tests/navigateur/v043.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2026-11-15T08:00:00Z';
const jour = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const AVION = { id: 'a1', immat: 'F-XZZA', typeOACI: 'DH8D', modele: 'Dash 8 Q400 MRE', constructeur: 'ESSAI', nom: 'M91', indicatif: '', equipage: 'MP', moteurs: 'ME',
  moteur: 'T', surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', creeLe: H, modifieLe: H };
const vol = (id, j, champs) => ({ id, date: jour(j), hDep: '10:00', hArr: '11:30', mode: 'utc', dep: 'LFTW', arr: 'LFTW', escales: [], avionId: 'a1',
  tempsTotal: 90, tempsMP: null, tempsSE: null, tempsME: null, tempsCdB: 90, fonction: 'cdb', nomCdB: 'SELF', nomCopi: 'ZZX', missions: [], remarques: '', feux: 0,
  compteurs: {}, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie', ordre: Date.parse(`${jour(j)}T10:00Z`),
  creeLe: H, modifieLe: H, ...champs });
const VOLS = [
  vol('v-feu', 1, { missions: ['FEU n°60 ESSAI'], feux: 1, compteurs: { largCdbDash: 2 } }),
  vol('v-ent', 2, { missions: ['ENT. OPS'], dep: 'FMEP', arr: 'FMEP' }),
  vol('v-ifr', 3, { missions: ['TRANSPORT ESSAI'], tempsIFR: 60, approches: 2, arr: 'LFMT' }),
  vol('v-long', 4, { missions: ['TRANSPORT ESSAI'], dep: 'LFTW', arr: 'EGLL', escales: [{ code: 'LSGG', attJour: 1, attNuit: 0, approches: 0 }, { code: 'LIMC', attJour: 1, attNuit: 0, approches: 0 }] }),
];

const srv = await serveur();
const { chromium, webkit } = playwright();
const nav = await chromium.launch(), navSafari = await webkit.launch();
const erreurs = [], bloquees = [];
async function appareil(nom, moteur, options) {
  const ctx = await moteur.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block', ...options });
  await ctx.route('**/*', r => { const u = new URL(r.request().url()); if (u.hostname === '127.0.0.1') return r.continue(); bloquees.push(u.href); return r.abort(); });
  await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|access control/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.evaluate(async ([a, vs]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols'], 'readwrite'); t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVION, VOLS]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  return p;
}

// Positions (par rapport au haut de la page) de chaque partie des cartes, avec la règle v0.43 (« apres ») et sans (« avant »)
const mesurer = p => p.evaluate(ids => {
  const PARTIES = { date: '.fl-date', trajet: '.fl-route', pastille: '.fl-bloc', avion: '.fl-id', heures: '.fl-meta', etiquettes: '.chips', remarque: '.fl-rem' };
  const lire = () => Object.fromEntries(ids.map(id => {
    const c = document.querySelector(`.flight[data-id="${id}"]`), rc = c.getBoundingClientRect(), d = c.querySelector('.fl-date'), sd = getComputedStyle(d);
    const pos = Object.fromEntries(Object.entries(PARTIES).map(([k, s]) => { const r = c.querySelector(s).getBoundingClientRect(); return [k, { haut: r.top + scrollY, gauche: r.left, h: r.height }]; }));
    return [id, { pos, carte: { haut: rc.top + scrollY, h: rc.height }, bordHaut: parseFloat(getComputedStyle(c).borderTopWidth), taille: sd.fontSize, gras: sd.fontWeight }];
  }));
  const apres = lire();
  // la règle v0.43 retirée le temps de mesurer « avant », puis remise
  const retirees = [];
  for (const ss of document.styleSheets) {
    let regles; try { regles = ss.cssRules; } catch { continue; }
    for (let i = regles.length - 1; i >= 0; i--) if (/\.fl-tete\s*>\s*\.fl-date/.test(regles[i].cssText) && /top:\s*-4px/.test(regles[i].cssText)) { retirees.push([ss, regles[i].cssText, i]); ss.deleteRule(i); }
  }
  const avant = lire();
  for (const [ss, txt, i] of retirees.reverse()) ss.insertRule(txt, i);
  return { avant, apres, retirees: retirees.length };
}, VOLS.map(v => v.id));

function controler(nom, theme, m) {
  verifier(m.retirees === 1, `${nom} ${theme} : règle de la v0.43 trouvée (mesure avant / après)`);
  for (const v of VOLS) {
    const a = m.avant[v.id], b = m.apres[v.id];
    const dh = b.pos.date.haut - a.pos.date.haut;
    verifier(Math.abs(dh + 4) < 0.6 && b.pos.date.gauche === a.pos.date.gauche && b.pos.date.h === a.pos.date.h && b.taille === '23px' && Number(b.gras) >= 800,
      `${nom} ${theme} : ${v.id} : date remontée de ${Math.round(-dh * 10) / 10} px (23 px, très gras)`);
    const bouges = Object.keys(a.pos).filter(k => k !== 'date' && (Math.abs(b.pos[k].haut - a.pos[k].haut) > 0.5 || Math.abs(b.pos[k].gauche - a.pos[k].gauche) > 0.5 || Math.abs(b.pos[k].h - a.pos[k].h) > 0.5));
    verifier(!bouges.length && Math.abs(b.carte.haut - a.carte.haut) < 0.5 && Math.abs(b.carte.h - a.carte.h) < 0.5,
      `${nom} ${theme} : ${v.id} : trajet, pastille, ligne avion, heures, étiquettes, remarque et hauteur de carte (${Math.round(b.carte.h)} px) inchangés${bouges.length ? ' — bougé : ' + bouges.join(', ') : ''}`);
    const marge = b.pos.date.haut - (b.carte.haut + b.bordHaut);
    verifier(marge >= 4, `${nom} ${theme} : ${v.id} : haut des chiffres non coupé (${Math.round(marge * 10) / 10} px sous le bord de la carte)`);
  }
}

try {
  for (const [largeur, h, dsf] of [[390, 844, 2], [360, 780, 3]]) {
    console.log(`Téléphone ${largeur} px`);
    const T = await appareil(`${largeur} px`, nav, { viewport: { width: largeur, height: h }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true });
    for (const theme of ['clair', 'sombre']) {
      await T.emulateMedia({ colorScheme: theme === 'clair' ? 'light' : 'dark' });
      controler(`${largeur} px`, theme, await mesurer(T));
      await T.screenshot({ path: join(CAPT, `v043-${largeur}-${theme}.png`) });
    }
  }
  console.log('PC et iPad');
  controler('PC', 'clair', await mesurer(await appareil('PC', nav, { viewport: { width: 1280, height: 800 } })));
  const I = await appareil('iPad', navSafari, { viewport: { width: 1080, height: 810 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1' });
  controler('iPad', 'clair', await mesurer(I));

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.43 réussie.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await nav.close(); await navSafari.close(); srv.fermer();
}

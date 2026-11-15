// v0.42 : R104 interrupteur « Afficher 3, 7 et 30 jours » (menu des heures de l'accueil ; allumé par défaut ; gardé sur
// l'appareil ; ni synchro, ni NAS, ni sauvegarde ; totaux inchangés) ; R105 la DATE en tête des cartes de vols (23 px très
// gras), le trajet collé dessous (18 px gras, ~2 px), la pastille à droite ; ligne avion sans la date.
// Téléphone (Chromium 390 et 360 px, clair / sombre), PC, iPad (WebKit). Vols INVENTÉS.
// Captures : tests/navigateur/captures/v042-*.png (non commitées). Usage : node tests/navigateur/v042.mjs
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
  vol('v-long', 4, { missions: ['TRANSPORT ESSAI'], dep: 'LFTW', arr: 'EGLL', tempsTotal: 400, tempsCdB: 400,
    escales: [{ code: 'LSGG', attJour: 1, attNuit: 0, approches: 0 }, { code: 'LIMC', attJour: 1, attNuit: 0, approches: 0 }, { code: 'LEBL', attJour: 1, attNuit: 0, approches: 0 }] }),
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
const lum = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ---------- R105 : haut des cartes ----------
const mesurer = p => p.evaluate(ids => Object.fromEntries(ids.map(id => {
  const c = document.querySelector(`.flight[data-id="${id}"]`), top = c.querySelector('.fl-top');
  const d = top.querySelector('.fl-date'), r = top.querySelector('.fl-route'), b = top.querySelector('.fl-bloc'), lid = c.querySelector('.fl-id');
  const R = e => e.getBoundingClientRect(), sd = getComputedStyle(d), sr = getComputedStyle(r);
  const rd = R(d), rr = R(r), rb = R(b), rc = R(c);
  return [id, { premier: top.firstElementChild === d, date: d.textContent, tailleDate: parseFloat(sd.fontSize), grasDate: Number(sd.fontWeight), couleurDate: sd.color,
    tailleTrajet: parseFloat(sr.fontSize), grasTrajet: Number(sr.fontWeight), ecart: rr.top - rd.bottom, dateUneLigne: rd.height < parseFloat(sd.fontSize) * 1.6,
    dateEtPastille: rd.top < rb.bottom && rd.bottom > rb.top, trajetLibre: rr.right <= rb.left + 0.5 && rd.right <= rb.left + 0.5, dansCarte: rb.right <= rc.right + 0.5 && rr.right <= rc.right,
    ligneAvion: lid.innerText, dateDansLigne: !!lid.querySelector('.fl-date'), fond: getComputedStyle(c).backgroundColor, lignesTrajet: Math.round(rr.height / (parseFloat(sr.fontSize) * 1.25)) }];
})), VOLS.map(v => v.id));
function controler(nom, theme, m) {
  for (const v of VOLS) {
    const x = m[v.id], dateAttendue = v.date.split('-').reverse().join('/');
    verifier(x.premier && x.date === dateAttendue && x.tailleDate === 23 && x.grasDate >= 800 && x.dateUneLigne && x.dateEtPastille,
      `${nom} ${theme} : ${v.id} : date « ${x.date} » en tête, 23 px très gras, sur la ligne de la pastille`);
    // v0.43 (R106) : la date est remontée de 4 px (décalage visuel) : 2 + 4 = environ 6 px entre la date et le trajet
    verifier(Math.abs(x.ecart - 6) <= 2 && x.grasTrajet >= 700 && (v.escales.length ? x.tailleTrajet <= 18 : x.tailleTrajet === 18) && x.trajetLibre && x.dansCarte,
      `${nom} ${theme} : ${v.id} : trajet ${x.tailleTrajet} px gras, ${Math.round(x.ecart * 10) / 10} px sous la date, jamais sous la pastille${x.lignesTrajet > 1 ? ` (${x.lignesTrajet} lignes)` : ''}`);
    verifier(!x.dateDansLigne && x.ligneAvion.startsWith('M91') && x.ligneAvion.includes('F-XZZA') && !x.ligneAvion.includes(x.date), `${nom} ${theme} : ${v.id} : ligne avion sans la date (« ${x.ligneAvion} »)`);
    verifier(contraste(x.couleurDate, x.fond) >= 7, `${nom} ${theme} : ${v.id} : date lisible (contraste ${contraste(x.couleurDate, x.fond).toFixed(1)})`);
  }
}

try {
  console.log('Téléphone 390 px');
  const T = await appareil('téléphone', nav, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const totaux = () => T.evaluate(() => ({ total: document.getElementById('h-total').textContent, bande: document.getElementById('h-strip').innerText,
    jours: [...document.querySelectorAll('#h-quick b')].map(b => b.textContent).join(' ') }));
  for (const theme of ['clair', 'sombre']) {
    await T.emulateMedia({ colorScheme: theme === 'clair' ? 'light' : 'dark' });
    controler('390 px', theme, await mesurer(T));
    await T.screenshot({ path: join(CAPT, `v042-0${theme === 'clair' ? 1 : 2}-tel-390-${theme}.png`) });
  }
  await T.emulateMedia({ colorScheme: 'light' });
  await T.locator('.flight[data-id="v-long"]').screenshot({ path: join(CAPT, 'v042-03-tel-390-trajet-long.png') });

  console.log('R104 : interrupteur « Afficher 3, 7 et 30 jours »');
  const avant = await totaux();
  const placeListe = () => T.evaluate(() => document.getElementById('list').getBoundingClientRect().top + scrollY); // par rapport au haut de la page
  const listeAvant = await placeListe();
  verifier(await T.isVisible('#h-quick') && avant.jours.split(' ').length === 3, `par défaut : 3 / 7 / 30 jours affichés (${avant.jours})`);
  await T.click('#h-strip'); await T.waitForSelector('#hs-modal:not([hidden])');
  verifier(await T.getAttribute('#hs-jours', 'aria-checked') === 'true' && (await T.textContent('#hs-modal .hs-jours .pname')) === 'Afficher 3, 7 et 30 jours', 'menu : interrupteur « Afficher 3, 7 et 30 jours » allumé');
  await T.screenshot({ path: join(CAPT, 'v042-04-tel-390-menu.png') });
  await T.click('#hs-jours');
  verifier(await T.getAttribute('#hs-jours', 'aria-checked') === 'false', 'éteint');
  await T.click('#hs-x');
  const listeApres = await placeListe(), hq = await T.evaluate(() => ({ disp: getComputedStyle(document.getElementById('h-quick')).display, h: document.getElementById('h-quick').getBoundingClientRect().height }));
  const apres = await totaux();
  verifier(hq.disp === 'none' && hq.h === 0 && listeApres < listeAvant - 40, `éteint : la ligne 3 / 7 / 30 disparaît, la liste remonte de ${Math.round(listeAvant - listeApres)} px`);
  verifier(apres.total === avant.total && apres.bande === avant.bande, `totaux inchangés (${apres.total})`);
  await T.screenshot({ path: join(CAPT, 'v042-05-tel-390-sans-3-7-30.png') });
  console.log('Fermer et rouvrir l\'app');
  await T.reload(); await T.waitForSelector('body[data-pret="1"]');
  verifier(await T.isHidden('#h-quick'), 'après réouverture : toujours caché');
  const prive = await T.evaluate(async () => {
    const { contenuComplet } = await import('./js/etat.js'), { creerSauvegarde } = await import('./js/sauvegarde.js'), { elementsDuCarnet } = await import('./js/synchro.js');
    const c = await contenuComplet(), s = creerSauvegarde(c);
    return { base: c.reglages.some(r => r.cle === 'afficherJours' && r.valeur === false), sauvegarde: s.reglages.some(r => r.cle === 'afficherJours'),
      synchro: elementsDuCarnet(c).some(e => e.magasin === 'reglages' && e.id === 'afficherJours') };
  });
  verifier(prive.base && !prive.sauvegarde && !prive.synchro, 'gardé sur l\'appareil seulement : ni dans la sauvegarde (copie NAS), ni dans la synchro');
  await T.click('#h-strip'); await T.waitForSelector('#hs-modal:not([hidden])');
  verifier(await T.getAttribute('#hs-jours', 'aria-checked') === 'false', 'le menu montre l\'interrupteur éteint');
  await T.click('#hs-jours'); await T.click('#hs-x');
  const remis = await totaux();
  verifier(await T.isVisible('#h-quick') && remis.jours === avant.jours && remis.total === avant.total, `rallumé : 3 / 7 / 30 jours de nouveau affichés (${remis.jours})`);

  console.log('Téléphone 360 px');
  const S = await appareil('360 px', nav, { viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  for (const theme of ['clair', 'sombre']) {
    await S.emulateMedia({ colorScheme: theme === 'clair' ? 'light' : 'dark' });
    controler('360 px', theme, await mesurer(S));
    verifier(await S.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `360 px ${theme} : rien ne dépasse de l'écran`);
    await S.screenshot({ path: join(CAPT, `v042-0${theme === 'clair' ? 6 : 7}-tel-360-${theme}.png`) });
  }
  await S.emulateMedia({ colorScheme: 'light' });
  await S.locator('.flight[data-id="v-long"]').screenshot({ path: join(CAPT, 'v042-08-tel-360-trajet-long.png') });

  console.log('PC et iPad');
  const P = await appareil('PC', nav, { viewport: { width: 1280, height: 800 } });
  controler('PC', 'clair', await mesurer(P));
  const I = await appareil('iPad', navSafari, { viewport: { width: 1080, height: 810 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1' });
  controler('iPad', 'clair', await mesurer(I));
  await I.click('#h-strip'); await I.waitForSelector('#hs-modal:not([hidden])'); await I.click('#hs-jours'); await I.click('#hs-x');
  verifier(await I.isHidden('#h-quick'), 'iPad : interrupteur éteint, ligne 3 / 7 / 30 cachée');

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.42 réussie.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await nav.close(); await navSafari.close(); srv.fermer();
}

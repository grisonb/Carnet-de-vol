// v0.45 : cartes des vols. R114 le trajet descend de 4 px sous le contour de la date (choix du pilote).
// R115 ligne avion 17 px (type 15 px), ligne des heures 15 px ; ligne avion sur UNE ligne (type réduit jusqu'à 13 px puis
// « … »). R116 haut de la pastille du temps = haut du contour de la date. Dans les trois cas la DATE ne bouge pas : mesuré
// avec et sans les règles de la v0.45. Mesures AU PIXEL sur capture (Chromium et WebKit, 390 et 360 px, clair et sombre).
// Vols, avions INVENTÉS. Captures : tests/navigateur/captures/v045-*.png (non commitées). Usage : node tests/navigateur/v045.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2026-11-15T08:00:00Z';
const jour = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const avion = (id, nom, immat, modele) => ({ id, immat, typeOACI: 'DH8D', modele, constructeur: 'ESSAI', nom, indicatif: '', equipage: 'MP', moteurs: 'ME',
  moteur: 'T', surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', creeLe: H, modifieLe: H });
const AVIONS = [avion('a1', 'M80', 'F-XZZA', 'Dash 8 Q400 MRE'), avion('a2', 'MILANO-80', 'F-XZZB', 'Dash 8 Q400 MRE Version longue ESSAI'),
  avion('a3', 'MILANO-81-ESSAI', 'F-XZZC', 'Canadair CL-415 Super Scooper amphibie bombardier d\'eau ESSAI très long')];
const vol = (id, j, champs) => ({ id, date: jour(j), hDep: '05:00', hArr: '06:18', mode: 'loc', dep: 'FMEP', arr: 'FMEP', escales: [], avionId: 'a1',
  tempsTotal: 78, tempsMP: null, tempsSE: null, tempsME: null, tempsCdB: 78, fonction: 'cdb', nomCdB: 'SELF', nomCopi: 'ZZX', missions: [], remarques: '', feux: 0,
  compteurs: {}, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie', ordre: Date.parse(`${jour(j)}T05:00Z`),
  creeLe: H, modifieLe: H, ...champs });
const VOLS = [
  vol('v-ent', 1, { missions: ['EX. FDF ESSAI (RUN)'] }),
  vol('v-feu', 2, { missions: ['FEU n°60 ESSAI'], feux: 1, compteurs: { largCdbDash: 3 }, avionId: 'a2', dep: 'LFTW', arr: 'LFMT', mode: 'utc' }),
  vol('v-long', 3, { missions: ['TRANSPORT ESSAI'], avionId: 'a3', dep: 'LFTW', arr: 'EGLL', escales: [{ code: 'LSGG', attJour: 1, attNuit: 0, approches: 0 }] }),
  vol('v-ifr', 4, { missions: ['TRANSPORT ESSAI'], tempsIFR: 60, approches: 2, avionId: 'a2', tempsTotal: 754 }),
];
const IDS = VOLS.map(v => v.id);

const srv = await serveur();
const { chromium, webkit } = playwright();
const nav = await chromium.launch(), navSafari = await webkit.launch();
const erreurs = [], bloquees = [];
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1';
async function appareil(nom, moteur, largeur, dsf) {
  const ctx = await moteur.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block', viewport: { width: largeur, height: 1000 }, deviceScaleFactor: dsf,
    isMobile: true, hasTouch: true, ...(moteur === webkit ? { userAgent: SAFARI } : {}) });
  await ctx.route('**/*', r => { const u = new URL(r.request().url()); if (u.hostname === '127.0.0.1') return r.continue(); bloquees.push(u.href); return r.abort(); });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|access control|restricted network port/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.evaluate(async ([as, vs]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols'], 'readwrite'); for (const a of as) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVIONS, VOLS]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
  return { p, ctx };
}

// Règles de la v0.45 retirées le temps d'une mesure « avant », puis remises
const basculerV045 = (p, retirer) => p.evaluate(retirer => {
  if (retirer) {
    window.__v045 = [];
    const cibles = [/^\.fl-tete > \.fl-route \{ margin-top: 2px; \}$/, /^\.fl-tete > \.fl-bloc \{ position: relative; top: -2\.5px; \}$/, /^\.flight \.fl-(id|meta)\b/];
    for (const ss of document.styleSheets) {
      let regles; try { regles = ss.cssRules; } catch { continue; }
      for (let i = regles.length - 1; i >= 0; i--) if (cibles.some(c => c.test(regles[i].cssText))) { window.__v045.push([ss, regles[i].cssText, i]); ss.deleteRule(i); }
    }
    return window.__v045.length;
  }
  for (const [ss, txt, i] of window.__v045.reverse()) ss.insertRule(txt, i);
  return window.__v045.length;
}, retirer);

const positions = p => p.evaluate(ids => Object.fromEntries(ids.map(id => {
  const c = document.querySelector(`.flight[data-id="${id}"]`), rc = c.getBoundingClientRect(), d = c.querySelector('.fl-date').getBoundingClientRect();
  return [id, { x: d.left - rc.left, y: d.top - rc.top, l: d.width, h: d.height, haut: d.top + scrollY }];
})), IDS);

// Mesure au pixel : contour de la date (haut, bas), haut de la pastille, haut de l'encre du trajet
async function pixels(p, id) {
  const c = p.locator(`.flight[data-id="${id}"]`);
  await c.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(80);
  const r = await p.evaluate(id => {
    const c = document.querySelector(`.flight[data-id="${id}"]`), b = s => c.querySelector(s).getBoundingClientRect();
    const d = b('.fl-date'), ro = b('.fl-route'), pa = b('.fl-bloc');
    return { d: { l: d.left, r: d.right, t: d.top, b: d.bottom }, ro: { l: ro.left, r: ro.right, t: ro.top, b: ro.bottom }, pa: { l: pa.left, r: pa.right, t: pa.top, b: pa.bottom } };
  }, id);
  const x0 = r.d.l - 6, y0 = r.d.t - 8, w = Math.max(r.pa.r, r.ro.r) - x0 + 4, h = Math.max(r.ro.b, r.pa.b) - y0 + 4;
  const png = (await p.screenshot({ clip: { x: x0, y: y0, width: w, height: h } })).toString('base64');
  return p.evaluate(async ([b64, r, x0, y0, w]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const D = g.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, Hh = cv.height, k = W / w;
    const X = x => Math.round((x - x0) * k), Y = y => Math.round((y - y0) * k);
    const fond = (() => { const i = (Y(r.d.b + 2) * W + X((r.d.r + r.pa.l) / 2)) * 4; return [D[i], D[i + 1], D[i + 2]]; })(); // blanc (ou fond sombre) de la carte
    const encre = (x, y) => { const i = (y * W + x) * 4; return Math.abs(D[i] - fond[0]) + Math.abs(D[i + 1] - fond[1]) + Math.abs(D[i + 2] - fond[2]) > 120; };
    const cx = X((r.d.l + r.d.r) / 2);
    let y = Y(r.d.t - 4); while (y < Hh && !encre(cx, y)) y++; const dateHaut = y;               // haut du contour de la date
    y = Y(r.d.b + 3); while (y > 0 && !encre(cx, y)) y--; const dateBas = y;                     // bas du contour de la date
    const px = X((r.pa.l + r.pa.r) / 2);
    y = Y(r.pa.t - 6); while (y < Hh && !encre(px, y)) y++; const pastilleHaut = y;              // haut de la bordure de la pastille
    let trajet = -1;                                                                              // première rangée d'encre du trajet
    for (let yy = dateBas + 1; yy < Hh && trajet < 0; yy++) for (let x = X(r.ro.l); x < Math.min(X(r.ro.r), X(r.pa.l) - 2); x++) if (encre(x, yy)) { trajet = yy; break; }
    return { dateHaut: dateHaut / k, dateBas: dateBas / k, pastilleHaut: pastilleHaut / k, trajet: trajet / k, ecartTrajet: (trajet - dateBas - 1) / k, ecartPastille: (pastilleHaut - dateHaut) / k };
  }, [png, r, x0, y0, w]);
}

const ligneAvion = p => p.evaluate(ids => Object.fromEntries(ids.map(id => {
  const c = document.querySelector(`.flight[data-id="${id}"]`), l = c.querySelector('.fl-id'), rl = l.getBoundingClientRect(), s = e => getComputedStyle(e);
  const nm = c.querySelector('.fl-nm'), rg = c.querySelector('.fl-reg'), mo = c.querySelector('.fl-mod'), me = c.querySelector('.fl-meta');
  const entier = e => e.scrollWidth <= e.clientWidth + 0.5 && e.getBoundingClientRect().right <= rl.right + 0.5;
  // une seule ligne : chaque partie sur une seule ligne de texte, la ligne avion d'une seule hauteur de ligne (17 px)
  const uneLigne = [nm, rg, mo].every(e => e.getClientRects().length === 1 && e.getBoundingClientRect().bottom <= rl.bottom + 0.5 && e.getBoundingClientRect().top >= rl.top - 0.5);
  return [id, { lignes: uneLigne && rl.height < 17 * 1.7 ? 1 : 2,
    hauteur: rl.height, nm: `${s(nm).fontSize} ${s(nm).fontWeight} ${s(nm).color}`, rg: `${s(rg).fontSize} ${s(rg).fontWeight} ${s(rg).color}`,
    mo: `${s(mo).fontSize} ${s(mo).fontWeight} ${s(mo).color}`, moT: parseFloat(s(mo).fontSize), coupe: mo.scrollWidth > mo.clientWidth + 0.5,
    nmEntier: entier(nm), rgEntier: entier(rg), moDedans: mo.getBoundingClientRect().right <= rl.right + 0.5, ellipse: s(mo).textOverflow,
    me: `${s(me).fontSize} ${s(me).fontWeight} ${s(me).color}`, meLignes: Math.round(me.getBoundingClientRect().height / parseFloat(s(me).lineHeight || 20)) }];
})), IDS);

try {
  for (const [mnom, moteur] of [['Chrome', nav], ['WebKit', navSafari]]) {
    for (const [largeur, dsf] of [[390, 3], [360, 2]]) {
      const nom = `${mnom} ${largeur} px`;
      const { p, ctx } = await appareil(nom, moteur, largeur, dsf);
      for (const theme of ['clair', 'sombre']) {
        await p.emulateMedia({ colorScheme: theme === 'clair' ? 'light' : 'dark' }); await p.waitForTimeout(120);
        const n = `${nom} ${theme}`;
        // Date : même place avec et sans les règles de la v0.45 (mesure du navigateur ET au pixel)
        const apres = await positions(p), pxApres = {};
        for (const id of IDS) pxApres[id] = await pixels(p, id);
        const avantStyle = await ligneAvion(p);
        verifier(await basculerV045(p, true) >= 5, `${n} : règles de la v0.45 retirées pour la mesure « avant »`);
        const lAvant = await ligneAvion(p);
        await p.evaluate(() => scrollTo(0, 0)); const avant = await positions(p), pxAvant = {};
        for (const id of IDS) pxAvant[id] = await pixels(p, id);
        await basculerV045(p, false); await p.waitForTimeout(80);
        for (const id of IDS) {
          const a = avant[id], b = apres[id], qa = pxAvant[id], qb = pxApres[id];
          verifier(a.x === b.x && a.y === b.y && a.l === b.l && a.h === b.h,
            `${n} : ${id} : date à la même place dans la carte (${b.x.toFixed(2)} ; ${b.y.toFixed(2)} ; ${b.l.toFixed(1)} × ${b.h.toFixed(1)} px avant et après)`);
          verifier(Math.abs((qb.dateBas - qb.dateHaut) - (qa.dateBas - qa.dateHaut)) <= 0.5,
            `${n} : ${id} : contour de la date identique au pixel (${(qb.dateBas - qb.dateHaut).toFixed(2)} px de haut)`);
          // choix du pilote : le trajet descend de 4 px (les tests mesuraient déjà environ 6 px, le téléphone 1 à 2 px)
          verifier(Math.abs(qb.ecartTrajet - qa.ecartTrajet - 4) <= 1, `${n} : ${id} : trajet descendu de ${(qb.ecartTrajet - qa.ecartTrajet).toFixed(2)} px : ${qb.ecartTrajet.toFixed(2)} px entre le bas du contour de la date et le haut du trajet (avant : ${qa.ecartTrajet.toFixed(2)} px)`);
          verifier(Math.abs(qb.ecartPastille) <= 1, `${n} : ${id} : haut de la pastille = haut du contour de la date (écart ${qb.ecartPastille.toFixed(2)} px ; avant : ${qa.ecartPastille.toFixed(2)} px)`);
        }
        // R115 : tailles, couleurs, graisses ; une seule ligne
        const L = await ligneAvion(p);
        for (const id of IDS) {
          const x = L[id], y = lAvant[id];
          const couleurGraisse = s => s.split(' ').slice(1).join(' ');
          verifier(x.nm.startsWith('17px') && x.rg.startsWith('17px') && x.me.startsWith('15px') && couleurGraisse(x.nm) === couleurGraisse(y.nm)
            && couleurGraisse(x.rg) === couleurGraisse(y.rg) && couleurGraisse(x.mo) === couleurGraisse(y.mo) && couleurGraisse(x.me) === couleurGraisse(y.me),
            `${n} : ${id} : nom et immatriculation 17 px, heures 15 px (avant ${y.nm.split(' ')[0]} / ${y.me.split(' ')[0]}), couleurs et graisses inchangées`);
          verifier(x.lignes === 1 && x.nmEntier && x.rgEntier && x.moDedans && x.moT >= 13 && x.moT <= 15 && (x.moT === 15 || avantStyle[id].moT < 15) && (!x.coupe || x.moT === 13),
            `${n} : ${id} : ligne avion sur UNE ligne, nom et immatriculation entiers, type ${x.moT} px${x.coupe ? ' puis « … »' : ''}`);
        }
        verifier(L['v-ent'].moT === 15 && !L['v-ent'].coupe, `${n} : cas habituel (« M80 F-XZZA Dash 8 Q400 MRE ») : type 15 px, rien de coupé`);
        if (largeur === 360) verifier(L['v-long'].moT === 13 && L['v-long'].coupe && L['v-long'].ellipse === 'ellipsis', `${n} : cas très long : type réduit à 13 px puis « … »`);
        await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(80);
        await p.screenshot({ path: join(CAPT, `v045-${mnom}-${largeur}-${theme}.png`) });
      }
      await ctx.close();
    }
  }
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.45 réussie.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await nav.close(); await navSafari.close(); srv.fermer();
}

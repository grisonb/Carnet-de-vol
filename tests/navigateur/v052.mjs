// v0.52 : R126 toutes les bulles des cartes de vol ont un contour (1,5 px, taille extérieure inchangée : mesurée avec et
// sans les règles de la v0.52), CDB et Copi en vert ; R127 / R129 « Dash 8 » affiché dans le menu et la bande, libellé
// exact (casse respectée), choix déjà faits gardés ; R128 « Dash 8 / Année » (année civile, Dash 8 réels seulement), qui
// repart à zéro au 1er janvier (horloge simulée). Vols, avions, trigrammes INVENTÉS. Chromium 390 px et WebKit.
// Captures : tests/navigateur/captures/v052-*.png (non commitées). Usage : node tests/navigateur/v052.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2026-11-15T08:00:00Z';
const avion = (id, immat, typeOACI, modele, sim = false) => ({ id, immat, typeOACI, modele, constructeur: 'ESSAI', nom: '', indicatif: '', equipage: 'MP', moteurs: 'ME',
  moteur: 'T', surface: 'L', train: 'tricycle', etiquettes: [], sim, photo: null, remarques: '', creeLe: H, modifieLe: H });
const AVIONS = [avion('a1', 'F-XZZA', 'DH8D', 'Dash 8 Q400 MR'), avion('a2', 'F-XZZB', 'DH8D', 'Dash 8 Q400 MRE'), avion('a3', 'F-XZZC', 'CL2T', 'CL-415'), avion('s1', 'SIM-ESSAI', 'DH8D', 'Simulateur ESSAI', true)];
const vol = (id, date, avionId, minutes, champs = {}) => ({ id, date, hDep: '10:00', hArr: '11:30', mode: 'utc', dep: 'LFTW', arr: 'LFTW', escales: [], avionId, tempsTotal: avionId === 's1' ? 0 : minutes,
  tempsMP: null, tempsSE: null, tempsME: null, tempsCdB: minutes, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: 'ZZX', missions: [], remarques: '', feux: 0, compteurs: {}, etiquettes: [],
  attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: avionId === 's1' ? minutes : 0, source: 'saisie', ordre: Date.parse(`${date}T10:00Z`), creeLe: H, modifieLe: H, ...champs });
const VOLS = [
  vol('v-dec', '2025-12-31', 'a1', 100),                                            // année précédente
  vol('v-jan', '2026-01-01', 'a1', 60),                                             // 1er janvier
  vol('v-nov', '2026-11-10', 'a2', 90, { fonction: 'copi', nomCdB: 'ZZY', nomCopi: 'SELF', tempsCdB: 0, tempsCopi: 90 }), // copi : compte
  vol('v-cl', '2026-11-12', 'a3', 200),                                             // CL-415
  vol('v-sim', '2026-11-13', 's1', 120),                                            // simulateur Dash : exclu
  vol('v-bulles', '2026-11-14', 'a1', 75, { missions: ['FEU n°60 ESSAI'], feux: 1, compteurs: { largCdbDash: 2 }, tempsIFR: 30, approches: 1, tempsNuit: 20, attNuit: 1 }),
  vol('v-ent', '2026-11-15', 'a1', 50, { missions: ['ENT. OPS'] }),
  vol('v-2027', '2027-01-01', 'a1', 40),                                            // pour le passage au 1er janvier
];
// Dash 8 réels, 2026, jusqu'au 21/11 : v-jan 60 + v-nov 90 + v-bulles 75 + v-ent 50 = 275 min
const ANCIENS_CHOIX = ['famille:CL-415', 'famille:Dash 8 Q400', 'familleCdB:Dash 8 Q400'];

const srv = await serveur();
const { chromium, webkit } = playwright();
const nav = await chromium.launch(), navSafari = await webkit.launch();
const bloquees = [], erreurs = [];
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1';
async function appareil(nom, moteur) {
  const ctx = await moteur.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', ...(moteur === webkit ? { userAgent: SAFARI } : {}) });
  await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|access control|restricted network port/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.clock.install({ time: new Date('2026-11-21T10:00:00+01:00') });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.evaluate(async ([as, vs, b]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols', 'reglages'], 'readwrite');
    for (const a of as) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
    t.objectStore('reglages').put({ cle: 'bandeHeures', valeur: b }); // choix faits AVANT la mise à jour (mêmes identifiants)
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVIONS, VOLS, ANCIENS_CHOIX]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  return { p, ctx };
}

// Bulles : contour (bord + liseré), couleurs, hauteur ; avec et sans les règles de la v0.52
const bulles = p => p.evaluate(() => [...document.querySelectorAll('#list .flight .chips .chip')].map(c => {
  const s = getComputedStyle(c), r = c.getBoundingClientRect();
  return { id: c.closest('.flight').dataset.id, t: c.textContent, classe: c.className, l: r.width, h: r.height, bord: s.borderTopColor, epaisseur: parseFloat(s.borderTopWidth),
    ombre: s.boxShadow, fond: s.backgroundColor, encre: s.color };
}));
const basculer = (p, retirer) => p.evaluate(retirer => {
  if (retirer) {
    window.__v052 = [];
    for (const ss of document.styleSheets) { let rr; try { rr = ss.cssRules; } catch { continue; }
      for (let i = rr.length - 1; i >= 0; i--) if (/fn-cdb|fn-copi|--bord-plein|\.chips \.chip\.fn, :root \.flight \.chips \.chip\.mi:not/.test(rr[i].cssText)) { window.__v052.push([ss, rr[i].cssText, i]); ss.deleteRule(i); } }
    return window.__v052.length;
  }
  for (const [ss, t, i] of window.__v052.reverse()) ss.insertRule(t, i);
  return window.__v052.length;
}, retirer);
const transparent = c => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';

try {
  for (const [mnom, moteur] of [['Chromium', nav], ['WebKit', navSafari]]) {
    const { p, ctx } = await appareil(mnom, moteur);
    console.log(mnom);

    // ---------- R126 ----------
    const apres = await bulles(p);
    verifier(await basculer(p, true) >= 5, `${mnom} : règles de la v0.52 retirées pour la mesure « avant »`);
    const avant = await bulles(p);
    await basculer(p, false);
    verifier(apres.length >= 12 && apres.every((b, i) => Math.abs(b.h - avant[i].h) < 0.01 && Math.abs(b.l - avant[i].l) < 0.01),
      `${mnom} : ${apres.length} bulles, taille extérieure identique à avant (hauteur ${[...new Set(apres.map(b => b.h.toFixed(1)))].join(' / ')} px)`);
    const sansContour = apres.filter(b => transparent(b.bord));
    verifier(!sansContour.length, `${mnom} : toutes les bulles ont un contour visible${sansContour.length ? ' — sans : ' + sansContour.map(b => b.t).join(', ') : ''}`);
    const nouvelles = apres.filter((b, i) => transparent(avant[i].bord));
    verifier(nouvelles.length >= 6 && nouvelles.every(b => b.epaisseur === 1 && new RegExp(`^${b.bord.replace(/[()]/g, '\\$&')} 0px 0px 0px 0\\.5px`).test(b.ombre)),
      `${mnom} : ${nouvelles.length} bulles sans contour avant (${nouvelles.map(b => b.t).join(', ')}) : contour 1 + 0,5 = 1,5 px`);
    const deja = apres.filter((b, i) => !transparent(avant[i].bord));
    verifier(deja.every(b => { const a = avant[apres.indexOf(b)]; return a.bord === b.bord && a.epaisseur === b.epaisseur && a.ombre === b.ombre; }),
      `${mnom} : bulles qui avaient déjà un contour inchangées (${deja.map(b => b.t).join(', ')})`);
    const clair = nouvelles.filter(b => !/feu|ent|gaar|nuit/.test(b.classe));
    verifier(clair.every(b => b.bord === b.encre), `${mnom} : fond clair : contour de la couleur du texte`);
    const plein = { feu: 'rgb(179, 40, 40)', ent: 'rgb(170, 86, 13)', nuit: 'rgb(32, 43, 48)' };
    const pleines = nouvelles.filter(b => /feu|ent|nuit/.test(b.classe));
    verifier(pleines.length >= 3 && pleines.every(b => b.bord === plein[/feu/.test(b.classe) ? 'feu' : /ent/.test(b.classe) ? 'ent' : 'nuit']),
      `${mnom} : fond plein (${pleines.map(b => b.t).join(', ')}) : contour de la même teinte, plus foncée`);
    const cdb = apres.find(b => b.t === 'CdB'), // v0.53 (R131) : « CdB »
      copi = apres.find(b => b.t === 'Copi ZZX'), cdbAutre = apres.find(b => b.t === 'CdB ZZY'), copiFn = apres.find(b => b.t === 'Copi.');
    verifier(cdb.fond === 'rgb(200, 230, 201)' && cdb.encre === 'rgb(27, 94, 32)' && cdb.bord === 'rgb(27, 94, 32)' && cdbAutre.fond === cdb.fond && cdbAutre.encre === cdb.encre,
      `${mnom} : CDB (et « CdB ZZY ») : fond #c8e6c9, texte et contour #1b5e20`);
    verifier(copi.fond === 'rgb(236, 246, 237)' && copi.encre === 'rgb(67, 160, 71)' && copi.bord === 'rgb(67, 160, 71)' && copiFn.fond === copi.fond,
      `${mnom} : Copi (« Copi ZZX », « Copi. ») : fond #ecf6ed, texte et contour #43a047`);
    await p.locator('.flight[data-id="v-bulles"]').evaluate(e => e.scrollIntoView({ block: 'center' }));
    await p.screenshot({ path: join(CAPT, `v052-bulles-${mnom}.png`) });
    await p.evaluate(() => scrollTo(0, 0));

    // ---------- R127 / R129 ----------
    const bande = () => p.$$eval('#h-strip>div', l => l.map(d => ({ l: d.querySelector('span').textContent, v: d.querySelector('b').textContent, casse: getComputedStyle(d.querySelector('span')).textTransform,
      vu: d.querySelector('span').innerText })));
    const b1 = await bande();
    verifier(JSON.stringify(b1.map(x => x.vu)) === JSON.stringify(['CL-415', 'Dash 8', 'Dash 8 / CdB']) && b1.every(x => x.casse === 'none'),
      `${mnom} : bande : ${b1.map(x => `« ${x.vu} »`).join(', ')} (casse respectée, choix d'avant gardés)`);
    await p.click('#h-strip'); await p.waitForSelector('#hs-modal:not([hidden])');
    const menu = await p.$$eval('#hs-typ [data-hs]', l => l.map(b => ({ l: b.textContent, cle: b.dataset.hs, on: b.getAttribute('aria-pressed') })));
    verifier(menu.slice(0, 4).map(m => m.l).join('|') === 'Dash 8|Dash 8 / CdB|Dash 8 / Copi|Dash 8 / Année' && menu.filter(m => m.on === 'true').map(m => m.l).sort().join('|') === 'CL-415|Dash 8|Dash 8 / CdB',
      `${mnom} : menu : ${menu.map(m => m.l + (m.on === 'true' ? ' ✓' : '')).join(' ; ')}`);

    // ---------- R128 ----------
    await p.click('#hs-typ [data-hs="familleAnnee:Dash 8 Q400"]'); await p.waitForTimeout(150); await p.click('#hs-x');
    const b2 = await bande();
    verifier(b2.length === 4 && b2[3].vu === 'Dash 8 / Année' && b2[3].v === '4h35', `${mnom} : « Dash 8 / Année » = ${b2[3]?.v} (Dash 8 réels de 2026 : 1h00 + 1h30 + 1h15 + 0h50 ; ni 2025, ni CL-415, ni simulateur)`);
    const enr = await p.evaluate(async () => (await import('./js/etat.js')).reglage('bandeHeures'));
    verifier(enr.join('|') === [...ANCIENS_CHOIX, 'familleAnnee:Dash 8 Q400'].join('|'), `${mnom} : choix enregistrés avec les mêmes identifiants qu'avant`);
    await p.screenshot({ path: join(CAPT, `v052-bande-${mnom}.png`), clip: { x: 0, y: 0, width: 390, height: 360 } });
    // 1er janvier 2027 : repart à zéro (seul le vol du jour compte)
    await p.clock.setSystemTime(new Date('2027-01-01T12:00:00+01:00'));
    await p.evaluate(async () => (await import('./js/ui/carnet.js')).rafraichirCarnet());
    await p.waitForTimeout(150);
    const b3 = await bande();
    verifier(b3[3].v === '0h40', `${mnom} : au 1er janvier 2027 : « Dash 8 / Année » = ${b3[3].v} (repart à zéro, seul le vol du jour compte)`);
    const total = b3.find(x => x.vu === 'Dash 8').v;
    verifier(total === '6h55', `${mnom} : le total « Dash 8 » ne change pas avec l'année (${total} = tous les vols Dash 8 réels, toutes années)`);
    await ctx.close();
  }
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.52 réussie.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await nav.close(); await navSafari.close(); srv.fermer();
}

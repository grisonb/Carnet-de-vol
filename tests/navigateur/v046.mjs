// v0.46 : R117 nom / trigramme de l'autre pilote en gras 20 px ; R118 date de la fiche en gras, à la plus grande taille qui
// tient : les deux cases ET le bouton + gardent leur taille (mesure avec et sans les règles de la v0.46), texte non coupé
// (MESURE au pixel contre le même texte dessiné à part), icône calendrier visible (Chrome), case utilisable, en lecture
// seule et en modification. R120 noms de modèles dans le menu des heures et la bande (Dash 8 Q400 MR + MRE regroupés,
// CL-415, un bouton par nom pour un même code), anciens choix (CL2T, DH8D total, DH8D CdB) convertis tout seuls.
// Chromium et WebKit, 390 et 360 px. Avions, immatriculations, trigrammes INVENTÉS.
// Captures : tests/navigateur/captures/v046-*.png (non commitées). Usage : node tests/navigateur/v046.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE, fermerFiche } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2026-11-15T08:00:00Z';
const jour = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const avion = (id, immat, typeOACI, modele, nom = '') => ({ id, immat, typeOACI, modele, constructeur: 'ESSAI', nom, indicatif: '', equipage: 'MP', moteurs: 'ME',
  moteur: 'T', surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', creeLe: H, modifieLe: H });
const AVIONS = [avion('a1', 'F-XZZA', 'DH8D', 'Dash 8 Q400 MR', 'M80'), avion('a2', 'F-XZZB', 'DH8D', 'Dash 8 Q400 MRE', 'M81'), avion('a3', 'F-XZZC', 'CL2T', 'CL-415'),
  avion('a4', 'F-XZZD', 'RALL', 'Rallye'), avion('a5', 'F-XZZE', 'DR40', 'DR400'), avion('a6', 'F-XZZF', 'DR40', 'DR400 Remorqueur ESSAI')];
const vol = (id, j, avionId, minutes, champs = {}) => ({ id, date: jour(j), hDep: '10:00', hArr: '11:30', mode: 'utc', dep: 'LFTW', arr: 'LFTW', escales: [], avionId,
  tempsTotal: minutes, tempsMP: null, tempsSE: null, tempsME: null, tempsCdB: minutes, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: 'ZZX', missions: [], remarques: '',
  feux: 0, compteurs: {}, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie', ordre: Date.parse(`${jour(j)}T10:00Z`),
  creeLe: H, modifieLe: H, ...champs });
const VOLS = [vol('v1', 1, 'a1', 90), vol('v2', 2, 'a2', 120, { tempsCdB: 0, tempsCopi: 120, fonction: 'copi', nomCdB: 'ZZY', nomCopi: 'SELF' }), vol('v3', 3, 'a3', 200),
  vol('v4', 4, 'a4', 75), vol('v5', 5, 'a5', 50), vol('v6', 6, 'a6', 40)];
const ANCIENS = ['type:CL2T', 'type:DH8D', 'typeCdB:DH8D'];
const hm = m => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;

const srv = await serveur();
const { chromium, webkit } = playwright();
const nav = await chromium.launch(), navSafari = await webkit.launch();
const erreurs = [], bloquees = [];
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1';
async function appareil(nom, moteur, largeur) {
  const ctx = await moteur.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block', viewport: { width: largeur, height: 820 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, ...(moteur === webkit ? { userAgent: SAFARI } : {}) });
  await ctx.route('**/*', r => { const u = new URL(r.request().url()); if (u.hostname === '127.0.0.1') return r.continue(); bloquees.push(u.href); return r.abort(); });
  await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|access control|restricted network port/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.evaluate(async ([as, vs, b]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols', 'reglages'], 'readwrite');
    for (const a of as) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
    t.objectStore('reglages').put({ cle: 'bandeHeures', valeur: b }); // anciens choix (codes OACI), comme avant la mise à jour
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVIONS, VOLS, ANCIENS]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
  return { p, ctx };
}

// ---------- R117 / R118 ----------
const boites = p => p.evaluate(() => Object.fromEntries(['#f-copi', '#f-date', '#p-add'].map(s => {
  const e = document.querySelector(s), r = e.getBoundingClientRect(), c = getComputedStyle(e);
  return [s, { x: r.left, y: r.top + scrollY, l: r.width, h: r.height, taille: parseFloat(c.fontSize), gras: Number(c.fontWeight) }];
})));
// Règles de la v0.46 (fiche) retirées le temps de mesurer « avant », puis remises
const basculer = (p, retirer) => p.evaluate(retirer => {
  if (retirer) {
    window.__v046 = [];
    for (const ss of document.styleSheets) {
      let regles; try { regles = ss.cssRules; } catch { continue; }
      for (let i = regles.length - 1; i >= 0; i--) if (/^#f-copi|^#f-date\.datein/.test(regles[i].cssText)) { window.__v046.push([ss, regles[i].cssText, i]); ss.deleteRule(i); }
    }
    document.getElementById('f-date').dataset.t = document.getElementById('f-date').style.getPropertyValue('--date-t');
    document.getElementById('f-date').style.removeProperty('--date-t');
    return window.__v046.length;
  }
  for (const [ss, txt, i] of window.__v046.reverse()) ss.insertRule(txt, i);
  const d = document.getElementById('f-date'); d.style.setProperty('--date-t', d.dataset.t);
  return window.__v046.length;
}, retirer);

// Encre d'un élément (au pixel) : groupes de colonnes (texte, puis l'icône à droite) et hauteur
async function encre(p, sel, marge = 3) {
  const r = await p.locator(sel).boundingBox();
  const png = (await p.screenshot({ clip: { x: r.x, y: r.y, width: r.width, height: r.height } })).toString('base64');
  return p.evaluate(async ([b64, w, marge]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const D = g.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, Hh = cv.height, k = W / w, m = Math.round(marge * k);
    const i0 = (Math.round(Hh / 2) * W + m) * 4, fond = [D[i0], D[i0 + 1], D[i0 + 2]];
    const ink = (x, y) => { const i = (y * W + x) * 4; return Math.abs(D[i] - fond[0]) + Math.abs(D[i + 1] - fond[1]) + Math.abs(D[i + 2] - fond[2]) > 150; };
    const cols = [], lignes = [];
    for (let x = m; x < W - m; x++) for (let y = m; y < Hh - m; y++) if (ink(x, y)) { cols.push(x); break; }
    for (let y = m; y < Hh - m; y++) for (let x = m; x < W - m; x++) if (ink(x, y)) { lignes.push(y); break; }
    const groupes = [];
    for (const x of cols) { const gr = groupes.at(-1); if (gr && x - gr[1] <= 8 * k) gr[1] = x; else groupes.push([x, x]); }
    return { groupes: groupes.map(([a, b]) => [a / k, b / k]), haut: lignes.length ? lignes[0] / k : -1, bas: lignes.length ? lignes.at(-1) / k : -1, hauteur: Hh / k };
  }, [png, r.width, marge]);
}
// Le même texte dessiné à part (même police), pour comparer la largeur d'encre
async function encreReference(p, sel, texte) {
  await p.evaluate(([sel, texte]) => {
    const e = document.querySelector(sel), c = getComputedStyle(e), d = document.createElement('div');
    d.id = 'ref-encre'; d.textContent = texte;
    Object.assign(d.style, { position: 'fixed', left: '10px', top: '10px', zIndex: 99999, background: c.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#fff' : c.backgroundColor,
      color: c.color, font: `${c.fontWeight} ${c.fontSize} ${c.fontFamily}`, letterSpacing: c.letterSpacing, padding: '6px 10px', whiteSpace: 'nowrap', lineHeight: '1.6' });
    document.body.appendChild(d);
  }, [sel, texte]);
  const e = await encre(p, '#ref-encre', 2);
  await p.evaluate(() => document.getElementById('ref-encre').remove());
  return e;
}
const largeurTexte = e => (e.groupes.length ? e.groupes[0][1] - e.groupes[0][0] : 0);

async function controlerFiche(nom, p, mode) {
  const apres = await boites(p);
  verifier(await basculer(p, true) >= 3, `${nom} ${mode} : règles de la v0.46 retirées pour la mesure « avant »`);
  const avant = await boites(p);
  await basculer(p, false); await p.waitForTimeout(60);
  const meme = (a, b) => Math.abs(a.x - b.x) < 0.1 && Math.abs(a.y - b.y) < 0.1 && Math.abs(a.l - b.l) < 0.1 && Math.abs(a.h - b.h) < 0.1;
  verifier(meme(avant['#f-copi'], apres['#f-copi']) && meme(avant['#p-add'], apres['#p-add']),
    `${nom} ${mode} : case de l'autre pilote identique (${apres['#f-copi'].l.toFixed(1)} × ${apres['#f-copi'].h.toFixed(1)} px), bouton + immobile`
    + (meme(avant['#f-copi'], apres['#f-copi']) && meme(avant['#p-add'], apres['#p-add']) ? '' : ` — avant ${JSON.stringify(avant)} après ${JSON.stringify(apres)}`));
  verifier(apres['#f-copi'].taille === 20 && apres['#f-copi'].gras >= 700 && avant['#f-copi'].taille === 16,
    `${nom} ${mode} : autre pilote en gras ${apres['#f-copi'].taille} px (avant ${avant['#f-copi'].taille} px)`);
  verifier(meme(avant['#f-date'], apres['#f-date']), `${nom} ${mode} : case de la date identique (${apres['#f-date'].l.toFixed(1)} × ${apres['#f-date'].h.toFixed(1)} px)`);
  verifier(apres['#f-date'].taille >= 18 && apres['#f-date'].taille <= 24 && apres['#f-date'].gras >= 700,
    `${nom} ${mode} : date en gras ${apres['#f-date'].taille} px (avant ${avant['#f-date'].taille} px, plus grande taille qui tient)`);
  // texte non coupé : même largeur et même hauteur d'encre que le même texte dessiné à part
  const [aa, mm, jj] = (await p.inputValue('#f-date')).split('-');
  for (const [sel, texte] of [['#f-date', `${jj}/${mm}/${aa}`], ['#f-copi', await p.inputValue('#f-copi')]]) {
    await p.locator(sel).evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(60);
    const e = await encre(p, sel), ref = await encreReference(p, sel, texte);
    const l = largeurTexte(e), lr = largeurTexte(ref);
    // coupé = encre plus étroite (ou moins haute) que le même texte dessiné à part ; Chrome espace un peu les champs date
    verifier(l >= lr - 2 && l <= lr + 8 && (e.bas - e.haut) >= (ref.bas - ref.haut) - 1.5 && e.haut > 0.5 && e.bas < e.hauteur - 0.5,
      `${nom} ${mode} : « ${texte} » entier dans sa case (encre ${l.toFixed(1)} px de large pour ${lr.toFixed(1)} attendus, ${(e.bas - e.haut).toFixed(1)} px de haut pour ${(ref.bas - ref.haut).toFixed(1)} ; haut ${e.haut.toFixed(1)}, bas ${e.bas.toFixed(1)} / ${e.hauteur.toFixed(1)})`);
    // (lecture seule : Chrome masque de lui-même l'icône d'un champ non modifiable, comme en v0.44)
    if (sel === '#f-date' && moteurDe(nom) === 'Chrome' && mode !== 'lecture seule') {
      verifier(e.groupes.length >= 2 && e.groupes.at(-1)[0] > e.groupes[0][1] + 4, `${nom} ${mode} : icône du calendrier visible à droite, séparée de la date`);
    }
  }
}
const moteurDe = nom => nom.split(' ')[0];

try {
  for (const [mnom, moteur] of [['Chrome', nav], ['WebKit', navSafari]]) {
    for (const largeur of [390, 360]) {
      const nom = `${mnom} ${largeur} px`;
      const { p, ctx } = await appareil(nom, moteur, largeur);
      console.log(nom);

      // R120 : bande de l'accueil (anciens choix convertis tout seuls)
      const bande = await p.$$eval('#h-strip>div', l => l.map(d => ({ v: d.querySelector('b').textContent, l: d.querySelector('span').textContent, txt: getComputedStyle(d.querySelector('span')).textTransform })));
      verifier(JSON.stringify(bande.map(b => b.l)) === JSON.stringify(['CL-415', 'Dash 8 Q400', 'Dash 8 Q400 CdB'])
        && bande[0].v === hm(200) && bande[1].v === hm(90 + 120) && bande[2].v === hm(90),
        `${nom} : anciens choix (CL2T, DH8D total, DH8D CdB) -> ${bande.map(b => `« ${b.l} » ${b.v}`).join(', ')} (Dash MR + MRE regroupés)`);
      const coupes = await p.$$eval('#h-strip span, #h-strip b', l => l.filter(e => e.scrollWidth > e.clientWidth + 0.5 || e.getClientRects().length > 1).map(e => e.textContent));
      verifier(!coupes.length, `${nom} : bande sur une ligne, rien de coupé${coupes.length ? ' — ' + coupes.join(', ') : ''}`);
      await p.screenshot({ path: join(CAPT, `v046-accueil-${mnom}-${largeur}.png`) });

      // R120 : menu « Choisir les heures affichées »
      await p.click('#h-strip'); await p.waitForSelector('#hs-modal:not([hidden])');
      const menu = await p.$$eval('#hs-typ [data-hs]', l => l.map(b => ({ l: b.textContent, cle: b.dataset.hs, on: b.getAttribute('aria-pressed') })));
      verifier(JSON.stringify(menu.map(m => m.l)) === JSON.stringify(['Dash 8 Q400', 'Dash 8 Q400 CdB', 'Dash 8 Q400 Copi', 'CL-415', 'Rallye', 'DR400', 'DR400 Remorqueur ESSAI'])
        && menu.filter(m => m.on === 'true').map(m => m.l).sort().join('|') === ['CL-415', 'Dash 8 Q400', 'Dash 8 Q400 CdB'].sort().join('|'),
        `${nom} : menu par type d'appareil : ${menu.map(m => m.l + (m.on === 'true' ? ' ✓' : '')).join(' ; ')}`);
      const ordre = await p.$$eval('#hs-ordre .pname', l => l.map(e => e.textContent));
      verifier(JSON.stringify(ordre) === JSON.stringify(['CL-415', 'Dash 8 Q400', 'Dash 8 Q400 CdB']), `${nom} : ordre d'affichage gardé (${ordre.join(', ')})`);
      await p.screenshot({ path: join(CAPT, `v046-menu-${mnom}-${largeur}.png`) });
      if (mnom === 'Chrome' && largeur === 390) {
        // cocher « Rallye » : enregistré avec les nouvelles clés, ordre gardé
        await p.click('#hs-typ [data-hs="famille:Rallye"]'); await p.waitForTimeout(200);
        const enr = await p.evaluate(async () => (await import('./js/etat.js')).reglage('bandeHeures'));
        verifier(JSON.stringify(enr) === JSON.stringify(['famille:CL-415', 'famille:Dash 8 Q400', 'familleCdB:Dash 8 Q400', 'famille:Rallye']),
          `${nom} : cocher « Rallye » : choix enregistrés en noms de modèles, même ordre (${enr.join(', ')})`);
        await p.click('#hs-typ [data-hs="famille:Rallye"]'); await p.waitForTimeout(150);
      }
      await p.click('#hs-x');

      // R117 / R118 : fiche d'un vol, en lecture seule puis en modification
      await p.click('.flight[data-id="v1"]'); await p.waitForSelector('#v-saisie:not([hidden])'); await p.waitForTimeout(250);
      await controlerFiche(nom, p, 'lecture seule');
      await p.screenshot({ path: join(CAPT, `v046-fiche-${mnom}-${largeur}.png`) });
      await p.click('#f-edit'); await p.waitForTimeout(150);
      await controlerFiche(nom, p, 'modification');
      // la case date reste utilisable : on peut la toucher et changer la date
      await p.locator('#f-date').click(); await p.waitForTimeout(100);
      const focus = await p.evaluate(() => document.activeElement && document.activeElement.id);
      await p.fill('#f-date', '2026-01-09'); await p.waitForTimeout(120);
      verifier(focus === 'f-date' && await p.inputValue('#f-date') === '2026-01-09' && await p.evaluate(() => !document.getElementById('f-date').readOnly),
        `${nom} : case de la date utilisable en modification (toucher, nouvelle date)`);
      await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(80); // (sans le surlignage du champ actif)
      await controlerFiche(nom, p, 'nouvelle date');
      await fermerFiche(p);
      await ctx.close();
    }
  }
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.46 réussie.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await nav.close(); await navSafari.close(); srv.fermer();
}

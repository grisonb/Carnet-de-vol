// v0.51 (R125) : cases OPS / IFR : CHAQUE morceau (titre, J-, date) centré verticalement dans la case (MESURE de l'encre,
// pas des boîtes), police qui suit la largeur (17 / 26 / 17 à 360 px, plus grande au-delà, au plus 20 / 30 / 20), marges ≥ 10 px.
// 360, 393, 412 px ; densités ×2 et ×3 ; Chromium (sans text-box : solution de repli) et WebKit (text-box), plus WebKit forcé
// sur la solution de repli. Contenus « J-30 » / « J+12 » et « J-0 ». FAUX serveur local du socle (dates INVENTÉES).
// Captures : tests/navigateur/captures/v051-*.png (non commitées). Usage : node tests/navigateur/v051.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier as verifierStrict, RACINE } from './outils.mjs';
// V051_SONDE=1 : tout mesurer sans s'arrêter au premier écart (réglage de la solution de repli)
const verifier = process.env.V051_SONDE ? (ok, m) => console.log((ok ? 'ok ' : 'KO ') + m) : verifierStrict;

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const fr = n => { const d = new Date(Date.UTC(2026, 10, 17 + n)); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; };
const etat = { ops: 31, ifr: -11 }; // « avant le » dans 31 jours -> J-30 ; il y a 11 jours -> J+12
const srv = await serveur();
const faux = createServer((req, res) => {
  res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, version: 1, colonnes: [{ titre: 'Vol OPS a partir du', valeur: fr(7) }, { titre: 'Vol OPS avant le', valeur: fr(etat.ops) },
    { titre: 'vol IFR avant le', valeur: fr(etat.ifr) }] }));
});
await new Promise(ok => faux.listen(0, '127.0.0.1', ok));
const ADRESSE = `http://127.0.0.1:${faux.address().port}/macros/s/ESSAI/exec`;
const { chromium, webkit } = playwright();
const nav = await chromium.launch(), navSafari = await webkit.launch();
const bloquees = [], erreurs = [];
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1';

async function appareil(nom, moteur, largeur, dsf, repli) {
  const ctx = await moteur.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: largeur, height: 700 }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', ...(moteur === webkit ? { userAgent: SAFARI } : {}) });
  await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
  if (repli) await ctx.addInitScript(() => { const v = CSS.supports.bind(CSS); CSS.supports = (...a) => (String(a[0]).startsWith('text-box') ? false : v(...a)); });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|access control/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.clock.install({ time: new Date('2026-11-17T10:00:00+01:00') });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  if (repli) { // WebKit sur la solution de repli : text-box retiré, l'app le croit absent (comme Chrome avant la v133)
    await p.evaluate(() => { const st = document.createElement('style'); st.textContent = '.sc-l>span{text-box:none !important}'; document.head.append(st); });
  }
  await p.evaluate(async a => { const e = await import('./js/etat.js'); await e.enregistrerReglage('socleAdresse', a); }, ADRESSE);
  await p.waitForFunction(() => !document.getElementById('h-socle').hidden, null, { timeout: 10000 });
  await p.evaluate(() => document.fonts.ready);
  return { p, ctx };
}
const actualiser = async p => { await p.click('#rafraichir'); await p.waitForFunction(() => !document.getElementById('rafraichir').classList.contains('tourne'), null, { timeout: 30000 }); await p.waitForTimeout(150); };

// Encre de chaque morceau dans sa case : écart haut / bas (case entière, 30 px), marges gauche / droite de la case
async function mesurer(p) {
  const res = [];
  const n = await p.locator('#h-socle .sc').count();
  for (let i = 0; i < n; i++) {
    const c = p.locator('#h-socle .sc').nth(i), b = await c.boundingBox();
    const fondCase = await c.evaluate(e => getComputedStyle(e).backgroundColor.match(/\d+/g).slice(0, 3).map(Number));
    const parts = await c.evaluate(e => { const r = e.getBoundingClientRect(); return [...e.querySelectorAll('.sc-l>span')].map(s => { const q = s.getBoundingClientRect(), st = getComputedStyle(s);
      return { g: q.left - r.left, d: q.right - r.left, texte: s.textContent, taille: parseFloat(st.fontSize), lignes: s.getClientRects().length }; }); });
    const tampon = await p.screenshot({ clip: b }), png = tampon.toString('base64');
    if (process.env.V051_CAPT) (await import('node:fs')).writeFileSync(`${process.env.V051_CAPT}-${i}-${Date.now()}.png`, tampon);
    const m = await p.evaluate(async ([b64, w, parts, fondCase]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
      const D = g.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height, k = W / w;
      // encre = pixel plus proche du blanc (texte) que de la couleur de la case (son style) : les bords
      // adoucis comptent à moitié, de la même façon en haut et en bas
      const fond = (fondCase[0] + fondCase[1] + fondCase[2]) / 3, seuil = (fond + 255) / 2;
      const blanc = (x, y) => { const i = (y * W + x) * 4; return (D[i] + D[i + 1] + D[i + 2]) / 3 > seuil; };
      const morceaux = parts.map(pt => {
        let haut = -1, bas = -1;
        // (les 2 rangées du haut et du bas : bord de la case mêlé au fond de la page ; le texte n'y va jamais)
        for (let y = 2; y < H - 2; y++) for (let x = Math.max(0, Math.floor(pt.g * k)); x < Math.min(W, Math.ceil(pt.d * k)); x++) if (blanc(x, y)) { if (haut < 0) haut = y; bas = y; break; }
        return { haut: haut / k, bas: (H - 1 - bas) / k };
      });
      let g0 = -1, d0 = -1;
      for (let x = 2; x < W - 2; x++) for (let y = Math.round(12 * k); y < Math.round(18 * k); y++) if (blanc(x, y)) { if (g0 < 0) g0 = x; d0 = x; break; } // bande du milieu, sans les colonnes du bord
      return { morceaux, gauche: g0 / k, droite: (W - 1 - d0) / k };
    }, [png, b.width, parts, fondCase]);
    res.push({ h: b.height, parts, ...m });
  }
  return res;
}


try {
  for (const [mnom, moteur, repli] of [['Chromium (repli sans text-box)', nav, false], ['WebKit (text-box)', navSafari, false], ['WebKit forcé sur le repli', navSafari, true]]) {
    for (const largeur of [360, 393, 412]) {
      for (const dsf of [2, 3]) {
        const nom = `${mnom} ${largeur} px ×${dsf}`;
        const { p, ctx } = await appareil(nom, moteur, largeur, dsf, repli);
        for (const [ops, ifr, attendu] of [[31, -11, 'J-30 / J+12'], [1, 6, 'J-0 / J-5']]) {
          etat.ops = ops; etat.ifr = ifr; await actualiser(p);
          const m = await mesurer(p);
          const textes = m.map(c => c.parts.map(x => x.texte).join(' ')).join(' | ');
          for (const c of m) {
            const ecarts = c.morceaux.map(x => x.haut - x.bas);
            verifier(c.h === 30 && c.parts.every(x => x.lignes === 1) && ecarts.every(e => Math.abs(e) <= 1),
              `${nom} « ${c.parts.map(x => x.texte).join(' ')} » : case 30 px, chaque morceau centré (encre haut − bas : ${ecarts.map(e => e.toFixed(2)).join(' / ')} px)`);
            verifier(c.gauche >= 10 && c.droite >= 10, `${nom} « ${c.parts.map(x => x.texte).join(' ')} » : marges ≥ 10 px (${c.gauche.toFixed(1)} / ${c.droite.toFixed(1)})`);
          }
          const tailles = m[0].parts.map(x => x.taille);
          verifier(tailles[0] <= 20 && tailles[1] <= 30 && tailles[2] <= 20 && Math.abs(tailles[1] / tailles[0] - 26 / 17) < 0.07 /* tailles au pixel entier (repli : 17/26, 19/28, 20/30) */, `${nom} ${attendu} : tailles ${tailles.map(t => t.toFixed(1)).join(' / ')} px (proportions gardées, au plus 20 / 30 / 20)`);
          if (largeur === 360) { verifier(tailles.join('/') === '17/26/17', `${nom} : à 360 px, tailles actuelles 17 / 26 / 17`); }
          else verifier(tailles[1] > 26, `${nom} : plus large que 360 px : police plus grande (${tailles[1].toFixed(1)} px)`);
          if (attendu === 'J-30 / J+12' && dsf === 3 && !repli) await p.screenshot({ path: join(CAPT, `v051-${mnom.split(' ')[0]}-${largeur}.png`), clip: { x: 0, y: 0, width: largeur, height: 420 } });

        }
        await ctx.close();
      }
    }
  }
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.51 réussie.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await nav.close(); await navSafari.close(); faux.close(); srv.fermer();
}

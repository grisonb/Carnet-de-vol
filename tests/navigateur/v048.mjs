// v0.48 (R122) : socle OPS / IFR sur l'accueil. FAUX serveur local qui imite la web app Google (dates INVENTÉES, jamais
// la vraie adresse) + FAUX NAS v5 (synchro). Horloge de la page simulée (aujourd'hui = 17/11/2026).
// - sans adresse : aucune case, aucun appel ; réglage « Tester » ({ok:false}, titres absents, OK) ;
// - J-10 vert, J-4 / J-0 orange, J+1 / J+4 rouge, date de la veille ; lecture d'hier + serveur muet aujourd'hui : gris ;
// - cases 30 px, 8 px d'écart, une ligne, centrées (MESURE au pixel, Chromium et WebKit), marges ≥ 8 px à 360 px ;
// - bande des heures plus basse, polices identiques ; adresse revenue seule par la synchro (appareil B) et par une
//   sauvegarde restaurée (appareil C). Toute adresse non locale est BLOQUÉE. Usage : node tests/navigateur/v048.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const MAINTENANT = new Date('2026-11-17T10:00:00+01:00'), AUJ = '2026-11-17';
const jour = n => { const d = new Date(Date.UTC(2026, 10, 17 + n)); return d.toISOString().slice(0, 10); };
const fr = iso => iso.split('-').reverse().join('/');
const court = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// ---------- Faux serveurs ----------
const srv = await serveur();
const socle = { mode: 'ok', ops: jour(11), ifr: jour(5), appels: 0, pendus: [] };
const nas = { mdp: 'mot-de-passe-essai-48', rev: 0, el: new Map() };
const faux = createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), action = u.searchParams.get('action');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Carnet-Cle, X-Carnet-Empreinte', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const morceaux = [];
  req.on('data', m => morceaux.push(m));
  req.on('end', () => {
    const json = (o, code = 200) => { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(code === 200 ? o : { ...o, code })); };
    // Faux « web app Google » du socle (GET, sans clé)
    if (u.pathname === '/macros/s/ESSAI/exec') {
      socle.appels++;
      if (socle.mode === 'muet') { socle.pendus.push(res); return; }
      if (socle.mode === 'erreur') return json({ ok: false, erreur: 'feuille ESSAI introuvable' });
      const colonnes = [{ titre: 'Dernier vol', valeur: fr(jour(-1)) }, { titre: 'Dernier Feu / Ent. OPS', valeur: fr(jour(-1)) }];
      if (socle.mode !== 'titres') colonnes.push({ titre: 'vol IFR avant le', valeur: fr(socle.ifr) }, { titre: 'Vol OPS avant le', valeur: fr(socle.ops) });
      return json({ ok: true, version: 1, aujourdhui: fr(AUJ), lu: '2026-11-17T09:00:00.000Z', colonnes });
    }
    // Faux NAS v5 (synchro ; pas de vols NPF)
    if (req.headers['x-carnet-cle'] !== nas.mdp) return json({ erreur: 'mot-de-passe' }, 401);
    if (action === 'test') return json({ ok: true, copies: 0, cle: 'carnet', version: 5 });
    if (action === 'envoyer') return json({ ok: true, id: 'x', vols: 1, taille: 1, verification: 'empreinte' });
    if (action === 'vols-liste') return json({ vols: [] });
    if (action === 'synchro-etat') return json({ ok: true, rev: nas.rev, nombres: {} });
    if (action === 'synchro-recevoir') {
      const depuis = Number(u.searchParams.get('depuis')), limite = Number(u.searchParams.get('limite'));
      const tous = [...nas.el.entries()].filter(([, e]) => e.rev > depuis).sort((a, b) => a[1].rev - b[1].rev);
      const page = tous.slice(0, limite).map(([cle, e]) => ({ magasin: cle.split('/')[0], id: cle.slice(cle.indexOf('/') + 1), ...e }));
      const suite = tous.length > limite;
      return json({ ok: true, rev: nas.rev, elements: page, suite, jusqua: suite ? page.at(-1).rev : nas.rev });
    }
    if (action === 'synchro-envoyer') {
      const b = JSON.parse(Buffer.concat(morceaux).toString());
      const acceptees = [], deja = [], conflits = [];
      for (const m of b.modifications) {
        const cle = `${m.magasin}/${m.id}`, a = nas.el.get(cle), revA = a ? a.rev : 0, donnees = m.supprime ? null : m.donnees;
        if (a && !!a.supprime === !!m.supprime && JSON.stringify(a.donnees) === JSON.stringify(donnees)) { deja.push({ magasin: m.magasin, id: m.id, rev: revA }); continue; }
        if (m.base !== revA) { conflits.push({ magasin: m.magasin, id: m.id, rev: revA }); continue; }
        nas.rev++; nas.el.set(cle, { rev: nas.rev, supprime: !!m.supprime, donnees, appareil: b.appareil, le: '2026-11-17T10:00:00+01:00' });
        acceptees.push({ magasin: m.magasin, id: m.id, rev: nas.rev });
      }
      return json({ ok: true, rev: nas.rev, acceptees, deja, conflits });
    }
    return json({ erreur: 'action' }, 400);
  });
});
await new Promise(ok => faux.listen(0, '127.0.0.1', ok));
const F = `http://127.0.0.1:${faux.address().port}`;
const ADRESSE_NAS = `${F}/carnet-api/`, ADRESSE_SOCLE = `${F}/macros/s/ESSAI/exec`;

const { chromium, webkit } = playwright();
const nav = await chromium.launch(), navSafari = await webkit.launch();
const bloquees = [], erreurs = [];
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1';
async function appareil(nom, moteur = nav, largeur = 390, dsf = 2) {
  const ctx = await moteur.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: largeur, height: 844 }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', acceptDownloads: true, ...(moteur === webkit ? { userAgent: SAFARI } : {}) });
  await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
  await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|Access-Control|access control|restricted network port/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.clock.install({ time: MAINTENANT });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  return { p, ctx };
}
const attendreQue = async (cond, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await cond()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const cases = p => p.evaluate(() => { const z = document.getElementById('h-socle'); if (z.hidden) return null;
  return [...z.querySelectorAll('.sc')].map(c => ({ cle: c.dataset.socle, classe: [...c.classList].find(x => x.startsWith('sc-')), texte: [...c.querySelectorAll('.sc-l>span')].map(s => s.textContent).join(' ') })); });
const tapAdresse = async (p, adr) => {
  await p.click('.tabs button[data-v="plus"]'); await p.click('#pl-socle'); await p.waitForSelector('#so-adr');
  await p.fill('#so-adr', adr);
};
const tester = async p => { await p.click('#so-test'); await p.waitForFunction(() => !/en cours/.test(document.getElementById('so-res').textContent) && document.getElementById('so-res').textContent, null, { timeout: 25000 }); return p.textContent('#so-res'); };
const actualiser = async p => { await p.click('#rafraichir'); await p.waitForFunction(() => !document.getElementById('rafraichir').classList.contains('tourne'), null, { timeout: 30000 }); };

// Mesures : une ligne, centrage horizontal (DOM) et vertical (encre blanche au pixel), tailles, couleurs
async function mesurer(p) {
  const m = await p.evaluate(() => [...document.querySelectorAll('#h-socle .sc')].map(c => {
    const r = c.getBoundingClientRect(), l = c.querySelector('.sc-l').getBoundingClientRect(), st = getComputedStyle(c);
    const parties = [...c.querySelectorAll('.sc-l>span')].map(s => { const cs = getComputedStyle(s); return { lignes: s.getClientRects().length, taille: cs.fontSize, gras: cs.fontWeight, chiffres: cs.fontVariantNumeric, haut: s.getBoundingClientRect().top }; });
    return { x: r.left, y: r.top, l: r.width, h: r.height, rayon: st.borderTopLeftRadius, fond: st.backgroundColor, encre: st.color, ombre: st.boxShadow,
      gauche: l.left - r.left, droite: r.right - l.right, lignes: parties.every(x => x.lignes === 1), parties, contenu: l.width,
      ecartParties: (() => { const sp = [...c.querySelectorAll('.sc-l>span')].map(s => s.getBoundingClientRect()); return [sp[1].left - sp[0].right, sp[2].left - sp[1].right]; })() };
  }));
  for (const [i, c] of m.entries()) {
    const b = await p.locator('#h-socle .sc').nth(i).boundingBox();
    const png = (await p.screenshot({ clip: b })).toString('base64');
    c.v = await p.evaluate(async ([b64, w, clair]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
      const D = g.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height, k = W / w;
      // texte blanc sur fond de couleur (gris : texte foncé sur fond clair)
      const encre = (x, y) => { const i = (y * W + x) * 4, moy = (D[i] + D[i + 1] + D[i + 2]) / 3; return clair ? moy < 120 : (D[i] > 235 && D[i + 1] > 235 && D[i + 2] > 235); };
      let haut = -1, bas = -1, g0 = -1, d0 = -1;
      for (let y = 0; y < H; y++) for (let x = Math.round(14 * k); x < W - Math.round(14 * k); x++) if (encre(x, y)) { if (haut < 0) haut = y; bas = y; break; }
      for (let x = 0; x < W; x++) for (let y = Math.round(3 * k); y < H - Math.round(3 * k); y++) if (encre(x, y)) { if (g0 < 0) g0 = x; d0 = x; break; }
      return { haut: haut / k, bas: (H - 1 - bas) / k, gauche: g0 / k, droite: (W - 1 - d0) / k };
    }, [png, b.width, c.fond === 'rgb(199, 205, 214)']);
  }
  return m;
}
function controlerMise(nom, m, largeur) {
  verifier(m.length === 2 && Math.abs(m[1].x - (m[0].x + m[0].l) - 8) < 0.6 && m.every(c => c.h === 30 && c.rayon === '12px'), `${nom} : 2 cases côte à côte, 8 px d'écart, 30 px de haut, coins 12 px`);
  for (const c of m) {
    const [t, j, d] = c.parties;
    // v0.51 (R125) : 17 / 26 / 17 px à 360 px, plus grand au-delà (au plus 20 / 30 / 20), écart 7 px à la même échelle ;
    // chaque morceau centré dans la case (voir v051) : leurs hauts ne sont plus alignés
    const tj = parseFloat(j.taille), tt = parseFloat(t.taille), ech = tj / 26;
    const tailles = largeur === 360 ? (t.taille === '17px' && j.taille === '26px') : (tj >= 26 && tj <= 30 && tt <= 20);
    verifier(c.lignes && tailles && d.taille === t.taille && t.gras === '800' && j.gras === '800' && d.gras === '700'
      && /tabular-nums/.test(j.chiffres) && c.ecartParties.every(e => Math.abs(e - 7 * ech) < 1),
      `${nom} : ${c.parties.length} parties sur UNE ligne (${t.taille} / ${j.taille} / ${d.taille}, 800 / 800 / 700, chiffres à largeur fixe, écart ${c.ecartParties.map(e => e.toFixed(1)).join(' / ')} px)`);
    // (boîte du texte au centre à 1 px près ; l'encre peut différer un peu : espaces naturels des lettres « O » / « 1 »)
    verifier(Math.abs(c.gauche - c.droite) <= 1 && Math.abs(c.v.gauche - c.v.droite) <= 2, `${nom} : centré horizontalement (${c.gauche.toFixed(1)} / ${c.droite.toFixed(1)} px ; encre ${c.v.gauche.toFixed(1)} / ${c.v.droite.toFixed(1)})`);
    verifier(Math.abs(c.v.haut - c.v.bas) <= 1, `${nom} : centré verticalement (mesure au pixel : ${c.v.haut.toFixed(2)} px en haut, ${c.v.bas.toFixed(2)} px en bas)`);
    if (largeur === 360) verifier(c.v.gauche >= 8 && c.v.droite >= 8, `${nom} : 360 px : au moins 8 px de chaque côté (${c.v.gauche.toFixed(1)} / ${c.v.droite.toFixed(1)})`);
  }
}

try {
  console.log('Appareil A : sans adresse');
  const A = await appareil('A');
  await p_clock(A.p, 3000);
  await actualiser(A.p);
  verifier(await A.p.isHidden('#h-socle') && socle.appels === 0, 'sans adresse : aucune case, aucun appel à la feuille');

  console.log('Réglage : Tester');
  await tapAdresse(A.p, ADRESSE_SOCLE);
  socle.mode = 'erreur'; const e1 = await tester(A.p);
  verifier(/La feuille répond : feuille ESSAI introuvable/.test(e1), `{ok:false} : « ${e1} »`);
  socle.mode = 'titres'; const e2 = await tester(A.p);
  verifier(/introuvable/.test(e2), `titres absents : « ${e2} »`);
  socle.mode = 'ok'; const e3 = await tester(A.p);
  verifier(e3 === 'OK · OPS et IFR lus', `feuille correcte : « ${e3} »`);
  verifier(await A.p.isHidden('#h-socle'), 'tester n\'enregistre rien (pas encore de cases)');
  await A.p.screenshot({ path: join(CAPT, 'v048-01-reglage.png') });
  // NAS + synchro de référence, puis enregistrement de l'adresse
  await A.p.click('#ou-x');
  await A.p.click('#pl-sync'); await A.p.click('#sy-nas'); await A.p.fill('#nas-adr', ADRESSE_NAS); await A.p.fill('#nas-mdp', nas.mdp); await A.p.click('#nas-ok'); await A.p.waitForTimeout(400); await A.p.click('#ou-x');
  await A.p.click('#pl-sync'); await A.p.click('#sy-ref'); await A.p.click('#sr-ok');
  await A.p.waitForFunction(() => { const e = document.querySelector('#sr-res'); return e && e.textContent.trim() && !/en cours|Envoi :|Réception :|prêt \?/.test(e.textContent); }, null, { timeout: 60000 }); await A.p.click('#ou-x');
  await A.p.click('#pl-socle'); await A.p.fill('#so-adr', ADRESSE_SOCLE); await A.p.click('#so-ok');
  await A.p.click('.tabs button[data-v="carnet"]');
  verifier(await attendreQue(async () => !!(await cases(A.p))), 'adresse enregistrée : les cases apparaissent');

  console.log('Couleurs et jours restants');
  const attendus = [[11, 5, ['OPS J-10 ' + court(jour(10)), 'sc-vert'], ['IFR J-4 ' + court(jour(4)), 'sc-orange']],
    [1, 0, ['OPS J-0 ' + court(jour(0)), 'sc-orange'], ['IFR J+1 ' + court(jour(-1)), 'sc-rouge']],
    [-3, 6, ['OPS J+4 ' + court(jour(-4)), 'sc-rouge'], ['IFR J-5 ' + court(jour(5)), 'sc-orange']]];
  for (const [o, i, eo, ei] of attendus) {
    socle.ops = jour(o); socle.ifr = jour(i);
    await actualiser(A.p);
    const c = await cases(A.p);
    verifier(c && c[0].texte === eo[0] && c[0].classe === eo[1] && c[1].texte === ei[0] && c[1].classe === ei[1],
      `« avant le » OPS ${fr(socle.ops)}, IFR ${fr(socle.ifr)} -> ${c.map(x => `${x.texte} (${x.classe.slice(3)})`).join(' | ')}`);
  }
  const couleurs = await A.p.$$eval('#h-socle .sc', l => l.map(c => `${getComputedStyle(c).backgroundColor} ${getComputedStyle(c).color}`));
  verifier(couleurs[0] === 'rgb(211, 47, 47) rgb(255, 255, 255)' && couleurs[1] === 'rgb(232, 137, 43) rgb(255, 255, 255)', `rouge #d32f2f, orange #e8892b, texte blanc`);
  socle.ops = jour(11); socle.ifr = jour(30); await actualiser(A.p);
  verifier((await A.p.$eval('#h-socle .sc', c => getComputedStyle(c).backgroundColor)) === 'rgb(46, 125, 50)', 'vert #2e7d32');
  await A.p.screenshot({ path: join(CAPT, 'v048-02-accueil-390.png'), clip: { x: 0, y: 0, width: 390, height: 420 } });

  console.log('Mise en page (Chromium 390)');
  socle.ops = jour(11); socle.ifr = jour(5); await actualiser(A.p);
  controlerMise('Chromium 390 px', await mesurer(A.p), 390);
  // bande des heures plus basse, polices identiques (avec / sans les règles de la v0.48)
  const bande = () => A.p.evaluate(() => { const b = document.getElementById('h-strip'); return { h: b.getBoundingClientRect().height,
    polices: [...b.querySelectorAll('b, span')].map(e => getComputedStyle(e).fontSize).join(',') }; });
  const apres = await bande();
  const ret = await A.p.evaluate(() => { const r = []; for (const ss of document.styleSheets) { let rr; try { rr = ss.cssRules; } catch { continue; }
    for (let i = rr.length - 1; i >= 0; i--) if (/^#v-carnet \.hstrip( b| span)? \{ (padding-top: 4px; padding-bottom: 4px|line-height: 1|margin-top: 1px); \}$/.test(rr[i].cssText)) { r.push([ss, rr[i].cssText, i]); ss.deleteRule(i); } }
    window.__r = r; return r.length; });
  const avant = await bande();
  await A.p.evaluate(() => { for (const [ss, t, i] of window.__r.reverse()) ss.insertRule(t, i); });
  verifier(ret === 3 && apres.h < avant.h - 5 && apres.polices === avant.polices, `bande des heures : ${avant.h.toFixed(1)} -> ${apres.h.toFixed(1)} px de haut, polices identiques`);

  console.log('Lecture d\'hier, serveur muet aujourd\'hui : cases grises');
  await A.p.clock.setSystemTime(new Date('2026-11-18T09:00:00+01:00'));
  socle.mode = 'muet';
  await A.p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await A.p.clock.runFor(2500); await attendreQue(() => socle.pendus.length > 0);
  await A.p.clock.runFor(20500);
  verifier(await attendreQue(async () => (await cases(A.p))?.every(c => c.classe === 'sc-gris')), 'pas de lecture réussie aujourd\'hui : les deux cases en gris');
  const g = await A.p.$$eval('#h-socle .sc', l => l.map(c => ({ fond: getComputedStyle(c).backgroundColor, encre: getComputedStyle(c).color, ombre: getComputedStyle(c).boxShadow, t: [...c.querySelectorAll('.sc-l>span')].map(s => s.textContent).join(' ') })));
  verifier(g.every(x => x.fond === 'rgb(199, 205, 214)' && x.encre === 'rgb(79, 88, 104)' && x.ombre === 'none') && g[0].t === 'OPS J-9 ' + court(jour(10)),
    `gris #c7cdd6, texte #4f5868, sans ombre, dernières valeurs gardées (${g.map(x => x.t).join(' | ')})`);
  await A.p.screenshot({ path: join(CAPT, 'v048-03-gris.png'), clip: { x: 0, y: 0, width: 390, height: 420 } });
  for (const r of socle.pendus.splice(0)) r.destroy();
  socle.mode = 'ok';
  await A.p.clock.setSystemTime(MAINTENANT);

  console.log('360 px et WebKit');
  for (const [nom, moteur, largeur, dsf] of [['Chromium 360 px', nav, 360, 3], ['WebKit 390 px', navSafari, 390, 3], ['WebKit 360 px', navSafari, 360, 2]]) {
    const X = await appareil(nom, moteur, largeur, dsf);
    await X.p.evaluate(async adr => { const e = await import('./js/etat.js'); await e.enregistrerReglage('socleAdresse', adr); }, ADRESSE_SOCLE);
    verifier(await attendreQue(async () => !!(await cases(X.p))), `${nom} : cases affichées`);
    controlerMise(nom, await mesurer(X.p), largeur);
    await X.p.screenshot({ path: join(CAPT, `v048-04-${nom.replace(/\W+/g, '-')}.png`), clip: { x: 0, y: 0, width: largeur, height: 420 } });
    await X.ctx.close();
  }

  console.log('Appareil B neuf : l\'adresse arrive par la synchro');
  await A.p.clock.runFor(2000); await A.p.waitForTimeout(800);
  verifier([...nas.el.keys()].includes('reglages/socleAdresse'), 'adresse envoyée au NAS par la synchro de A');
  const B = await appareil('B');
  await B.p.click('.tabs button[data-v="plus"]'); await B.p.click('#pl-sync'); await B.p.click('#sy-nas'); await B.p.fill('#nas-adr', ADRESSE_NAS); await B.p.fill('#nas-mdp', nas.mdp); await B.p.click('#nas-ok'); await B.p.waitForTimeout(400); await B.p.click('#ou-x');
  await B.p.click('#pl-sync'); await B.p.click('#sy-mod'); await B.p.click('#sc-ok');
  await B.p.waitForFunction(() => { const e = document.querySelector('#sc-res'); return e && e.textContent.trim() && !/en cours|Envoi :|Réception :|prêt \?/.test(e.textContent); }, null, { timeout: 60000 }); await B.p.click('#ou-x');
  await B.p.click('.tabs button[data-v="carnet"]');
  verifier(await attendreQue(async () => (await cases(B.p))?.[0]?.texte === 'OPS J-10 ' + court(jour(10))) && await B.p.evaluate(async () => (await import('./js/etat.js')).reglage('socleAdresse')) === ADRESSE_SOCLE,
    'appareil B : adresse reçue par la synchro, cases affichées, sans rien saisir');

  console.log('Appareil C neuf : l\'adresse arrive avec une sauvegarde restaurée');
  await A.p.click('.tabs button[data-v="plus"]'); await A.p.click('#pl-save');
  const [dl] = await Promise.all([A.p.waitForEvent('download'), A.p.click('#sv-dl')]);
  const fichier = join(CAPT, 'v048-sauvegarde.json'); await dl.saveAs(fichier); await A.p.click('#ou-x');
  const C = await appareil('C');
  await C.p.click('.tabs button[data-v="plus"]');
  await C.p.setInputFiles('#file-restore', fichier); await C.p.click('#rs-ok');
  await C.p.click('.tabs button[data-v="carnet"]');
  verifier(await attendreQue(async () => (await cases(C.p))?.[0]?.texte === 'OPS J-10 ' + court(jour(10))), 'appareil C : adresse restaurée avec la sauvegarde, cases affichées');

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur (ni Google, ni NAS, ni VPS)' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.48 réussie.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  for (const r of socle.pendus) r.destroy();
  await nav.close(); await navSafari.close(); faux.closeAllConnections?.(); faux.close(); srv.fermer();
}
async function p_clock(p, ms) { await p.clock.runFor(ms); await p.waitForTimeout(300); }

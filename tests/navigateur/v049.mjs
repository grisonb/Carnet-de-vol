// v0.49 (R123) : l'adresse du socle (réglage partagé) passe d'un appareil à l'autre quand ils sont DÉJÀ synchronisés.
// FAUX NAS v5 local (synchro) + FAUX serveur qui imite la web app Google (dates INVENTÉES) ; horloge de la page simulée.
// A = téléphone (référence), B = PC (modification), chacun sa base. Toute adresse non locale est BLOQUÉE.
// - A colle l'adresse, A actualise, B actualise : B a l'adresse et les cases (aucun vol changé) ;
// - sans bouton : B la reçoit à sa synchro automatique (2 min) ;
// - B « vide d'origine » ne l'efface pas ; A l'efface volontairement : B n'a plus de cases ; la plus récente gagne ;
// - cas réel : B était en v0.47 (réglage inconnu sauté, repère passé dessus) puis mis à jour : rattrapé.
// Usage : node tests/navigateur/v049.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { serveur, playwright, verifier } from './outils.mjs';

const MAINTENANT = new Date('2026-11-17T10:00:00+01:00');
const srv = await serveur();
const nas = { mdp: 'mot-de-passe-essai-49', rev: 0, el: new Map() };
let appelsSocle = 0;
const faux = createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), action = u.searchParams.get('action');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Carnet-Cle, X-Carnet-Empreinte', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const morceaux = [];
  req.on('data', m => morceaux.push(m));
  req.on('end', () => {
    const json = (o, code = 200) => { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(code === 200 ? o : { ...o, code })); };
    if (u.pathname.startsWith('/macros/s/')) { // faux « web app Google » (deux adresses inventées)
      appelsSocle++;
      return json({ ok: true, version: 1, colonnes: [{ titre: 'Entrainement avant le', valeur: '28/11/2026' }, { titre: 'vol IFR avant le', valeur: '22/11/2026' }] });
    }
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
        nas.rev++; nas.el.set(cle, { rev: nas.rev, supprime: !!m.supprime, donnees, appareil: b.appareil, le: new Date().toISOString() });
        acceptees.push({ magasin: m.magasin, id: m.id, rev: nas.rev });
      }
      return json({ ok: true, rev: nas.rev, acceptees, deja, conflits });
    }
    return json({ erreur: 'action' }, 400);
  });
});
await new Promise(ok => faux.listen(0, '127.0.0.1', ok));
const F = `http://127.0.0.1:${faux.address().port}`;
const ADRESSE_NAS = `${F}/carnet-api/`, ADR1 = `${F}/macros/s/ESSAI-UN/exec`, ADR2 = `${F}/macros/s/ESSAI-DEUX/exec`;

const { chromium } = playwright();
const nav = await chromium.launch();
const bloquees = [], erreurs = [];
async function appareil(nom) {
  const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
  await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|Access-Control|access control/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.clock.install({ time: MAINTENANT });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  return { p, ctx };
}
const fini = (p, sel) => p.waitForFunction(s => { const e = document.querySelector(s); return e && e.textContent.trim() && !/en cours|Envoi :|Réception :|prêt \?/.test(e.textContent); }, sel, { timeout: 60000 });
async function rejoindre(p, role) {
  await p.click('.tabs button[data-v="plus"]'); await p.click('#pl-nas'); await p.fill('#nas-adr', ADRESSE_NAS); await p.fill('#nas-mdp', nas.mdp); await p.click('#nas-ok'); await p.waitForTimeout(400); await p.click('#ou-x');
  await p.click('#pl-sync');
  if (role === 'ref') { await p.click('#sy-ref'); await p.click('#sr-ok'); await fini(p, '#sr-res'); } else { await p.click('#sy-mod'); await p.click('#sc-ok'); await fini(p, '#sc-res'); }
  await p.click('#ou-x'); await p.click('.tabs button[data-v="carnet"]');
}
const reglerSocle = async (p, adr) => {
  await p.click('.tabs button[data-v="plus"]'); await p.click('#pl-socle'); await p.fill('#so-adr', adr); await p.click('#so-ok');
  await p.click('.tabs button[data-v="carnet"]');
};
const actualiser = async p => { await p.click('#rafraichir'); await p.waitForFunction(() => !document.getElementById('rafraichir').classList.contains('tourne'), null, { timeout: 30000 }); await p.waitForTimeout(300); };
const adresse = p => p.evaluate(async () => (await import('./js/etat.js')).reglage('socleAdresse') ?? '');
const avecCases = p => p.evaluate(() => !document.getElementById('h-socle').hidden && document.querySelectorAll('#h-socle .sc').length === 2);
const attendreQue = async (cond, ms = 10000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await cond()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const volsAvant = new Set();
// deux appareils neufs, déjà synchronisés ensemble (un vol inventé), sans adresse
async function paire() {
  nas.el.clear(); nas.rev = 0;
  const A = await appareil('A'), B = await appareil('B');
  await A.p.evaluate(async () => { const e = await import('./js/etat.js'); await e.enregistrerVol({ id: 'v-essai', date: '2026-11-10', hDep: '10:00', hArr: '11:00', mode: 'utc', dep: 'LFTW', arr: 'LFTW',
    escales: [], avionId: null, tempsTotal: 60, fonction: 'cdb', nomCdB: 'SELF', nomCopi: 'ZZX', missions: [], remarques: 'ESSAI', feux: 0, compteurs: {}, etiquettes: [], attJour: 1, attNuit: 0,
    approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie' }); });
  await rejoindre(A.p, 'ref'); await rejoindre(B.p, 'mod');
  await actualiser(A.p); await actualiser(B.p);
  volsAvant.clear(); for (const k of nas.el.keys()) if (k.startsWith('vols/')) volsAvant.add(`${k}@${nas.el.get(k).rev}`);
  return { A, B };
}
const volsInchanges = () => [...nas.el.keys()].filter(k => k.startsWith('vols/')).every(k => volsAvant.has(`${k}@${nas.el.get(k).rev}`));

try {
  console.log('1. A colle l\'adresse, A puis B actualisent');
  let { A, B } = await paire();
  verifier(await adresse(B.p) === '' && !(await avecCases(B.p)), 'au départ : pas d\'adresse, pas de cases sur B');
  await reglerSocle(A.p, ADR1); await actualiser(A.p); await actualiser(B.p);
  verifier(await adresse(B.p) === ADR1 && await attendreQue(() => avecCases(B.p)) && volsInchanges(), 'B a l\'adresse et les cases, sans qu\'aucun vol ait changé');

  console.log('2. Sans bouton : synchro automatique');
  await A.p.clock.runFor(1000); await reglerSocle(A.p, ADR2); await A.p.clock.runFor(1500); // A envoie tout seul (0,3 s après)
  verifier(await attendreQue(() => nas.el.get('reglages/socleAdresse')?.donnees?.valeur === ADR2), 'A envoie la nouvelle adresse tout seul');
  await B.p.clock.runFor(121000); // synchro automatique de B (toutes les 2 min)
  verifier(await attendreQue(async () => (await adresse(B.p)) === ADR2), 'B la reçoit à sa synchro automatique, sans bouton');

  console.log('3. A efface volontairement l\'adresse');
  await A.p.clock.runFor(60000); await reglerSocle(A.p, ''); await actualiser(A.p); await actualiser(B.p);
  verifier(await adresse(B.p) === '' && await attendreQue(async () => !(await avecCases(B.p))), 'effacement transmis : B n\'a plus de cases');
  verifier(!(await avecCases(A.p)), 'A non plus');
  await A.ctx.close(); await B.ctx.close();

  console.log('4. B « vide d\'origine » ne l\'efface pas');
  ({ A, B } = await paire());
  await reglerSocle(B.p, ''); // B touche « Enregistrer » sur la case vide
  await B.p.clock.runFor(60000);
  await reglerSocle(A.p, ADR1); await actualiser(A.p);
  await actualiser(B.p); await actualiser(A.p);
  verifier(await adresse(A.p) === ADR1 && await adresse(B.p) === ADR1 && nas.el.get('reglages/socleAdresse').donnees.valeur === ADR1 && await attendreQue(() => avecCases(B.p)),
    'B synchronise après A : l\'adresse de A n\'est pas effacée, B l\'a aussi');

  console.log('5. A et B changent l\'adresse : la plus récente gagne');
  await reglerSocle(A.p, ADR2); // 10:01 environ (horloge de A)
  await B.p.clock.runFor(10 * 60 * 1000); await reglerSocle(B.p, `${F}/macros/s/ESSAI-TROIS/exec`); // plus tard (horloge de B)
  await actualiser(A.p); await actualiser(B.p); await actualiser(A.p);
  const a5 = await adresse(A.p), b5 = await adresse(B.p);
  verifier(a5 === `${F}/macros/s/ESSAI-TROIS/exec` && b5 === a5, `la plus récente (celle de B) gagne sur les deux`);
  await B.p.clock.runFor(60000); await A.p.clock.runFor(30 * 60 * 1000); await reglerSocle(A.p, ADR1); // A, encore plus tard
  await actualiser(A.p); await actualiser(B.p);
  verifier(await adresse(A.p) === ADR1 && await adresse(B.p) === ADR1, 'puis A la change de nouveau, plus tard : la sienne gagne sur les deux');
  const conflits = await B.p.evaluate(async () => ((await import('./js/etat.js')).reglage('synchroEtat') || {}).conflits || []);
  verifier(!conflits.length, 'aucun conflit à choisir');
  await A.ctx.close(); await B.ctx.close();

  console.log('6. Cas réel : B était en v0.47 quand l\'adresse est partie, puis mis à jour');
  ({ A, B } = await paire());
  await reglerSocle(A.p, ADR1); await actualiser(A.p);
  // ce que la v0.47 laissait dans la base de B : réglage inconnu sauté (absent de la base et de la carte), repère passé dessus
  await B.p.evaluate(async rev => {
    const e = await import('./js/etat.js'), s = { ...e.reglage('synchroEtat') };
    s.rev = rev; delete s.reglagesConnus; s.carte = Object.fromEntries(Object.entries(s.carte || {}).filter(([k]) => k !== 'reglages/socleAdresse'));
    await e.ecrireReglageDiscret('synchroEtat', s);
  }, nas.rev);
  await B.p.reload(); await B.p.waitForSelector('body[data-pret="1"]');
  verifier(await adresse(B.p) === '', 'B (comme après la v0.47) : pas d\'adresse');
  await actualiser(B.p);
  verifier(await adresse(B.p) === ADR1 && await attendreQue(() => avecCases(B.p)), 'mis à jour : à la première synchro, l\'adresse sautée est rattrapée et les cases apparaissent');
  const etatB = await B.p.evaluate(async () => (await import('./js/etat.js')).reglage('synchroEtat'));
  verifier(Array.isArray(etatB.reglagesConnus) && etatB.reglagesConnus.includes('socleAdresse'), 'rattrapage noté : il n\'aura lieu qu\'une fois');

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur (ni Google, ni NAS, ni VPS)' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.49 réussie.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await nav.close(); faux.closeAllConnections?.(); faux.close(); srv.fermer();
}

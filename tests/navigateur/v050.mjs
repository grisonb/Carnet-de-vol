// v0.50 (R124) : case OPS = colonne « Vol OPS avant le ». FAUX serveur local qui imite la web app Google (dates INVENTÉES,
// colonnes pièges « Vol OPS a partir du » et « Entrainement avant le ») ; horloge de la page au 17/11/2026.
// Toute adresse non locale est BLOQUÉE. Usage : node tests/navigateur/v050.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { serveur, playwright, verifier } from './outils.mjs';

const fr = n => { const d = new Date(Date.UTC(2026, 10, 17 + n)); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; };
const etat = { sansOps: false };
const srv = await serveur();
const faux = createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  const colonnes = [{ titre: 'Dernier vol', valeur: fr(-1) }, { titre: 'Vol OPS a partir du', valeur: fr(7) }, { titre: 'Vol OPS avant le', valeur: fr(16) },
    { titre: 'Entrainement avant le', valeur: fr(31) }, { titre: 'vol IFR avant le', valeur: fr(10) }].filter(c => !(etat.sansOps && c.titre === 'Vol OPS avant le'));
  res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, version: 1, colonnes }));
});
await new Promise(ok => faux.listen(0, '127.0.0.1', ok));
const ADRESSE = `http://127.0.0.1:${faux.address().port}/macros/s/ESSAI/exec`;
const { chromium } = playwright();
const nav = await chromium.launch();
const bloquees = [], erreurs = [];
try {
  const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|access control/i.test(m.text())) erreurs.push(m.text()); });
  await p.clock.install({ time: new Date('2026-11-17T10:00:00+01:00') });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.click('.tabs button[data-v="plus"]'); await p.click('#pl-socle'); await p.fill('#so-adr', ADRESSE); await p.click('#so-ok');
  await p.click('.tabs button[data-v="carnet"]');
  await p.waitForFunction(() => !document.getElementById('h-socle').hidden, null, { timeout: 10000 });
  const cases = () => p.$$eval('#h-socle .sc', l => l.map(c => [...c.querySelectorAll('.sc-l>span')].map(s => s.textContent).join(' ')));
  const c = await cases();
  verifier(c[0] === `OPS J-15 ${fr(15).slice(0, 5)}`, `case OPS : « ${c[0]} » (« Vol OPS avant le » ${fr(16)} -> veille ${fr(15).slice(0, 5)} ; ni « a partir du », ni « Entrainement »)`);
  verifier(c[1] === `IFR J-9 ${fr(9).slice(0, 5)}`, `case IFR inchangée : « ${c[1]} »`);
  etat.sansOps = true;
  await p.click('.tabs button[data-v="plus"]'); await p.click('#pl-socle'); await p.click('#so-test');
  await p.waitForFunction(() => { const t = document.getElementById('so-res').textContent; return t && !/en cours/.test(t); }, null, { timeout: 25000 });
  const msg = await p.textContent('#so-res');
  verifier(msg === 'Colonne « Vol OPS avant le » introuvable dans la feuille.', `colonne absente, « Tester » : « ${msg} »`);
  await p.click('#ou-x'); await p.click('.tabs button[data-v="carnet"]');
  await p.click('#rafraichir'); await p.waitForFunction(() => !document.getElementById('rafraichir').classList.contains('tourne'), null, { timeout: 30000 });
  const c2 = await cases();
  verifier(c2[0] === c[0], 'colonne absente à la lecture : pas de plantage, dernières valeurs gardées');
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.50 réussie.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await nav.close(); faux.close(); srv.fermer();
}

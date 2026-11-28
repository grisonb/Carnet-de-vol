// v0.72 : R185 Valider enregistre puis ferme la fiche (retour à l'accueil à la même place, un seul titre par mois) ; enregistrement
// refusé : la fiche reste ouverte avec le message. R186 plus de grand bouton « Enregistrer » en bas : nouveau vol = Valider tout de
// suite ; le bas de la fiche (Trace du vol, Importer, Supprimer) visible et cliquable. 360 / 393 px. Carnet INVENTÉ, aucun serveur
// extérieur. Usage : node tests/navigateur/v072.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2025-10-01T08:00:00Z';
const AVIONS = [{ id: 'a1', immat: 'F-XZZA', typeOACI: 'DH8D', modele: 'Dash 8 Q400 MR', constructeur: 'ESSAI', nom: '', indicatif: '', equipage: 'MP', moteurs: 'ME', moteur: 'T',
  surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', hexAdsb: '', creeLe: H, modifieLe: H }];
const C0 = { largCdbDash: 0, largInstrCdbDash: 0, largCopiDash: 0, largCopiCL: 0, ecopages: 0, amerrCL: 0, amerrSEP: 0, largPara: 0 };
const vol = (id, date, h, champs = {}) => ({ id, date, hDep: h, hArr: `${String(+h.slice(0, 2) + 1).padStart(2, '0')}${h.slice(2)}`, mode: 'utc', dep: 'LFTW', arr: 'LFML', escales: [], avionId: 'a1',
  tempsTotal: 60, tempsMP: null, tempsSE: null, tempsME: null, tempsCdB: 60, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: '', nomInstructeur: '', nomExaminateur: '', missions: [],
  remarques: '', feux: 0, compteurs: { ...C0 }, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie',
  ordre: Date.parse(`${date}T${h}Z`), creeLe: H, modifieLe: H, ...champs });
const jour = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const VOLS = [];
for (let i = 0; i < 160; i++) for (let k = 0; k < 1 + (i % 2); k++) VOLS.push(vol(`v${i}-${k}`, jour('2025-01-03', i * 2), k ? '13:00' : '08:00'));

const srv = await serveur();
const { chromium } = playwright();
const nav = await chromium.launch();
const bloquees = [], erreurs = [];
const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
const p = await ctx.newPage();
p.on('pageerror', e => erreurs.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/i.test(m.text())) erreurs.push(m.text()); });
const onglet = v => p.click(`.tabs button[data-v="${v}"]`);
const vols = () => p.evaluate(async () => Object.fromEntries((await import('./js/etat.js')).etat.vols.map(v => [v.id, v])));
const titres = () => p.evaluate(async () => {
  const { dateAffichee } = await import('./js/ui/carnet.js'), { etat } = await import('./js/etat.js'), { MOIS } = await import('./js/temps.js'), par = new Map(etat.vols.map(v => [v.id, v]));
  const libelle = m => `${MOIS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`.toLowerCase();
  let courant = null, mal = 0; const vus = [];
  for (const e of document.querySelector('#list').children) {
    if (e.matches('h3.month')) { courant = e.textContent.trim().toLowerCase(); vus.push(courant); continue; }
    const c = e.querySelector('.flight'); if (c && libelle(dateAffichee(par.get(c.dataset.id)).slice(0, 7)) !== courant) mal++;
  }
  return { n: vus.length, doublons: vus.length - new Set(vus).size, mal };
});
const toutVoir = async () => { for (let k = 0; k < 30; k++) { await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(40); if (await p.isHidden('#list-debut')) break; }
  for (let k = 0; k < 30; k++) { await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(40); } };
// Carte ouverte loin dans la liste ; renvoie sa position à l'écran
const ouvrirLoin = async id => {
  await onglet('carnet');
  const c = p.locator(`#list .flight[data-id="${id}"]`);
  for (let k = 0; k < 30 && !(await c.count()); k++) { await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(60); }
  await c.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(250);
  const haut = await c.evaluate(e => Math.round(e.getBoundingClientRect().top));
  await p.locator(`#list .flight[data-id="${id}"] .fl-route`).click(); await p.waitForSelector('#v-saisie:not([hidden])');
  return haut;
};
const ici = id => p.evaluate(i => { const e = document.querySelector(`#list .flight[data-id="${i}"]`); return e ? Math.round(e.getBoundingClientRect().top) : null; }, id);
const carnetEASA = () => p.evaluate(async () => { const e = await import('./js/etat.js'), t = await import('./js/totaux.js'), d = await import('./js/pdf.js');
  const v = [...e.etat.vols].reverse(); return JSON.stringify([t.calculerTotaux(v, e.etat.avions, '2026-12-31'), d.paginer(v, e.etat.avions).map(x => [x.totalPage, x.cumul])]); });

try {
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.evaluate(async ([avs, vs]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols'], 'readwrite'); for (const a of avs) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVIONS, VOLS]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  verifier(Number((await p.evaluate(async () => (await import('./js/version.js')).VERSION)).split('.')[1]) >= 72, 'version 0.72 ou suivante');
  const easa0 = await carnetEASA();

  for (const [largeur, id, id2] of [[360, 'v101-1', 'v91-0'], [393, 'v121-1', 'v111-0']]) {
    await p.setViewportSize({ width: largeur, height: 852 }); await p.evaluate(() => scrollTo(0, 0));
    console.log(`${largeur} px`);
    // R185 : crayon, modification, Valider -> enregistré, retour à l'accueil au même endroit
    const haut = await ouvrirLoin(id);
    await p.click('#f-edit'); await p.fill('#f-rem', `MODIF ${largeur}`); await p.click('#f-ok'); await p.waitForSelector('#v-carnet:not([hidden])'); await p.waitForTimeout(300);
    const apres = await ici(id);
    verifier((await vols())[id].remarques === `MODIF ${largeur}` && apres !== null && Math.abs(apres - haut) <= 4, `crayon puis Valider : enregistré, retour à l'accueil au même endroit (carte à ${haut} px puis ${apres} px)`);
    await toutVoir(); let t = await titres();
    verifier(!t.doublons && !t.mal, `un seul titre par mois après le retour (${t.n} titres)`);
    // R185 / R183 : VOL JOURNÉE sans le crayon, Valider -> enregistré, fiche fermée
    await ouvrirLoin(id2);
    await p.click('#fe-zone [data-fe="journee"]'); await p.waitForTimeout(150);
    verifier(await p.isVisible('#f-ok') && !(await vols())[id2].frais, 'VOL JOURNÉE coché sans le crayon : Valider visible, rien d\'enregistré');
    await p.click('#f-ok'); await p.waitForSelector('#v-carnet:not([hidden])'); await p.waitForTimeout(300);
    verifier((await vols())[id2].frais.type === 'journee', 'Valider : enregistré, fiche fermée');
    await toutVoir(); t = await titres();
    verifier(!t.doublons && !t.mal, 'un seul titre par mois');
    // R186 : nouveau vol : Valider tout de suite, à la place du crayon
    await p.evaluate(() => scrollTo(0, 0)); await p.click('#fab'); await p.waitForSelector('#v-saisie:not([hidden])');
    const n = await p.evaluate(() => ({ ok: !!document.getElementById('f-ok').offsetParent, crayon: !!document.getElementById('f-edit').offsetParent, save: !!document.getElementById('save'),
      deborde: document.documentElement.scrollWidth > innerWidth, l: Math.round(document.getElementById('f-ok').getBoundingClientRect().width) }));
    verifier(n.ok && !n.crayon && !n.save && n.l >= 48 && !n.deborde, `nouveau vol : Valider (${n.l} px) à la place du crayon, plus de grand bouton « Enregistrer »`);
    await p.screenshot({ path: join(CAPT, `v072-nouveau-${largeur}.png`) });
    // Valider avec un champ invalide : la fiche reste ouverte avec le message
    await p.fill('#f-t0', '09'); await p.dispatchEvent('#f-t0', 'input');
    await p.click('#f-ok'); await p.waitForTimeout(300);
    const msg = await p.textContent('#f-err');
    verifier(await p.isVisible('#v-saisie') && msg.includes('Heures bloc incomplètes'), `champ invalide : la fiche reste ouverte avec le message (« ${msg} »)`);
    const avant = Object.keys(await vols()).length;
    await p.fill('#f-t0', '0900'); await p.fill('#f-t1', '1015'); await p.dispatchEvent('#f-t1', 'input'); await p.fill('#f-rem', `NOUVEAU ${largeur}`);
    await p.click('#f-ok'); await p.waitForSelector('#v-carnet:not([hidden])');
    const v = Object.values(await vols());
    verifier(v.length === avant + 1 && v.some(x => x.remarques === `NOUVEAU ${largeur}`), 'saisi puis Valider : vol créé, fiche fermée');
    // R186 : le bas de la fiche (Trace du vol, Importer, Supprimer) visible et cliquable, même en bas de l'écran
    await ouvrirLoin(id); await p.click('#f-edit');
    const bas = await p.evaluate(async () => {
      const libre = el => { if (!el || !el.offsetParent) return null; el.scrollIntoView({ block: 'end' }); const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.bottom - 6;
        const tabs = document.querySelector('.tabs').getBoundingClientRect(); if (y > tabs.top) window.scrollBy(0, y - tabs.top + 12);
        const r2 = el.getBoundingClientRect(), t = document.elementFromPoint(r2.left + r2.width / 2, r2.bottom - 6); return !!t && (t === el || el.contains(t)); };
      const imp = document.getElementById('tr-imp');
      return { trace: libre(document.querySelector('.tr-tete')), importer: imp.hidden ? 'caché' : libre(imp), suppr: libre(document.getElementById('del')) };
    });
    verifier(bas.trace && bas.importer !== false && bas.suppr, `bas de la fiche libre : Trace du vol ${bas.trace ? 'ok' : 'caché'}, Importer ${bas.importer === 'caché' ? '(pas montré pour ce vol)' : 'ok'}, Supprimer ok`);
    if (bas.importer === true) {
      const [ch] = await Promise.all([p.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null), p.click('#tr-imp')]);
      verifier(!!ch, '« Importer » cliquable');
    }
    await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(150);
    await p.screenshot({ path: join(CAPT, `v072-bas-fiche-${largeur}.png`) });
    await p.click('#cancel'); if (await p.isVisible('#ab-yes')) await p.click('#ab-yes'); await p.waitForSelector('#v-carnet:not([hidden])');
  }

  verifier(await carnetEASA() !== '' && JSON.parse(await carnetEASA()).length === 2, 'totaux et PDF EASA calculés');
  verifier(easa0.length > 0, 'carnet de départ lu');
  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.72 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); srv.fermer();
}

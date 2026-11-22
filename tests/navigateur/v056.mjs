// v0.56 : R144 compteurs gérables (Plus › Compteurs : créer, renommer, supprimer, masquer / réafficher ; compteurs par défaut
// du type et de l'avion ; « Compteurs › » dans la saisie : ce vol / cet avion / le type, ordre ; Feux inchangé ; synchro,
// sauvegarde, CSV) ; R145 ordre de l'écran Plus ; R146 « version gardée » = la plus récente du NAS (tous appareils).
// Avions, vols et mots de passe INVENTÉS ; FAUX NAS v5 local ; toute adresse non locale est BLOQUÉE.
// Captures : tests/navigateur/captures/v056-*.png. Usage : node tests/navigateur/v056.mjs
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { serveur, playwright, verifier, RACINE } from './outils.mjs';

const CAPT = join(RACINE, 'tests/navigateur/captures');
mkdirSync(CAPT, { recursive: true });
const H = '2026-11-01T08:00:00Z';
const avion = (id, immat, champs = {}) => ({ id, immat, typeOACI: 'DH8D', modele: 'Dash 8 Q400 MR', constructeur: 'ESSAI', nom: '', indicatif: '', equipage: 'MP', moteurs: 'ME',
  moteur: 'T', surface: 'L', train: 'tricycle', etiquettes: [], sim: false, photo: null, remarques: '', hexAdsb: '', creeLe: H, modifieLe: H, ...champs });
const CL = { typeOACI: 'CL2T', modele: 'CL-415', moteur: 'T', surface: 'A' };
const AVIONS = [avion('a1', 'F-XZZA'), avion('a2', 'F-XZZB'), avion('a3', 'F-XZZC', { modele: 'Dash 8 Q400 MRE' }),
  avion('c1', 'F-XZZX', CL), avion('c2', 'F-XZZY', CL), avion('d1', 'F-XZZD', { typeOACI: 'DR40', modele: 'DR400', equipage: 'SP', moteurs: 'SE', moteur: 'P' })];
const C0 = { largCdbDash: 0, largInstrCdbDash: 0, largCopiDash: 0, largCopiCL: 0, ecopages: 0, amerrCL: 0, amerrSEP: 0, largPara: 0 };
const vol = (id, date, avionId, minutes, champs = {}) => ({ id, date, hDep: '10:00', hArr: '11:00', mode: 'utc', dep: 'LFTW', arr: 'LFTW', escales: [], avionId, tempsTotal: minutes,
  tempsMP: null, tempsSE: null, tempsME: null, tempsCdB: minutes, tempsCopi: 0, fonction: 'cdb', nomCdB: 'SELF', nomCopi: '', nomInstructeur: '', nomExaminateur: '', missions: [],
  remarques: '', feux: 0, compteurs: { ...C0, ...(champs.compteurs || {}) }, etiquettes: [], attJour: 1, attNuit: 0, approches: 0, tempsIFR: 0, tempsNuit: 0, simTemps: 0, source: 'saisie',
  ordre: Date.parse(`${date}T10:00Z`), creeLe: H, modifieLe: H, ...champs, ...(champs.compteurs ? { compteurs: { ...C0, ...champs.compteurs } } : {}) });
const VOLS = [
  vol('v1', '2026-11-01', 'a1', 60, { feux: 1, missions: ['FEU n°12 ESSAI-A'], compteurs: { largCdbDash: 2 } }),
  vol('v2', '2026-11-02', 'a1', 50, { compteurs: { largInstrCdbDash: 1 } }),
  vol('v3', '2026-11-03', 'a1', 40),
  vol('v4', '2026-11-04', 'a2', 70, { attNuit: 1, attJour: 0, tempsNuit: 30 }),
  vol('v5', '2026-11-05', 'a3', 80),
  vol('v6', '2026-11-06', 'c1', 90, { compteurs: { ecopages: 5, amerrCL: 5, largCopiCL: 2 } }),
  vol('v7', '2026-11-07', 'c2', 45),
  vol('v8', '2026-11-08', 'c2', 45, { compteurs: { ecopages: 3 } }),
  vol('v9', '2026-11-09', 'd1', 30, { compteurs: { amerrSEP: 2 }, attJour: 3 }),
  vol('v10', '2026-11-10', 'a1', 30)];
const ATTENDU = { vols: 10, tempsTotal: 540, atterrissages: 12, feux: 1, largCdbDash: 2, largInstrCdbDash: 1, largCopiDash: 0, largCopiCL: 2, ecopages: 8, amerrCL: 5, amerrSEP: 2, largPara: 0 };

// ---------- Faux NAS v5 : synchro + copies (versions gardées) ----------
const srv = await serveur();
const nas = { mdp: 'mot-de-passe-essai-56', rev: 0, el: new Map(), copies: [] };
const faux = createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), action = u.searchParams.get('action');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Carnet-Cle, X-Carnet-Empreinte', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const morceaux = [];
  req.on('data', m => morceaux.push(m));
  req.on('end', () => {
    const corps = Buffer.concat(morceaux);
    const json = (o, code = 200) => { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(code === 200 ? o : { ...o, code })); };
    if (req.headers['x-carnet-cle'] !== nas.mdp) return json({ erreur: 'mot-de-passe' }, 401);
    if (action === 'test') return json({ ok: true, copies: nas.copies.length, cle: 'carnet', version: 5 });
    if (action === 'envoyer') {
      const d = JSON.parse(gunzipSync(corps).toString());
      nas.copies.push({ id: `c${nas.copies.length + 1}`, date: new Date().toISOString().replace('Z', '+00:00'), vols: d.vols.length, corps, d });
      return json({ ok: true, id: 'x', vols: d.vols.length, taille: corps.length, verification: 'empreinte' });
    }
    if (action === 'liste') return json({ copies: nas.copies.map(c => ({ id: c.id, jour: c.date.slice(0, 10), date: c.date, vols: c.vols, taille: c.corps.length })).reverse() });
    if (action === 'lire') { const c = nas.copies.find(x => x.id === u.searchParams.get('id')); res.writeHead(200, { ...cors, 'Content-Type': 'application/gzip' }); return res.end(c.corps); }
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
      if (corps.length > 4 * 1024 * 1024) return json({ erreur: 'trop-gros' }, 413);
      const b = JSON.parse(corps.toString());
      const acceptees = [], deja = [], conflits = [];
      for (const m of b.modifications) if (m.donnees && JSON.stringify(m.donnees).length > 65536) return json({ erreur: 'trop-gros', id: m.id }, 413);
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
const ADRESSE_NAS = `http://127.0.0.1:${faux.address().port}/carnet-api/`;

const { chromium } = playwright();
const nav = await chromium.launch();
const bloquees = [], erreurs = [];
async function appareil(nom, { remplir = true } = {}) {
  const ctx = await nav.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('**/*', r => { if (new URL(r.request().url()).hostname === '127.0.0.1') return r.continue(); bloquees.push(r.request().url()); return r.abort(); });
  await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|Access-Control|access control/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  if (remplir) {
    await p.evaluate(async ([avs, vs]) => {
      const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
      const t = db.transaction(['avions', 'vols'], 'readwrite');
      for (const a of avs) t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
      await new Promise(ok => { t.oncomplete = ok; }); db.close();
    }, [AVIONS, VOLS]);
    await p.reload(); await p.waitForSelector('body[data-pret="1"]');
  }
  return { p, ctx };
}
const onglet = (p, v) => p.click(`.tabs button[data-v="${v}"]`);
const bulles = (p, id) => p.$$eval(`.flight[data-id="${id}"] .chips .chip`, l => l.map(c => c.textContent));
const volDe = (p, id) => p.evaluate(async id => (await import('./js/etat.js')).etat.vols.find(v => v.id === id), id);
const avionDe = (p, id) => p.evaluate(async id => (await import('./js/etat.js')).etat.avions.get(id), id);
const reglageDe = (p, k) => p.evaluate(async k => (await import('./js/etat.js')).reglage(k), k);
const totaux = p => p.evaluate(async () => { const t = await import('./js/totaux.js'), e = await import('./js/etat.js'); return JSON.stringify(t.calculerTotaux(e.etat.vols, e.etat.avions, '2026-11-21')); });
const resumeTotaux = async p => { const t = JSON.parse(await totaux(p)); return Object.fromEntries(Object.keys(ATTENDU).map(k => [k, t[k]])); };
const fini = (p, sel) => p.waitForFunction(s => { const e = document.querySelector(s); return e && e.textContent.trim() && !/en cours|Envoi :|Réception :|prêt \?/.test(e.textContent); }, sel, { timeout: 60000 });
async function rejoindre(p, role) {
  await onglet(p, 'plus'); await p.click('#pl-sync'); await p.click('#sy-nas'); await p.fill('#nas-adr', ADRESSE_NAS); await p.fill('#nas-mdp', nas.mdp); await p.click('#nas-ok'); await p.waitForTimeout(400); await p.click('#ou-x');
  await p.click('#pl-sync');
  if (role === 'ref') { await p.click('#sy-ref'); await p.click('#sr-ok'); await fini(p, '#sr-res'); } else { await p.click('#sy-mod'); await p.click('#sc-ok'); await fini(p, '#sc-res'); }
  await p.click('#ou-x'); await onglet(p, 'carnet');
}
const actualiser = async p => { await onglet(p, 'carnet'); await p.click('#rafraichir'); await p.waitForFunction(() => !document.getElementById('rafraichir').classList.contains('tourne'), null, { timeout: 30000 }); await p.waitForTimeout(300); };
async function ouvrirVol(p, id, modifier = true) {
  await onglet(p, 'carnet'); await p.locator(`.flight[data-id="${id}"]`).scrollIntoViewIfNeeded();
  await p.click(`.flight[data-id="${id}"]`); await p.waitForSelector('#v-saisie:not([hidden])');
  if (modifier && await p.isVisible('#f-edit')) await p.click('#f-edit');
}
const fermerVol = async p => { for (let i = 0; i < 3 && await p.isVisible('#v-saisie'); i++) { await p.click('#cancel'); await p.waitForTimeout(80); if (await p.isVisible('#ab-yes')) await p.click('#ab-yes'); } await p.waitForSelector('#v-carnet:not([hidden])'); };
const enregistrerVol = async p => { await p.click('#save'); await p.waitForSelector('#v-carnet:not([hidden])'); await p.waitForTimeout(250); };
// compteurs affichés dans la saisie, dans l'ordre (« Feux » compris)
const affiches = p => p.$$eval('#ctrs .step:not([hidden])', l => l.map(s => (s.id === 'feu-row' ? 'Feux' : s.firstElementChild.textContent.trim())));
const listeFenetre = p => p.$$eval('#cptm-list .cbox', l => l.map(b => [b.textContent.trim(), b.getAttribute('aria-checked')]));
async function cocher(p, nom, portee) { // portee : 'vol' | 'avion' | 'type' | 'annuler'
  if (await p.isHidden('#cpt-modal')) await p.click('#ctr-open');
  await p.locator('#cptm-list .cbox', { hasText: new RegExp(`^${nom}$`) }).click();
  if (portee) {
    await p.waitForSelector('#cpc-modal:not([hidden])');
    const i = { vol: 'Juste pour ce vol', avion: 'Pour cet avion', type: 'Pour le type', annuler: 'Annuler' }[portee];
    await p.locator('#cpc-b button', { hasText: i }).click();
  }
  await p.waitForTimeout(250);
}
const fermerFenetre = p => p.click('#cptm-x');

try {
  const A = await appareil('A');
  const t0 = await resumeTotaux(A.p);
  verifier(JSON.stringify(t0) === JSON.stringify(ATTENDU), `totaux de départ identiques à ceux calculés à la main (heures, atterrissages, Feux et les 8 autres compteurs) : ${JSON.stringify(t0)}`);
  const totauxComplets = await totaux(A.p);

  console.log('R145 : ordre de l\'écran Plus');
  await onglet(A.p, 'plus');
  const plus = await A.p.evaluate(() => [...document.querySelectorAll('#v-plus .pgrp')].map(h => [h.textContent, [...h.nextElementSibling.querySelectorAll('.prow2 b')].map(b => b.textContent)]));
  verifier(JSON.stringify(plus) === JSON.stringify([
    ['Mes réglages', ['Mes avions', "Types d'avion", 'Personnes', 'Heures affichées en haut', 'Pastilles des missions', 'Libellés missions', 'Compteurs', 'Traces des vols', 'Socle OPS / IFR']],
    ['Exporter', ['Carnet officiel (PDF EASA)', 'Tableur (CSV)', 'Titulaire du carnet']],
    ['Sauvegarde', ['Sauvegarde de secours', 'Synchro du carnet', 'Restaurer']],
    ['Contrôle', ['Contrôle import']], ['Téléphone', ['Stockage']]]), 'sections et lignes dans l\'ordre R145 : ' + plus.map(([g, l]) => `${g} (${l.join(', ')})`).join(' · '));
  verifier(await A.p.evaluate(() => document.querySelector('#v-plus .plus-menu').firstElementChild.id === 'pl-bk'), 'bandeau du haut inchangé (toujours en premier)');
  await A.p.screenshot({ path: join(CAPT, 'v056-plus.png'), fullPage: true });

  console.log('R144 : point de départ (compteurs par défaut des types)');
  await ouvrirVol(A.p, 'v3');
  verifier(JSON.stringify(await affiches(A.p)) === '["Feux","Largages CdB Dash","Largages instruction CdB Dash"]', `Dash 8 : comme avant : ${(await affiches(A.p)).join(', ')}`);
  verifier(await A.p.isVisible('#ctr-open') && await A.p.textContent('#ctr-open') === 'Compteurs ›' && !(await A.p.$('#ctr-panel')), '« Compteurs › » (plus de « Choisir et ranger les compteurs »)');
  const liens = await A.p.$$eval('.mi-links .linkbtn', l => l.map(b => b.textContent));
  verifier(JSON.stringify(liens) === '["Compteurs ›","Libellés missions ›","Règles des pastilles ›"]', `liens du bloc Mission : ${liens.join(' · ')}`);
  verifier(!(await A.p.$$eval('.c-mi button', l => l.some(b => /\+ Compteurs/.test(b.textContent)))), 'pas de « + Compteurs »');
  await fermerVol(A.p);
  await ouvrirVol(A.p, 'v7');
  verifier(JSON.stringify(await affiches(A.p)) === '["Feux","Largages copi CL","Écopages","Amerrissages CL"]', `CL-415 : ${(await affiches(A.p)).join(', ')}`);
  await fermerVol(A.p);
  await ouvrirVol(A.p, 'v9');
  verifier(JSON.stringify(await affiches(A.p)) === '["Amerrissages SEP"]', `DR400 (SEP) : ${(await affiches(A.p)).join(', ')}`);
  await fermerVol(A.p);

  console.log('R144 : Plus › Compteurs');
  await onglet(A.p, 'plus');
  verifier(/^9 compteurs/.test(await A.p.textContent('#pl-compteurs-s')), `sous-titre : « ${await A.p.textContent('#pl-compteurs-s')} »`);
  await A.p.click('#pl-compteurs');
  const lc = await A.p.$$eval('#cp-l .pitem b', l => l.map(b => b.textContent));
  verifier(lc.length === 9 && lc[0] === 'Feux' && lc.includes('Largages para'), `liste : ${lc.join(', ')}`);
  await A.p.click('#cp-add'); await A.p.fill('#cp-nom', 'Treuillages'); await A.p.click('#cp-ok'); await A.p.waitForTimeout(300);
  verifier((await A.p.$$eval('#cp-l .pitem b', l => l.map(b => b.textContent))).at(-1) === 'Treuillages', '« Treuillages » créé (fin de liste)');
  await A.p.click('#cp-add'); await A.p.fill('#cp-nom', 'écopages'); await A.p.click('#cp-ok');
  verifier(/existe déjà/.test(await A.p.textContent('#cp-err')), 'nom déjà pris : refusé');
  await A.p.fill('#cp-nom', 'Essai jetable'); await A.p.click('#cp-ok'); await A.p.waitForTimeout(300);
  await A.p.locator('#cp-l .pitem', { hasText: 'Essai jetable' }).click();
  verifier(await A.p.isVisible('#cp-del') && !(await A.p.$('#cp-masq')), 'compteur jamais utilisé : « Supprimer » (pas de « Masquer »)');
  await A.p.click('#cp-del'); await A.p.waitForTimeout(300);
  verifier(!(await A.p.$$eval('#cp-l .pitem b', l => l.map(b => b.textContent))).includes('Essai jetable'), 'supprimé');
  await A.p.locator('#cp-l .pitem', { hasText: 'Écopages' }).click();
  verifier(!(await A.p.$('#cp-del')) && await A.p.textContent('#cp-masq') === 'Masquer', 'compteur utilisé : « Masquer », pas de « Supprimer »');
  await A.p.fill('#cp-nom', 'Écopes'); await A.p.click('#cp-ok'); await A.p.waitForTimeout(300);
  await A.p.click('#ou-x'); await onglet(A.p, 'carnet');
  verifier((await bulles(A.p, 'v8')).includes('3 Écopes') && (await volDe(A.p, 'v8')).compteurs.ecopages === 3, `renommé : bulle « 3 Écopes » sur le vol (valeur inchangée) : ${(await bulles(A.p, 'v8')).join(' | ')}`);
  await onglet(A.p, 'plus'); await A.p.click('#pl-compteurs'); await A.p.locator('#cp-l .pitem', { hasText: 'Écopes' }).click(); await A.p.fill('#cp-nom', 'Écopages'); await A.p.click('#cp-ok'); await A.p.waitForTimeout(300);
  // masquer un compteur utilisé : valeurs et totaux gardés
  await A.p.locator('#cp-l .pitem', { hasText: 'Largages CdB Dash' }).click(); await A.p.click('#cp-masq'); await A.p.waitForTimeout(300);
  verifier(/Masqué/.test(await A.p.locator('#cp-l .pitem', { hasText: 'Largages CdB Dash' }).textContent()), 'Largages CdB Dash masqué');
  await A.p.click('#ou-x');
  await ouvrirVol(A.p, 'v3');
  verifier(!(await affiches(A.p)).includes('Largages CdB Dash'), 'masqué : plus proposé sur un vol sans valeur');
  await A.p.click('#ctr-open');
  verifier(!(await listeFenetre(A.p)).some(([n]) => n === 'Largages CdB Dash'), 'masqué : absent de « Compteurs › »');
  await fermerFenetre(A.p); await fermerVol(A.p);
  await ouvrirVol(A.p, 'v1');
  verifier((await affiches(A.p)).includes('Largages CdB Dash'), 'masqué : toujours affiché sur le vol qui a une valeur');
  await fermerVol(A.p);
  verifier((await bulles(A.p, 'v1')).includes('2 lrg') && JSON.stringify(await resumeTotaux(A.p)) === JSON.stringify(ATTENDU), 'masqué : valeur et totaux conservés');
  await onglet(A.p, 'totaux'); await A.p.click('#v-totaux [data-sec="m"] .sec-t');
  const tm = await A.p.$$eval('#t-m .tline', l => l.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  verifier(tm.includes('Largages CdB Dash 2') && tm.includes('Treuillages 0') && tm.includes('Feux 1') && tm.includes('Écopages 8'), `Totaux › compteurs : ${tm.join(' | ')}`);
  await onglet(A.p, 'plus'); await A.p.click('#pl-compteurs'); await A.p.locator('#cp-l .pitem', { hasText: 'Largages CdB Dash' }).click();
  verifier(await A.p.textContent('#cp-masq') === 'Réafficher', '« Réafficher » proposé'); await A.p.click('#cp-masq'); await A.p.waitForTimeout(300);
  await A.p.click('#ou-x');
  verifier(JSON.stringify(await resumeTotaux(A.p)) === JSON.stringify(ATTENDU) && await totaux(A.p) === totauxComplets, 'après création, renommages, suppression, masquage : TOUS les totaux identiques');

  console.log('R144 : Types d\'avion › CL2T et avion F-XZZY');
  await onglet(A.p, 'plus'); await A.p.click('#pl-types'); await A.p.click('#ty-l [data-ty="CL2T"]');
  const casesCL = await A.p.$$eval('#te-cps .cbox', l => l.map(b => [b.textContent.trim(), b.getAttribute('aria-checked')]));
  verifier(casesCL.find(([n]) => n === 'Écopages')[1] === 'true' && casesCL.find(([n]) => n === 'Largages para')[1] === 'false', `type CL2T : « Compteurs par défaut » (Écopages coché) : ${casesCL.filter(([, c]) => c === 'true').map(([n]) => n).join(', ')}`);
  await A.p.locator('#te-cps .cbox', { hasText: 'Treuillages' }).click(); await A.p.locator('#te-cps .cbox', { hasText: 'Treuillages' }).click(); // aller-retour
  await A.p.click('#te-ok'); await A.p.waitForTimeout(300);
  verifier(!/modifié/.test(await A.p.textContent('#ty-l [data-ty="CL2T"]')), 'type pas marqué « modifié » (seuls les compteurs)');
  await A.p.click('#ou-x');
  await A.p.click('#pl-avions'); await A.p.waitForSelector('#fl-list .acitem'); await A.p.click('[data-ed="c2"]'); await A.p.waitForSelector('#fiche:not([hidden])');
  verifier(await A.p.textContent('#fi-cp-l') === 'Comme le type CL2T' && await A.p.getAttribute('#fi-cp-sw', 'aria-checked') === 'true', 'fiche F-XZZY : « Comme le type CL2T » (oui par défaut)');
  await A.p.click('#fi-cp-sw');
  await A.p.locator('#fi-cps .cbox', { hasText: 'Écopages' }).click();
  await A.p.locator('#fiche').screenshot({ path: join(CAPT, 'v056-fiche-avion.png') });
  await A.p.click('#fi-save'); await A.p.waitForTimeout(400); await A.p.click('#fl-x');
  verifier(JSON.stringify((await avionDe(A.p, 'c2')).compteursPropres) === '["feux","amerrCL","largCopiCL"]', 'F-XZZY : compteurs propres sans Écopages');
  await ouvrirVol(A.p, 'v7');
  verifier(!(await affiches(A.p)).includes('Écopages'), `vol sur F-XZZY : pas d'Écopages (${(await affiches(A.p)).join(', ')})`);
  await fermerVol(A.p);
  await ouvrirVol(A.p, 'v8');
  verifier((await affiches(A.p)).includes('Écopages'), 'vol F-XZZY avec 3 écopages : affiché quand même');
  await fermerVol(A.p);
  await ouvrirVol(A.p, 'v6');
  verifier((await affiches(A.p)).includes('Écopages'), 'autre CL-415 (F-XZZX) : Écopages affiché');
  await fermerVol(A.p);

  console.log('R144 : saisie › « Compteurs › »');
  await ouvrirVol(A.p, 'v2');
  await cocher(A.p, 'Largages para', 'vol');
  verifier((await affiches(A.p)).includes('Largages para'), '« Juste pour ce vol » : affiché');
  await A.p.screenshot({ path: join(CAPT, 'v056-fenetre-compteurs.png') });
  await fermerFenetre(A.p); await enregistrerVol(A.p);
  verifier(JSON.stringify((await volDe(A.p, 'v2')).compteursAjoutes) === '["largPara"]', 'gardé avec le vol');
  await ouvrirVol(A.p, 'v3');
  verifier(!(await affiches(A.p)).includes('Largages para'), 'autre vol du même avion : pas affiché');
  await cocher(A.p, 'Largages para', 'avion');
  verifier((await affiches(A.p)).includes('Largages para'), '« Pour cet avion » : affiché sur ce vol');
  await fermerFenetre(A.p);
  await A.p.click('[aria-label="Largages para plus"]'); await enregistrerVol(A.p);
  verifier((await volDe(A.p, 'v3')).compteurs.largPara === 1, 'valeur 1 saisie sur v3');
  await ouvrirVol(A.p, 'v10');
  verifier((await affiches(A.p)).includes('Largages para'), '« Pour cet avion » : affiché sur le vol suivant du même avion (F-XZZA)');
  await fermerVol(A.p);
  await ouvrirVol(A.p, 'v4');
  verifier(!(await affiches(A.p)).includes('Largages para'), 'autre Dash (F-XZZB) : pas affiché');
  await fermerVol(A.p);
  await ouvrirVol(A.p, 'v10');
  await cocher(A.p, 'Largages copi Dash', 'type');
  await fermerFenetre(A.p); await fermerVol(A.p);
  for (const id of ['v4', 'v5', 'v1']) {
    await ouvrirVol(A.p, id);
    verifier((await affiches(A.p)).includes('Largages copi Dash'), `« Pour le type » : affiché sur ${id} (${(await avionDe(A.p, (await volDe(A.p, id)).avionId)).immat})`);
    await fermerVol(A.p);
  }
  // décocher pour l'avion : disparaît des vols suivants, reste là où il a une valeur
  await ouvrirVol(A.p, 'v10');
  await cocher(A.p, 'Largages para', 'avion');
  verifier(!(await affiches(A.p)).includes('Largages para'), 'décoché « Pour cet avion » : retiré de ce vol');
  await fermerFenetre(A.p); await fermerVol(A.p);
  await ouvrirVol(A.p, 'v1');
  verifier(!(await affiches(A.p)).includes('Largages para'), 'vol suivant du même avion : plus affiché'); await fermerVol(A.p);
  await ouvrirVol(A.p, 'v3');
  verifier((await affiches(A.p)).includes('Largages para') && (await volDe(A.p, 'v3')).compteurs.largPara === 1, 'vol avec une valeur : toujours affiché, valeur inchangée'); await fermerVol(A.p);
  await ouvrirVol(A.p, 'v2');
  verifier((await affiches(A.p)).includes('Largages para'), '« Juste pour ce vol » : toujours là sur v2'); await fermerVol(A.p);
  // décocher pour le type
  await ouvrirVol(A.p, 'v4');
  await cocher(A.p, 'Largages copi Dash', 'type');
  await fermerFenetre(A.p); await fermerVol(A.p);
  await ouvrirVol(A.p, 'v5');
  verifier(!(await affiches(A.p)).includes('Largages copi Dash'), 'décoché « Pour le type » : plus affiché sur les autres Dash'); await fermerVol(A.p);
  // Annuler : rien ne change
  await ouvrirVol(A.p, 'v5');
  const avantAnnuler = await affiches(A.p);
  await cocher(A.p, 'Treuillages', 'annuler');
  verifier(JSON.stringify(await affiches(A.p)) === JSON.stringify(avantAnnuler) && await A.p.getAttribute('#cptm-list .cbox:text-is("Treuillages")', 'aria-checked') === 'false', '« Annuler » : rien ne change');
  // flèche retour Android : ferme la question, puis la fenêtre, sans rien changer
  await A.p.locator('#cptm-list .cbox', { hasText: /^Treuillages$/ }).click(); await A.p.waitForSelector('#cpc-modal:not([hidden])');
  await A.p.goBack(); await A.p.waitForSelector('#cpc-modal', { state: 'hidden' });
  verifier(await A.p.isVisible('#cpt-modal') && JSON.stringify(await affiches(A.p)) === JSON.stringify(avantAnnuler), 'retour Android : ferme la question (comme « Annuler »)');
  await A.p.goBack(); await A.p.waitForSelector('#cpt-modal', { state: 'hidden' });
  verifier(await A.p.isVisible('#v-saisie'), 'retour Android : ferme « Compteurs » (le vol reste ouvert)');

  console.log('R144 : ordre avec les flèches');
  await cocher(A.p, 'Treuillages', 'type'); // Treuillages pour tous les Dash
  const iT = (await listeFenetre(A.p)).findIndex(([n]) => n === 'Treuillages');
  await A.p.click(`#cptm-list [aria-label="Monter Treuillages"]`); await A.p.waitForTimeout(150);
  for (let i = 0; i < 20 && (await listeFenetre(A.p))[0][0] !== 'Treuillages'; i++) { await A.p.click(`#cptm-list [aria-label="Monter Treuillages"]`); await A.p.waitForTimeout(120); }
  const ordre = (await listeFenetre(A.p)).map(([n]) => n);
  verifier(iT > 0 && ordre[0] === 'Treuillages', `Treuillages monté en tête : ${ordre.join(', ')}`);
  await fermerFenetre(A.p); await A.p.click('[aria-label="Treuillages plus"]'); await A.p.click('[aria-label="Treuillages plus"]'); await enregistrerVol(A.p);
  await ouvrirVol(A.p, 'v4');
  verifier((await affiches(A.p))[0] === 'Treuillages', `autre vol : même ordre (${(await affiches(A.p)).join(', ')})`);
  await A.p.click('#ctr-open'); verifier(JSON.stringify((await listeFenetre(A.p)).map(([n]) => n)) === JSON.stringify(ordre), 'autre vol : même ordre dans « Compteurs › »');
  await fermerFenetre(A.p); await fermerVol(A.p);
  await A.p.reload(); await A.p.waitForSelector('body[data-pret="1"]');
  await ouvrirVol(A.p, 'v4');
  verifier((await affiches(A.p))[0] === 'Treuillages', 'après relance : même ordre'); await fermerVol(A.p);
  verifier((await bulles(A.p, 'v5')).includes('2 Treuillages'), `bulle « 2 Treuillages » sur v5 : ${(await bulles(A.p, 'v5')).join(' | ')}`);

  console.log('R144 : Feux inchangé');
  await ouvrirVol(A.p, 'v10');
  await A.p.click('#feu-p'); await A.p.waitForTimeout(150);
  const lignesFeu = await A.p.$$eval('#ml input', l => l.map(i => i.value));
  verifier(lignesFeu.some(t => /^FEU n°13/.test(t)), `+1 : « ${lignesFeu.join(' + ')} » (numéro suivant)`);
  await enregistrerVol(A.p);
  verifier((await volDe(A.p, 'v10')).feux === 1, 'feu compté');

  console.log('Synchro A -> B (faux NAS)');
  await rejoindre(A.p, 'ref');
  const B = await appareil('B', { remplir: false });
  await rejoindre(B.p, 'mod');
  const fichesB = await reglageDe(B.p, 'compteursFiches'), typesB = await reglageDe(B.p, 'compteursTypes'), ordreB = await reglageDe(B.p, 'compteurs');
  const cleT = Object.keys(fichesB).find(k => fichesB[k].nom === 'Treuillages');
  verifier(cleT && JSON.stringify(typesB) === JSON.stringify(await reglageDe(A.p, 'compteursTypes')) && ordreB[0].cle === cleT
    && JSON.stringify((await avionDe(B.p, 'c2')).compteursPropres) === '["feux","amerrCL","largCopiCL"]' && (await volDe(B.p, 'v5')).compteurs[cleT] === 2
    && JSON.stringify((await volDe(B.p, 'v2')).compteursAjoutes) === '["largPara"]',
  'appareil B : compteur créé, choix par type et par avion, ordre, valeurs et « juste pour ce vol » reçus');
  await ouvrirVol(B.p, 'v4', false);
  verifier((await affiches(B.p))[0] === 'Treuillages', 'appareil B : même affichage'); await fermerVol(B.p);
  // une modification sur B revient sur A
  await onglet(B.p, 'plus'); await B.p.click('#pl-compteurs'); await B.p.locator('#cp-l .pitem', { hasText: 'Treuillages' }).click(); await B.p.click('#cp-tot'); await B.p.click('#cp-ok'); await B.p.waitForTimeout(300); await B.p.click('#ou-x');
  await actualiser(B.p); await actualiser(A.p);
  verifier((await reglageDe(A.p, 'compteursFiches'))[cleT].totaux === false, 'B -> A : « Compté dans les Totaux » non : reçu sur A (le plus récent gagne)');

  console.log('Sauvegarde, restauration (C), CSV');
  await onglet(A.p, 'plus'); await A.p.click('#pl-save');
  const [dl] = await Promise.all([A.p.waitForEvent('download'), A.p.click('#sv-dl')]);
  const fichierSv = join(CAPT, 'v056-sauvegarde.json'); writeFileSync(fichierSv, readFileSync(await dl.path())); await A.p.click('#ou-x');
  await A.p.click('#pl-csv');
  const [dlc] = await Promise.all([A.p.waitForEvent('download'), A.p.click('#cs-dl')]);
  const csv = readFileSync(await dlc.path(), 'utf8').replace(/^﻿/, ''); await A.p.click('#ou-x');
  const [ent, ...lignes] = csv.trim().split(/\r?\n/), cols = ent.split(';');
  const iTr = cols.indexOf('Treuillages'), iId = cols.indexOf('Identifiant');
  verifier(iTr > 0 && lignes.find(l => l.split(';')[iId] === 'v5').split(';')[iTr] === '2', 'CSV : colonne « Treuillages » (2 sur v5)');
  verifier(['Largages CdB Dash', 'Largages instruction CdB Dash', 'Largages copi Dash', 'Largages copi CL', 'Écopages', 'Amerrissages CL', 'Amerrissages SEP', 'Largages para', 'Feux (nouveaux)'].every(n => cols.includes(n)), 'CSV : les 9 compteurs d\'origine toujours là');
  const C = await appareil('C', { remplir: false });
  await onglet(C.p, 'plus'); await C.p.click('#pl-restore');
  const [ch] = await Promise.all([C.p.waitForEvent('filechooser'), C.p.click('#rs-fichier')]);
  await ch.setFiles(fichierSv); await C.p.waitForSelector('#rs-ok'); await C.p.click('#rs-ok'); await C.p.waitForTimeout(800);
  verifier(JSON.stringify(await reglageDe(C.p, 'compteursFiches')) === JSON.stringify(await reglageDe(A.p, 'compteursFiches'))
    && JSON.stringify(await reglageDe(C.p, 'compteursTypes')) === JSON.stringify(await reglageDe(A.p, 'compteursTypes'))
    && JSON.stringify(await reglageDe(C.p, 'compteurs')) === JSON.stringify(await reglageDe(A.p, 'compteurs'))
    && JSON.stringify((await avionDe(C.p, 'c2')).compteursPropres) === '["feux","amerrCL","largCopiCL"]' && await totaux(C.p) === await totaux(A.p),
  'appareil C restauré : compteurs, choix par type et par avion, ordre, valeurs et totaux identiques');

  console.log('R146 : « version gardée » = la plus récente du NAS');
  for (let i = 0; i < 60 && !nas.copies.length; i++) await A.p.waitForTimeout(500);
  verifier(nas.copies.length > 0, `A (téléphone) a gardé une version aujourd'hui sur le faux NAS (${nas.copies.length})`);
  await B.p.evaluate(async () => { const e = await import('./js/etat.js'); await e.ecrireReglageDiscret('nasEtat', { derniereCopie: new Date(Date.now() - 10 * 864e5).toISOString(), statut: 'ok', enAttente: false }); });
  await onglet(B.p, 'carnet'); await onglet(B.p, 'plus');
  await B.p.waitForFunction(() => /version gardée (à l'instant|il y a \d+ min)/.test(document.getElementById('pl-sync-s').textContent), null, { timeout: 15000 }).catch(() => {});
  const ligneB = await B.p.textContent('#pl-sync-s');
  verifier(/^Synchronisé · version gardée (à l'instant|il y a \d+ min)$/.test(ligneB), `B (sa dernière copie il y a 10 jours) affiche la version d'aujourd'hui : « ${ligneB} »`);
  verifier(await B.p.evaluate(() => document.getElementById('pl-bk').classList.contains('ok')) && /^Copié sur le NAS (à l'instant|il y a \d+ min)/.test(await B.p.textContent('#pl-bk-t')), `bandeau de B : « ${await B.p.textContent('#pl-bk-t')} »`);
  await B.p.screenshot({ path: join(CAPT, 'v056-plus-B.png') });

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur (ni vrai NAS, ni VPS, ni Google)' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.56 réussie.');
} catch (err) {
  console.error(err.message); if (erreurs.length) console.error('Erreurs JS :', erreurs.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await nav.close(); faux.closeAllConnections?.(); faux.close(); srv.fermer();
}

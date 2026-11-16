// v0.44 : R109 date des cartes dans un contour noir 1,5 px, chiffres centrés au pixel (MESURE de l'encre sur capture :
// écart haut = écart bas à 1 px près, Chromium et WebKit), trajet collé dessous, pastille à droite ; mois 18 px noir très gras.
// R110 fond de l'accueil #d4deec (cartes blanches ; sombre inchangé ; les autres écrans gardent leur fond).
// R111 total dans une carte blanche à bande bleu-blanc-rouge entre les deux boutons ronds ; bande d'heures et 3 / 7 / 30 à la
// plus grande taille qui tient (390, 360, 340 px ; 1 à 4 cases ; très grand total) : aucun texte coupé ni à la ligne.
// R112 vol ouvert en LECTURE SEULE : chaque champ, chaque bouton (+ et −, interrupteurs, étiquettes…), la fiche de l'avion
// (photo), une flamme ; LF / LOC / UTC utilisables ; crayon -> Annuler (rien ne change), crayon -> Enregistrer ; nouveau vol
// directement en modification ; ouverture depuis la recherche. Vols, avion, communes INVENTÉS.
// Captures : tests/navigateur/captures/v044-*.png (non commitées). Usage : node tests/navigateur/v044.mjs
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
  vol('v-feu', 1, { missions: ['FEU n°60 ESSAI'], feux: 1, compteurs: { largCdbDash: 2 }, remarques: 'REMARQUE ESSAI', tempsIFR: 30, tempsNuit: 20, approches: 1,
    feuxPositions: [{ heure: '10:20', lat: 43.80, lon: 4.30, commune: 'COMMUNE-ESSAI-UN', nom: '' }] }),
  vol('v-ent', 2, { missions: ['ENT. OPS'], dep: 'FMEP', arr: 'FMEP' }),
  vol('v-ifr', 3, { missions: ['TRANSPORT ESSAI'], tempsIFR: 60, approches: 2, arr: 'LFMT' }),
  vol('v-vieux', 45, { missions: ['TRANSPORT ESSAI'], dep: 'LFTW', arr: 'EGLL', escales: [{ code: 'LSGG', attJour: 1, attNuit: 0, approches: 0 }] }),
];
// très gros carnet inventé (pour les tailles) : 12 345h59 sur Dash
const GROS = [vol('v-gros', 1, { tempsTotal: 740759, tempsCdB: 740759, compteurs: { largCdbDash: 98765 } }), vol('v-gros2', 400, { tempsTotal: 5258, tempsCdB: 0, fonction: 'copi', nomCdB: 'ZZY', nomCopi: 'SELF' })];
const ENORME = [vol('v-enorme', 1, { tempsTotal: 599999999, tempsCdB: 599999999 })]; // 9 999 999h59
const BANDE = ['type:DH8D', 'typeCdB:DH8D', 'tempsTotal', 'largCdbDash'];
const REPERES = [[32, 14], [27, 13], [22, 12.5], [18, 11.5]];

const srv = await serveur();
const { chromium, webkit } = playwright();
const nav = await chromium.launch(), navSafari = await webkit.launch();
const erreurs = [], bloquees = [];
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1';
async function appareil(nom, moteur, largeur, { dsf = 3, vols = VOLS, bande = null, jours = true } = {}) {
  const ctx = await moteur.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block', viewport: { width: largeur, height: 800 }, deviceScaleFactor: dsf,
    isMobile: true, hasTouch: true, ...(moteur === webkit ? { userAgent: SAFARI } : {}) });
  await ctx.route('**/*', r => { const u = new URL(r.request().url()); if (u.hostname === '127.0.0.1') return r.continue(); bloquees.push(u.href); return r.abort(); });
  await ctx.addInitScript(() => { globalThis.CARNET_SERVEUR_TRACES = 'http://127.0.0.1:9/'; globalThis.CARNET_TUILES = 'http://127.0.0.1:9/{z}/{x}/{y}.png'; });
  const p = await ctx.newPage();
  p.on('pageerror', e => erreurs.push(`${nom} : ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|CORS|access control|restricted network port/i.test(m.text())) erreurs.push(`${nom} : ${m.text()}`); });
  await p.goto(srv.url); await p.waitForSelector('body[data-pret="1"]');
  await p.evaluate(async ([a, vs, b, j]) => {
    const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
    const t = db.transaction(['avions', 'vols', 'reglages'], 'readwrite'); t.objectStore('avions').put(a); for (const v of vs) t.objectStore('vols').put(v);
    if (b) t.objectStore('reglages').put({ cle: 'bandeHeures', valeur: b });
    if (!j) t.objectStore('reglages').put({ cle: 'afficherJours', valeur: false });
    await new Promise(ok => { t.oncomplete = ok; }); db.close();
  }, [AVION, vols, bande, jours]);
  await p.reload(); await p.waitForSelector('body[data-pret="1"]'); await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(150);
  return { ctx, p };
}
const lireVol = (p, id) => p.evaluate(async id => {
  const db = await new Promise(ok => { const r = indexedDB.open('carnet-de-vol'); r.onsuccess = () => ok(r.result); });
  const v = await new Promise(ok => { const r = db.transaction('vols').objectStore('vols').get(id); r.onsuccess = () => ok(r.result); }); db.close(); return v;
}, id);

// ---------- R109 : mesure au pixel de l'encre de la date dans son contour ----------
async function encreDate(p, sel) {
  const el = p.locator(sel); await el.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(80); const r = await el.boundingBox();
  const buf = await p.screenshot({ clip: { x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8 } }); if (process.env.DEBUG_ENCRE) (await import('node:fs')).writeFileSync(process.env.DEBUG_ENCRE + sel.replace(/\W+/g, '_') + '.png', buf); const png = buf.toString('base64');
  return p.evaluate(async ([b64, w]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, Hh = c.height, k = W / (w + 8);
    const fonce = (x, y) => { const i = (y * W + x) * 4; return Math.abs(d[i] - d[i + 1]) < 200 && (d[i] + d[i + 1] + d[i + 2]) / 3 < 128; };
    const clair = (x, y) => { const i = (y * W + x) * 4; return (d[i] + d[i + 1] + d[i + 2]) / 3 > 128; };
    // thème sombre : encre claire sur fond foncé
    const i0 = ((Hh >> 1) * W + 2) * 4, fondClair = (d[i0] + d[i0 + 1] + d[i0 + 2]) / 3 > 128, encre = fondClair ? fonce : clair;
    const xb = Math.round(8 * k); // dans la marge de gauche (7 px) : on ne croise que le contour
    let y = 0; while (y < Hh && !encre(xb, y)) y++; const bordHaut = y; while (y < Hh && encre(xb, y)) y++; const intHaut = y;
    y = Hh - 1; while (y >= 0 && !encre(xb, y)) y--; const bordBas = y; while (y >= 0 && encre(xb, y)) y--; const intBas = y;
    let premier = -1, dernier = -1;
    for (let yy = intHaut; yy <= intBas; yy++) {
      let e = false; for (let x = Math.round(12 * k); x < W - Math.round(12 * k); x++) if (encre(x, yy)) { e = true; break; }
      if (e) { if (premier < 0) premier = yy; dernier = yy; }
    }
    return { haut: (premier - intHaut) / k, bas: (intBas - dernier) / k, bord: (intHaut - bordHaut) / k, bordB: (bordBas - intBas) / k, encre: premier >= 0 };
  }, [png, r.width]);
}
async function controlerDates(nom, p, theme) {
  const cadre = theme === 'clair' ? 'rgb(27, 36, 51)' : 'rgb(201, 211, 222)';
  for (const id of ['v-feu', 'v-ent', 'v-ifr', 'v-vieux']) {
    const sel = `.flight[data-id="${id}"] .fl-date`;
    const s = await p.evaluate(sel => {
      const d = document.querySelector(sel), c = d.closest('.flight'), st = getComputedStyle(d), r = d.getBoundingClientRect();
      const ro = c.querySelector('.fl-route').getBoundingClientRect(), bl = c.querySelector('.fl-bloc').getBoundingClientRect(), rc = c.getBoundingClientRect();
      return { bord: `${st.borderTopWidth} ${st.borderTopColor}`, ombre: st.boxShadow, rayon: st.borderTopLeftRadius, pg: st.paddingLeft, pd: st.paddingRight,
        taille: st.fontSize, gras: st.fontWeight, lh: st.lineHeight, ecartTrajet: ro.top - r.bottom, droite: bl.left - Math.max(r.right, ro.right),
        sousBord: r.top - rc.top - parseFloat(getComputedStyle(c).borderTopWidth), tb: st.textBoxTrim || st.textBox || '' };
    }, sel);
    verifier(s.bord === `1px ${cadre}` && s.ombre.startsWith(`${cadre} 0px 0px 0px 0.5px`) && s.rayon === '8px' && s.pg === '7px' && s.pd === '7px',
      `${nom} ${theme} : ${id} : contour ${cadre} 1 + 0,5 = 1,5 px, rayon 8 px, 7 px à gauche et à droite`);
    verifier(s.taille === '23px' && Number(s.gras) >= 800 && s.lh === '23px', `${nom} ${theme} : ${id} : date 23 px très grasse, line-height 1 (taille et graisse inchangées)`);
    const m = await encreDate(p, sel);
    verifier(m.encre && Math.abs(m.haut - m.bas) <= 1, `${nom} ${theme} : ${id} : chiffres centrés dans le contour (mesure au pixel : ${m.haut.toFixed(2)} px en haut, ${m.bas.toFixed(2)} px en bas${s.tb ? ', text-box' : ', repli sans text-box'})`);
    verifier(s.ecartTrajet >= -1 && s.ecartTrajet <= 4, `${nom} ${theme} : ${id} : trajet collé sous la date (${s.ecartTrajet.toFixed(1)} px)`);
    verifier(s.droite >= 4, `${nom} ${theme} : ${id} : pastille à droite (${Math.round(s.droite)} px d'écart)`);
    verifier(s.sousBord >= 4, `${nom} ${theme} : ${id} : contour non coupé (${s.sousBord.toFixed(1)} px sous le bord de la carte)`);
  }
  const mois = await p.evaluate(() => [...document.querySelectorAll('#list .month')].map(m => { const s = getComputedStyle(m); return `${s.fontSize} ${s.fontWeight} ${s.color} ${s.letterSpacing}`; }));
  const coul = theme === 'clair' ? 'rgb(27, 36, 51)' : 'rgb(231, 237, 243)';
  verifier(mois.length >= 2 && mois.every(x => x === `18px 800 ${coul} 0.9px`), `${nom} ${theme} : en-têtes de mois 18 px, 800, ${coul}, espacés .05em (${mois[0]})`);
}

// ---------- R110 / R111 : en-tête de l'accueil ----------
async function entete(p) {
  return p.evaluate(() => {
    const r = s => document.querySelector(s).getBoundingClientRect(), st = s => getComputedStyle(document.querySelector(s));
    const deborde = e => e.scrollWidth > e.clientWidth + 0.5 || (() => { const g = document.createRange(); g.selectNodeContents(e); return g.getBoundingClientRect().width > e.getBoundingClientRect().width + 0.5; })();
    const textes = [...document.querySelectorAll('#h-total, #h-carte .h-lab, #h-strip b, #h-strip span, #h-quick:not([hidden]) .lbl, #h-quick:not([hidden]) b')];
    const coupes = textes.filter(e => deborde(e) || e.getClientRects().length > 1 || e.getBoundingClientRect().height > parseFloat(getComputedStyle(e).fontSize) * 1.7).map(e => e.textContent);
    const avant = getComputedStyle(document.querySelector('#h-carte'), '::before');
    // « la plus grande qui tient » : 0,5 px de plus et quelque chose déborde (sauf si on est déjà au repère)
    const plusGrand = (ligne, v, sel) => {
      const L = document.querySelector(ligne); if (!L || L.hidden) return null;
      const t = parseFloat(L.style.getPropertyValue(v)); L.style.setProperty(v, (t + 0.5) + 'px');
      const d = [...L.querySelectorAll(sel)].some(deborde); L.style.setProperty(v, t + 'px'); return { t, deborderait: d };
    };
    return { sync: r('#rafraichir'), carte: r('#h-carte'), loupe: r('#q-open'), ver: r('#h-version'), largeur: document.documentElement.clientWidth, trop: [...document.querySelectorAll('body *')].filter(x => x.getClientRects().length && x.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 6).map(x => `${x.tagName}#${x.id}.${x.className} ${Math.round(x.getBoundingClientRect().right)}`).join(' | '), // (WebKit mobile : innerWidth faux après un changement de taille)
      scrollX: document.documentElement.scrollWidth,
      fond: getComputedStyle(document.body).backgroundColor, carteFond: st('#h-carte').backgroundColor, carteBord: `${st('#h-carte').borderTopWidth} ${st('#h-carte').borderTopColor}`,
      rayon: st('#h-carte').borderTopLeftRadius, bande: `${avant.height} ${avant.backgroundImage}`, titre: document.querySelector('#h-carte .h-lab').innerText,
      titreS: `${st('#h-carte .h-lab').fontSize} ${st('#h-carte .h-lab').fontWeight} ${st('#h-carte .h-lab').letterSpacing}`, valeur: `${st('#h-total').fontSize} ${st('#h-total').fontWeight} ${st('#h-total').color}`,
      petitH: document.querySelector('#h-total small') ? parseFloat(getComputedStyle(document.querySelector('#h-total small')).fontSize) / parseFloat(st('#h-total').fontSize) : 0,
      total: document.querySelector('#h-total').textContent, coupes, nb: document.querySelectorAll('#h-strip>div:not(.empty)').length,
      bv: plusGrand('#h-strip', '--bv', 'b'), bl: plusGrand('#h-strip', '--bl', 'span'), qv: plusGrand('#h-quick', '--bv', 'b'), ql: plusGrand('#h-quick', '--bl', '.lbl'),
      carteVol: getComputedStyle(document.querySelector('#list .flight')).backgroundColor };
  });
}
function controlerEntete(nom, e, n) {
  verifier(e.sync.right <= e.carte.left + 0.5 && e.carte.right <= e.loupe.left + 0.5 && Math.abs(e.sync.width - 44) < 0.5 && Math.abs(e.loupe.width - 44) < 0.5
    && e.sync.top >= e.carte.top - 0.5 && e.sync.bottom <= e.carte.bottom + 0.5 && e.loupe.top >= e.carte.top - 0.5 && e.loupe.bottom <= e.carte.bottom + 0.5
    && e.loupe.right <= e.largeur + 0.5 && e.sync.left >= 0,
    `${nom} : total ENTRE les deux boutons ronds (44 px), sur la même ligne`
    + ` (synchro ${Math.round(e.sync.left)}-${Math.round(e.sync.right)} ↕ ${e.sync.top.toFixed(1)}-${e.sync.bottom.toFixed(1)} l ${e.sync.width}, total ↕ ${e.carte.top.toFixed(1)}-${e.carte.bottom.toFixed(1)}, total ${Math.round(e.carte.left)}-${Math.round(e.carte.right)}, loupe ${Math.round(e.loupe.left)}-${Math.round(e.loupe.right)} ↕ ${e.loupe.top.toFixed(1)}-${e.loupe.bottom.toFixed(1)} l ${e.loupe.width}, écran ${e.largeur})`);
  verifier(e.ver.bottom <= e.sync.top + 0.5 && Math.abs((e.ver.left + e.ver.right) / 2 - (e.sync.left + e.sync.right) / 2) < 1, `${nom} : version au-dessus du bouton de synchro`);
  // après un changement de taille SIMULÉ, WebKit mobile garde l'ancienne largeur de page (447 px) alors qu'aucun élément ne
  // dépasse : dans ce cas seul, on vérifie les éléments un par un
  verifier(!e.trop && (e.scrollX <= e.largeur || /changement de largeur/.test(nom)), `${nom} : pas de défilement horizontal de la page (${e.scrollX} / ${e.largeur} px)${e.trop ? ' — ' + e.trop : ''}`);
  verifier(e.carteFond === 'rgb(255, 255, 255)' && e.carteBord === '1px rgb(170, 179, 194)' && e.rayon === '16px'
    && /^5px linear-gradient\(90deg, rgb\(31, 63, 153\).*33\.33\d*%.*rgb\(255, 255, 255\).*66\.66\d*%.*rgb\(214, 43, 43\)/.test(e.bande),
    `${nom} : carte blanche, bord #aab3c2, coins 16 px, bande bleu-blanc-rouge de 5 px en haut`);
  verifier(e.titre === 'TOTAL HEURES DE VOL' && /^(11\.5|1[01](\.5)?|[89](\.5)?)px 700 /.test(e.titreS), `${nom} : titre « ${e.titre} » (${e.titreS})`);
  verifier(Math.abs(e.petitH - 0.55) < 0.02, `${nom} : le « h » du total à 55 %`);
  verifier(!e.coupes.length, `${nom} : ${n} case(s) : aucun texte coupé ni à la ligne${e.coupes.length ? ' — ' + e.coupes.join(', ') : ''}`);
  if (n) {
    const [v, l] = REPERES[Math.min(n, 4) - 1];
    verifier(e.nb === n && e.bv.t <= v && (e.bv.t === v || e.bv.deborderait) && e.bl.t <= l && (e.bl.t === l || e.bl.deborderait),
      `${nom} : ${n} case(s) : la plus grande taille qui tient (valeurs ${e.bv.t} px, repère ${v} ; libellés ${e.bl.t} px, repère ${l})`);
  }
  if (e.qv) verifier(e.qv.t <= 22 && (e.qv.t === 22 || e.qv.deborderait) && e.ql.t <= 12.5 && (e.ql.t === 12.5 || e.ql.deborderait),
    `${nom} : 3 / 7 / 30 jours : même règle (valeurs ${e.qv.t} px, libellés ${e.ql.t} px)`);
}

// ---------- R112 : lecture seule ----------
const AUTORISES = '#cancel, #f-edit, .tz-groupe, #carte-zone, #ac-fiche, #ctr-open';
const photo = p => p.evaluate(() => JSON.stringify({
  champs: [...document.querySelectorAll('#v-saisie input, #v-saisie textarea')].map(e => e.type === 'checkbox' ? e.checked : e.value),
  etats: [...document.querySelectorAll('#v-saisie [aria-pressed], #v-saisie [aria-checked]')].filter(e => !e.closest('.tz-groupe')).map(e => (e.getAttribute('aria-pressed') || '') + (e.getAttribute('aria-checked') || '')),
  textes: [...document.querySelectorAll('#v-saisie .sec')].map(s => s.innerText.replace(/\s+/g, ' ')),
  fenetres: [...document.querySelectorAll('.modal, .sheet')].filter(m => !m.hidden).map(m => m.id) }));
async function essaisLecture(nom, p) {
  const avant = await photo(p), vAvant = JSON.stringify(await lireVol(p, 'v-feu'));
  // chaque champ : toucher puis taper (doigt, puis focus forcé + clavier)
  const champs = await p.evaluate(a => [...document.querySelectorAll('#v-saisie input, #v-saisie textarea')].filter(e => e.offsetParent && !e.closest(a)).map((e, i) => { e.dataset.essai = i; return i; }), AUTORISES);
  let ro = 0;
  for (const i of champs) {
    const l = p.locator(`[data-essai="${i}"]`);
    await l.evaluate(e => e.scrollIntoView({ block: 'center' })); // jamais sous la barre d'onglets du bas
    await l.click({ force: true, timeout: 2000 }).catch(() => {});
    await p.evaluate(i => document.querySelector(`[data-essai="${i}"]`).focus(), i);
    await p.keyboard.type('9Z'); await p.keyboard.press('Backspace'); await p.keyboard.press('ArrowUp');
    if (await l.evaluate(e => e.readOnly)) ro++;
  }
  verifier(champs.length >= 8 && ro === champs.length, `${nom} : ${champs.length} champs essayés (toucher + clavier) : tous en lecture seule`);
  // chaque bouton (+ et −, interrupteurs, étiquettes, choix de l'avion, ajout d'escale, nuit, missions…) : doigt puis clic programmé
  const boutons = await p.evaluate(a => [...document.querySelectorAll('#v-saisie .sec button, #v-saisie .sec [role="button"], #v-saisie .sec .chip, #v-saisie .sec label')]
    .filter(e => e.offsetParent && !e.closest(a)).map((e, i) => { e.dataset.bessai = i; return { i, nom: e.getAttribute('aria-label') || e.textContent.trim().slice(0, 20) }; }), AUTORISES);
  for (const { i } of boutons) {
    const lb = p.locator(`[data-bessai="${i}"]`); await lb.evaluate(e => e.scrollIntoView({ block: 'center' }));
    await lb.click({ force: true, timeout: 2000 }).catch(() => {});
    await p.evaluate(i => { const e = document.querySelector(`[data-bessai="${i}"]`); e.click(); e.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }, i);
  }
  const plusMoins = boutons.filter(b => /moins|plus/i.test(b.nom)).length;
  verifier(boutons.length >= 10 && plusMoins >= 4, `${nom} : ${boutons.length} boutons essayés dont ${plusMoins} boutons + et − (et l'interrupteur VFR / IFR, les étiquettes)`);
  const apres = await photo(p);
  if (apres !== avant) { const A = JSON.parse(avant), B = JSON.parse(apres); for (const k of Object.keys(A)) A[k].forEach((x, i) => { if (JSON.stringify(x) !== JSON.stringify(B[k][i])) console.log('DIFF', k, i, JSON.stringify(x).slice(0, 400), '=>', JSON.stringify(B[k][i]).slice(0, 400)); }); if (B.fenetres.length !== A.fenetres.length) console.log('DIFF fenetres', B.fenetres); }
  verifier(apres === avant, `${nom} : rien n'a changé à l'écran (valeurs, interrupteurs, étiquettes, aucune fenêtre ouverte)${apres === avant ? '' : ' — ' + apres.slice(0, 300)}`);
  verifier(JSON.stringify(await lireVol(p, 'v-feu')) === vAvant, `${nom} : rien n'a changé dans le carnet`);
  // photo de l'avion : la fiche s'ouvre en consultation, sans crayon ni recadrage
  await p.click('#ac-fiche'); await p.waitForSelector('#fiche:not([hidden])');
  verifier(await p.isHidden('#fi-ed') && await p.isHidden('#fi-web'), `${nom} : fiche de l'avion (photo) : ni crayon, ni photo à changer, ni recadrage`);
  await p.click('#fi-x'); await p.waitForSelector('#fiche', { state: 'hidden' });
  // flamme : appui long + glisser = rien ; toucher = bulle sans « Supprimer ce feu »
  await p.click('#carte-mini'); await p.waitForSelector('#carte-plein:not([hidden])');
  await p.waitForSelector('#carte-grande .carte-feu', { timeout: 15000 }); await p.waitForTimeout(400);
  const f0 = await p.locator('#carte-grande .carte-feu').boundingBox(), x = f0.x + f0.width / 2, y = f0.y + f0.height / 2;
  await p.mouse.move(x, y); await p.mouse.down(); await p.waitForTimeout(800);
  for (let k = 1; k <= 10; k++) { await p.mouse.move(x + 7 * k, y + 6 * k); await p.waitForTimeout(25); }
  await p.mouse.up(); await p.waitForTimeout(300);
  const f1 = await p.locator('#carte-grande .carte-feu').boundingBox();
  verifier(await p.isHidden('#feu-modal'), `${nom} : flamme : appui long et glisser : pas de « Déplacer le feu ici ? »`);
  await p.locator('#carte-grande .carte-feu').click({ force: true }); await p.waitForTimeout(300);
  verifier(!(await p.locator('#carte-grande .feu-suppr').count()) && JSON.stringify((await lireVol(p, 'v-feu')).feuxPositions) === JSON.stringify(VOLS[0].feuxPositions),
    `${nom} : flamme non déplaçable ni supprimable (bulle sans « Supprimer ce feu », position gardée ; écart à l'écran ${Math.round(Math.hypot(f1.x - f0.x, f1.y - f0.y))} px, carte glissée avec)`);
  await p.click('#cp-x'); await p.waitForSelector('#carte-plein', { state: 'hidden' });
}

async function lecture(nom, p) {
  await p.click('.flight[data-id="v-feu"]'); await p.waitForSelector('#v-saisie:not([hidden])');
  const t = () => p.evaluate(() => ({ titre: document.querySelector('#f-title').textContent, sous: document.querySelector('#f-sub').textContent, fermer: document.querySelector('#cancel').textContent,
    save: !!document.querySelector('#save').offsetParent, suppr: !!document.querySelector('#del-zone').offsetParent, crayon: !!document.querySelector('#f-edit').offsetParent,
    lecture: document.querySelector('#v-saisie').classList.contains('lecture'), saveTxt: document.querySelector('#save').textContent, fond: getComputedStyle(document.body).backgroundColor }));
  let e = await t();
  const [aa, mm, jj] = VOLS[0].date.split('-');
  verifier(e.lecture && e.titre === 'Vol' && e.sous === `du ${jj}/${mm}/${aa} · LFTW › LFTW` && e.fermer === 'Fermer' && !e.save && !e.suppr && e.crayon,
    `${nom} : vol ouvert en LECTURE SEULE : « ${e.titre} ${e.sous} », bouton « ${e.fermer} », crayon, ni Enregistrer ni Supprimer`);
  verifier(e.fond === 'rgb(237, 241, 245)', `${nom} : la fiche du vol garde son fond (${e.fond})`);
  const crayon = await p.evaluate(() => { const s = getComputedStyle(document.querySelector('#f-edit')), r = document.querySelector('#f-edit').getBoundingClientRect(); return { c: s.color, droite: innerWidth - r.right }; });
  verifier(crayon.c === 'rgb(31, 78, 121)' && crayon.droite < 30, `${nom} : crayon bleu foncé en haut à droite`);
  await p.screenshot({ path: join(CAPT, `v044-lecture-${nom.replace(/\W+/g, '-')}.png`), fullPage: true });
  await essaisLecture(nom, p);
  // LF / LOC / UTC restent utilisables (affichage seulement)
  const t0 = await p.inputValue('#f-t0');
  await p.click('#tz-loc'); const t0loc = await p.inputValue('#f-t0');
  const lf0 = await p.getAttribute('#tz-lf', 'aria-pressed'); await p.click('#tz-lf'); const lf1 = await p.getAttribute('#tz-lf', 'aria-pressed'); await p.click('#tz-lf');
  verifier(t0loc !== t0 && lf1 !== lf0 && await p.getAttribute('#tz-loc', 'aria-pressed') === 'true', `${nom} : LOC / UTC utilisable (${t0} UTC -> ${t0loc} LOC), LF aussi`);
  await p.click('#tz-utc');
  // crayon -> Modifier ; Annuler revient à la lecture sans rien changer
  await p.click('#f-edit');
  e = await t();
  verifier(!e.lecture && e.titre === 'Modifier le vol' && e.fermer === 'Annuler' && e.save && e.saveTxt === 'Enregistrer les modifications' && !e.crayon && e.suppr,
    `${nom} : crayon : « ${e.titre} », « ${e.fermer} », « ${e.saveTxt} »`);
  await p.fill('#f-rem', 'CHANGEMENT ESSAI'); await p.fill('#f-dep', 'LFMT');
  verifier(await p.inputValue('#f-rem') === 'CHANGEMENT ESSAI', `${nom} : en modification, les champs se modifient`);
  await p.click('#ac-fiche'); await p.waitForSelector('#fiche:not([hidden])');
  verifier(await p.isVisible('#fi-ed'), `${nom} : en modification, la fiche de l'avion retrouve son crayon`);
  await p.click('#fi-x'); await p.waitForSelector('#fiche', { state: 'hidden' });
  await p.click('#cancel'); await p.waitForTimeout(200);
  e = await t();
  verifier(e.lecture && e.titre === 'Vol' && await p.isVisible('#v-saisie') && await p.inputValue('#f-rem') === 'REMARQUE ESSAI' && await p.inputValue('#f-dep') === 'LFTW'
    && (await lireVol(p, 'v-feu')).remarques === 'REMARQUE ESSAI', `${nom} : Annuler : retour à la lecture seule, rien n'a changé (écran et carnet)`);
  // en modification, la flamme redevient modifiable (bulle avec « Supprimer ce feu »)
  await p.click('#f-edit');
  await p.click('#carte-mini'); await p.waitForSelector('#carte-grande .carte-feu', { timeout: 15000 }); await p.waitForTimeout(400);
  await p.locator('#carte-grande .carte-feu').click({ force: true }); await p.waitForTimeout(300);
  verifier(await p.locator('#carte-grande .feu-suppr').count() === 1, `${nom} : en modification, la flamme redevient modifiable`);
  await p.click('#cp-x'); await p.waitForSelector('#carte-plein', { state: 'hidden' });
  // crayon -> Enregistrer
  await p.fill('#f-rem', 'REMARQUE MODIFIEE');
  await p.click('#save'); await p.waitForSelector('#v-carnet:not([hidden])');
  verifier((await lireVol(p, 'v-feu')).remarques === 'REMARQUE MODIFIEE', `${nom} : crayon puis Enregistrer : modification enregistrée`);
  // nouveau vol : directement en modification
  await p.click('#fab'); await p.waitForSelector('#v-saisie:not([hidden])');
  e = await t();
  await p.fill('#f-rem', 'NOUVEAU');
  verifier(!e.lecture && e.titre === 'Nouveau vol' && e.fermer === 'Annuler' && e.save && !e.crayon && await p.inputValue('#f-rem') === 'NOUVEAU',
    `${nom} : nouveau vol (+) : directement en modification (« ${e.titre} », « ${e.saveTxt} »)`);
  await p.click('#cancel'); await p.click('#ab-yes', { timeout: 2000 }).catch(() => {}); await p.waitForSelector('#v-carnet:not([hidden])');
  // recherche puis « Voir dans le carnet » : en lecture seule
  await p.click('#q-open'); await p.fill('#q', 'LFMT'); await p.waitForTimeout(300);
  await p.click('#list .flight[data-id="v-ifr"]'); await p.waitForSelector('#v-saisie:not([hidden])');
  e = await t();
  verifier(e.lecture && e.titre === 'Vol' && !e.save, `${nom} : vol ouvert depuis la recherche : lecture seule`);
  await p.click('#cancel'); await p.waitForSelector('#v-carnet:not([hidden])');
  const voir = p.locator('#list .flight[data-id="v-ifr"] [data-voir]');
  if (await voir.count()) {
    await voir.click(); await p.waitForTimeout(400);
    await p.click('#list .flight[data-id="v-ifr"]'); await p.waitForSelector('#v-saisie:not([hidden])');
    e = await t();
    verifier(e.lecture && !e.save, `${nom} : vol ouvert après « Voir dans le carnet » : lecture seule`);
    await p.click('#cancel'); await p.waitForSelector('#v-carnet:not([hidden])');
  } else verifier(false, `${nom} : bouton « Voir dans le carnet » trouvé`);
}

try {
  const PARTIE = process.env.V044_PARTIE || ''; // vide = tout ; sinon R109, R111 ou R112 (mise au point)
  console.log('R109 : date dans son contour (mesure au pixel), mois');
  if (!PARTIE || PARTIE === 'R109') for (const [nom, moteur, largeur, dsf] of [['Chrome 390 px', nav, 390, 3], ['Chrome 360 px', nav, 360, 3], ['Chrome 390 px (écran ×2)', nav, 390, 2], ['WebKit 390 px', navSafari, 390, 3], ['WebKit 360 px', navSafari, 360, 2]]) {
    const { p } = await appareil(nom, moteur, largeur, { dsf });
    for (const theme of ['clair', 'sombre']) {
      await p.emulateMedia({ colorScheme: theme === 'clair' ? 'light' : 'dark' }); await p.waitForTimeout(100);
      await controlerDates(nom, p, theme);
      if (dsf === 3 || moteur === navSafari) await p.screenshot({ path: join(CAPT, `v044-r109-${nom.replace(/\W+/g, '-')}-${theme}.png`) });
    }
    const fonds = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    verifier(fonds === 'rgb(14, 22, 32)', `${nom} : thème sombre : fond inchangé (${fonds})`);
    await p.context().close();
  }

  console.log('R110 / R111 : fond, total, bande d\'heures (1 à 4 cases ; 390, 360, 340 px)');
  if (!PARTIE || PARTIE === 'R111') for (const [moteur, mnom] of [[nav, 'Chrome'], [navSafari, 'WebKit']]) {
    for (const largeur of [390, 360, 340]) {
      for (const n of [1, 2, 3, 4]) {
        const nom = `${mnom} ${largeur} px`;
        const { p, ctx } = await appareil(nom, moteur, largeur, { dsf: 2, bande: BANDE.slice(0, n) });
        const e = await entete(p);
        if (n === 1) verifier(e.fond === 'rgb(212, 222, 236)' && e.carteVol === 'rgb(255, 255, 255)', `${nom} : fond de l'accueil #d4deec, cartes blanches`);
        controlerEntete(nom, e, n);
        await p.screenshot({ path: join(CAPT, `v044-accueil-${mnom}-${largeur}-${n}cases.png`) });
        if (largeur === 340 && n === 4) {
          // très grosses valeurs inventées : 12 345h59, 98 765 largages
          const g = await appareil(`${nom} gros`, moteur, largeur, { dsf: 2, vols: GROS, bande: BANDE });
          const eg = await entete(g.p); controlerEntete(`${nom} gros carnet (${eg.total})`, eg, 4);
          await g.p.screenshot({ path: join(CAPT, `v044-accueil-${mnom}-340-gros.png`) }); await g.ctx.close();
          const z = await appareil(`${nom} énorme`, moteur, largeur, { dsf: 2, vols: ENORME, bande: BANDE.slice(0, 3) });
          const ez = await entete(z.p); controlerEntete(`${nom} total énorme (${ez.total})`, ez, 3);
          verifier(parseFloat(ez.valeur) < 38, `${nom} : très grand total : la police baisse (${ez.valeur})`);
          await z.p.screenshot({ path: join(CAPT, `v044-accueil-${mnom}-340-enorme.png`) }); await z.ctx.close();
        }
        if (largeur === 390 && n === 4) {
          // l'écran change de largeur (rotation, fenêtre du PC) : tout se réajuste
          await p.setViewportSize({ width: 340, height: 800 }); await p.waitForTimeout(250);
          controlerEntete(`${nom} -> 340 px (changement de largeur)`, await entete(p), 4);
        }
        if (largeur === 390 && n === 3) {
          verifier(e.valeur === '38px 800 rgb(15, 27, 53)', `${nom} : total 38 px, 800, #0f1b35 (${e.valeur})`);
          // toucher la bande : le menu des heures ; toucher le total : comme avant (rien ne s'ouvre)
          await p.click('#h-total'); await p.waitForTimeout(200);
          verifier(await p.isHidden('#hs-modal') && await p.isVisible('#v-carnet'), `${nom} : toucher le total : comme avant`);
          await p.click('#h-strip'); await p.waitForSelector('#hs-modal:not([hidden])');
          verifier(true, `${nom} : toucher la bande ouvre le choix des heures`);
          // 3 / 7 / 30 caché : rien ne bouge de travers
          await p.click('#hs-jours'); await p.click('#hs-x'); await p.waitForTimeout(150);
          const ej = await entete(p); controlerEntete(`${nom} sans 3/7/30`, ej, 3);
          await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(100);
          const es = await p.evaluate(() => ({ fond: getComputedStyle(document.body).backgroundColor, carte: getComputedStyle(document.querySelector('#h-carte')).backgroundColor }));
          verifier(es.fond === 'rgb(14, 22, 32)' && es.carte === 'rgb(23, 34, 46)', `${nom} : sombre : fond inchangé, carte du total aux couleurs des cartes sombres`);
          await p.screenshot({ path: join(CAPT, `v044-accueil-${mnom}-390-sombre.png`) });
        }
        await ctx.close();
      }
    }
  }

  console.log('R112 : vol en lecture seule');
  if (!PARTIE || PARTIE === 'R112') for (const [nom, moteur] of [['Chrome 390 px', nav], ['WebKit 390 px', navSafari]]) {
    const { p, ctx } = await appareil(nom, moteur, 390, { dsf: 2 });
    await lecture(nom, p);
    await ctx.close();
  }

  verifier(!bloquees.length, 'aucun appel hors de cet ordinateur' + (bloquees.length ? ' : ' + [...new Set(bloquees)].slice(0, 5).join(' ') : ''));
  verifier(!erreurs.length, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.slice(0, 5).join(' | ') : ''));
  console.log('\nv0.44 réussie.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await nav.close(); await navSafari.close(); srv.fermer();
}

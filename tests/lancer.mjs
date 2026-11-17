// v0.44 (R113) : lanceur des tests, deux commandes simples (notées dans CLAUDE.md) :
//   npm run test:rapide   -> TEST RAPIDE (10 min au plus) : tests unitaires + test de la version en cours + non-régression courte
//   npm run test:complet  -> TEST COMPLET : tests unitaires + TOUS les tests navigateur (la batterie entière)
// Chaque test tourne à part ; un échec n'arrête PAS la suite (on voit tout ce qui casse d'un coup). Durée de chaque test,
// résumé à la fin, journaux dans tests/navigateur/journaux/ (non commités). Code de sortie 1 si un test échoue.
// Le test rapide passe AUTOMATIQUEMENT en test complet si les fichiers modifiés depuis le dernier commit touchent à la
// synchro, à l'import, à la sauvegarde / restauration, au format des données ou au service worker (liste SENSIBLES).
// Aucun test n'appelle le vrai NAS, le vrai VPS ni Google (faux serveurs locaux, réseau extérieur bloqué).
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, createWriteStream, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../', import.meta.url));
const NAV = 'tests/navigateur/';
const JOURNAUX = join(RACINE, NAV, 'journaux');

// Batterie entière, dans l'ordre historique
export const COMPLET = ['parcours', 'installation', 'mise-a-jour', 'v04', 'v05', 'v06', 'v07', 'v08', 'v09', 'v010', 'v011', 'v012', 'v013',
  'v014', 'v015', 'v016', 'v016b', 'v017', 'v017b', 'v018', 'v019', 'v020', 'v021', 'v022', 'v023', 'v024', 'v025', 'v026', 'v027',
  'v028', 'v029', 'v030', 'v031', 'v032', 'v033', 'v034', 'v035', 'v036', 'v037', 'v038', 'v039', 'v041', 'v042', 'v043', 'v044', 'v045', 'v046', 'v047', 'v048', 'v049', 'v050', 'v051'];
// Non-régression courte (voir l'inventaire dans CLAUDE.md) : lancement sans erreur + parcours d'un vol + sauvegarde et
// restauration + PDF (parcours) ; mise à jour de version sans perte de données (mise-a-jour) ; synchro NAS de base sur un
// faux NAS (v012) ; accueil à 390 et 360 px (v044 et le test de la version). Le test de la version en cours est ajouté seul.
export const RAPIDE = ['parcours', 'mise-a-jour', 'v012'];
// Fichiers « sensibles » : s'ils ont changé, le test rapide devient le test complet
const SENSIBLES = [/^sw\.js$/, /^js\/(ui\/)?synchro\.js$/, /^js\/ui\/nas\.js$/, /^js\/(ui\/)?npf\.js$/, /^js\/flylog\.js$/,
  /^js\/sauvegarde\.js$/, /^js\/db\.js$/, /^js\/modele\.js$/, /^js\/etat\.js$/, /^js\/demenagement\.js$/, /^manifest\.webmanifest$/];

const derniereVersion = () => readdirSync(join(RACINE, NAV)).map(f => /^v0?(\d+)(b?)\.mjs$/.exec(f)).filter(Boolean)
  .map(m => ({ nom: m[0].slice(0, -4), n: Number(m[1]) * 10 + (m[2] ? 1 : 0) })).sort((a, b) => b.n - a.n)[0].nom;
function fichiersModifies() {
  try {
    const sortie = execFileSync('git', ['status', '--porcelain'], { cwd: RACINE, encoding: 'utf8' });
    return sortie.split('\n').filter(Boolean).map(l => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop());
  } catch { return []; }
}

const hms = ms => { const s = Math.round(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`; };
function lancer(nom, commande, args) {
  return new Promise(ok => {
    mkdirSync(JOURNAUX, { recursive: true });
    const journal = createWriteStream(join(JOURNAUX, `${nom}.log`));
    const env = { ...process.env, PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS: '1' };
    const libs = join(homedir(), '.cache/carnet-chromium-libs/root/usr/lib/x86_64-linux-gnu'); // bibliothèques de Chromium sur ce PC
    if (existsSync(libs) && !env.LD_LIBRARY_PATH) env.LD_LIBRARY_PATH = libs;
    const t0 = Date.now(), p = spawn(commande, args, { cwd: RACINE, env });
    let echecs = [];
    const lire = d => { journal.write(d); for (const l of String(d).split('\n')) if (/ÉCHEC|^not ok|Error|Timeout|exceeded|^\s*at .*\.mjs:\d+/.test(l)) echecs.push(l.trim()); };
    p.stdout.on('data', lire); p.stderr.on('data', lire);
    p.on('close', code => { journal.end(); ok({ nom, ok: code === 0, ms: Date.now() - t0, echecs: echecs.slice(0, 3) }); });
  });
}

const mode = process.argv[2] || 'rapide';
let liste;
if (mode === 'complet') liste = COMPLET;
else {
  const touches = fichiersModifies().filter(f => SENSIBLES.some(r => r.test(f)));
  if (touches.length) {
    console.log(`Fichiers sensibles modifiés (${touches.join(', ')}) : le test rapide devient le TEST COMPLET.\n`);
    liste = COMPLET;
  } else liste = [...new Set([...RAPIDE, derniereVersion(), ...process.argv.slice(3)])];
}
console.log(`${liste === COMPLET ? 'TEST COMPLET' : 'TEST RAPIDE'} : tests unitaires + ${liste.length} tests navigateur\n`);
const debut = Date.now(), resultats = [];
const u = await lancer('unitaires', process.execPath, ['--test', 'tests/unitaires/*.test.js']);
resultats.push(u); console.log(`${u.ok ? '✓' : '✗'} unitaires (${hms(u.ms)})`);
// Contrôle avec le VRAI fichier (totaux identiques à FlyLog) : seulement s'il est sur ce PC, hors du dépôt ; rien n'est écrit
const VRAI = [join(RACINE, '../donnees-privees/flylog-decode-v1.csv'), join(RACINE, '../donnees-privees/totaux-flylog-reference.json')];
if (VRAI.every(existsSync)) {
  const c = await lancer('controle-reel', process.execPath, ['outils/controle-import.mjs', ...VRAI]);
  resultats.push(c); console.log(`${c.ok ? '✓' : '✗'} contrôle avec le vrai fichier : totaux identiques (${hms(c.ms)})`);
} else console.log('- contrôle avec le vrai fichier : fichier absent de ce PC, non lancé');
for (const t of liste) {
  const r = await lancer(t, process.execPath, [NAV + t + '.mjs']);
  resultats.push(r);
  console.log(`${r.ok ? '✓' : '✗'} ${t} (${hms(r.ms)})${r.ok ? '' : '\n    ' + r.echecs.join('\n    ')}`);
}
const rates = resultats.filter(r => !r.ok);
console.log(`\n${rates.length ? `${rates.length} test(s) en échec : ${rates.map(r => r.nom).join(', ')}` : 'Tout est passé.'} Durée totale : ${hms(Date.now() - debut)}.`);
console.log(`Journaux : ${NAV}journaux/`);
process.exitCode = rates.length ? 1 : 0;

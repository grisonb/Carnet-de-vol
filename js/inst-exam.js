// v0.53 (R130) : instructeur ou examinateur EN PLUS de l'autre pilote (ex. place gauche avec un copi et un instructeur
// derrière). Pas une fonction : aucune heure ne change. Champs du vol déjà existants depuis la v0.1 (import FlyLog,
// tableur CSV, sauvegarde, synchro) : `nomInstructeur` (NAME_INSTRUCTOR) et `nomExaminateur` (NAME_EXAMINER).
// « SELF » (c'est moi l'instructeur) n'est jamais affiché ; en double commande (fonction dc), `nomInstructeur` est
// l'autre pilote (déjà affiché comme « Instr. ») : pas de bulle « Inst » en plus.

import { analyserFlyLog } from './flylog.js';

export const ROLES_IE = { inst: { champ: 'nomInstructeur', puce: 'Inst' }, exam: { champ: 'nomExaminateur', puce: 'Exam' } };
export const nomReel = n => (n && String(n).trim() && String(n).trim().toUpperCase() !== 'SELF' ? String(n).trim() : '');

// Personnes en plus de l'autre pilote : [{ role: 'inst' | 'exam', nom }] (bulles « Inst XXX » / « Exam XXX »)
export function instExamDuVol(v) {
  const l = [];
  if (v && v.fonction !== 'dc' && nomReel(v.nomInstructeur)) l.push({ role: 'inst', nom: nomReel(v.nomInstructeur) });
  if (v && nomReel(v.nomExaminateur)) l.push({ role: 'exam', nom: nomReel(v.nomExaminateur) });
  return l;
}

// Rattrapage depuis un export FlyLog (Plus › Import FlyLog) : vols du fichier avec un copi ET un instructeur ou
// examinateur, retrouvés dans le carnet par date + heure de début bloc + terrains ; le champ n'est rempli QUE s'il est
// vide. Rien d'autre n'est créé ni modifié. Renvoie { ok, modifs: [{ id, champs }], completes, deja, absents: [...] }.
const cleVol = v => `${v.date}|${v.hDep || ''}|${String(v.dep || '').toUpperCase()}|${String(v.arr || '').toUpperCase()}`;
export function completerInstExam(contenu, volsCarnet) {
  const r = analyserFlyLog(contenu);
  if (!r.ok) return { ok: false, message: r.message };
  const parCle = new Map();
  for (const v of volsCarnet) { const k = cleVol(v); if (!parCle.has(k)) parCle.set(k, []); parCle.get(k).push(v); }
  const modifs = [], absents = [];
  let completes = 0, deja = 0, concernes = 0;
  for (const f of r.aCreer) {
    if (!nomReel(f.nomCopi) || !(nomReel(f.nomInstructeur) || nomReel(f.nomExaminateur)) || f.fonction === 'dc') continue;
    concernes++;
    const v = (parCle.get(cleVol(f)) || [])[0];
    if (!v) { absents.push({ date: f.date, hDep: f.hDep || '', dep: f.dep, arr: f.arr }); continue; }
    const champs = {};
    for (const { champ } of Object.values(ROLES_IE)) if (nomReel(f[champ]) && !nomReel(v[champ])) champs[champ] = nomReel(f[champ]);
    if (Object.keys(champs).length) { modifs.push({ id: v.id, champs }); completes++; } else deja++;
  }
  return { ok: true, modifs, completes, deja, absents, concernes };
}

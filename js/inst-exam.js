// v0.53 (R130) : instructeur ou examinateur EN PLUS de l'autre pilote (ex. place gauche avec un copi et un instructeur
// derrière). Pas une fonction : aucune heure ne change. Champs du vol déjà existants depuis la v0.1 (import FlyLog,
// tableur CSV, sauvegarde, synchro) : `nomInstructeur` (NAME_INSTRUCTOR) et `nomExaminateur` (NAME_EXAMINER).
// « SELF » (c'est moi l'instructeur) n'est jamais affiché ; en double commande (fonction dc), `nomInstructeur` est
// l'autre pilote (déjà affiché comme « Instr. ») : pas de bulle « Inst » en plus.

export const ROLES_IE = { inst: { champ: 'nomInstructeur', puce: 'Inst' }, exam: { champ: 'nomExaminateur', puce: 'Exam' } };
export const nomReel = n => (n && String(n).trim() && String(n).trim().toUpperCase() !== 'SELF' ? String(n).trim() : '');

// Personnes en plus de l'autre pilote : [{ role: 'inst' | 'exam', nom }] (bulles « Inst XXX » / « Exam XXX »)
export function instExamDuVol(v) {
  const l = [];
  if (v && v.fonction !== 'dc' && nomReel(v.nomInstructeur)) l.push({ role: 'inst', nom: nomReel(v.nomInstructeur) });
  if (v && nomReel(v.nomExaminateur)) l.push({ role: 'exam', nom: nomReel(v.nomExaminateur) });
  return l;
}

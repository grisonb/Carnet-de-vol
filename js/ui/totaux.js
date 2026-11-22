// Écran Totaux : TOTAL HdV, 3/7/30 jours, rubriques, catégories, mission, étiquettes, types.
// v0.55 (R143) : sections repliables (réglage PRIVÉ « totauxOuverts » : celles laissées ouvertes, sur cet appareil) ;
// section « Trigrammes » (personnes qui ont un trigramme : vols et heures ensemble, dernier vol ; simulateur exclu).

import { $, esc, segs } from './commun.js';
import { etat, reglage, ecrireReglageDiscret, avionDe } from '../etat.js';
import { totauxTrigrammes } from '../personnes.js';
import { volsReels } from '../modele.js';
import { hm, aujourdhui, dateFr } from '../temps.js';
import { RUBRIQUES, calculerTotaux, filtrerPeriode, heuresDerniersJours, totalHdV, bornesPeriode } from '../totaux.js';

let periode = { genre: 'tout' };
const nombre = n => n.toLocaleString('fr-FR');
const ligne = (t, v) => `<div class="tline"><span>${esc(t)}</span><b>${v}</b></div>`;

export function rafraichirTotaux() {
  poserSections();
  const auj = aujourdhui();
  $('#t-total').textContent = hm(totalHdV(etat.vols));
  $('#t-quick').innerHTML = [3, 7, 30].map(n =>
    `<div><span class="lbl">${n} jours</span><b>${hm(heuresDerniersJours(etat.vols, n, auj))}</b></div>`).join('');
  const annees = [...new Set(etat.vols.map(v => v.date.slice(0, 4)))].sort().reverse();
  if (!annees.length) annees.push(auj.slice(0, 4));
  const sel = $('#per-a');
  if (sel.options.length !== annees.length) sel.innerHTML = annees.map(a => `<option>${a}</option>`).join('');
  if (periode.genre === 'annee' && !periode.annee) periode.annee = sel.value;
  if (periode.genre === 'dates') { periode.du = $('#per-du').value; periode.au = $('#per-au').value; }

  const vols = filtrerPeriode(volsReels(etat.vols), periode, auj); // v0.35 (R85) : les vols de simulation ne comptent pas
  const b = bornesPeriode(periode, auj);
  $('#per-txt').textContent = periode.genre === 'tout' ? `Tout le carnet · ${nombre(vols.length)} vols`
    : `${b.du ? 'Du ' + dateFr(b.du) : 'Depuis le début'} ${b.au ? 'au ' + dateFr(b.au) : "jusqu'à aujourd'hui"} · ${nombre(vols.length)} vols`;
  const t = calculerTotaux(vols, etat.avions);
  const val = r => (r.genre === 'duree' ? hm(t[r.cle]) : nombre(t[r.cle]));
  const groupe = g => RUBRIQUES.filter(r => r.groupe === g).map(r => ligne(r.titre, val(r))).join('');
  $('#t-h').innerHTML = groupe('heures');
  $('#t-c').innerHTML = RUBRIQUES.filter(r => r.groupe === 'categories' && t[r.cle]).map(r => ligne(r.titre, val(r))).join('') || '<p class="hint">Aucune heure sur la période.</p>';
  $('#t-m').innerHTML = groupe('metier');
  const et = Object.entries(t.parEtiquette).sort((x, y) => y[1] - x[1]);
  $('#t-e').innerHTML = et.map(([k, m]) => ligne(k, hm(m))).join('') || '<p class="hint">Aucune étiquette sur la période.</p>';
  const ty = Object.entries(t.parType).sort((x, y) => y[1] - x[1]);
  $('#t-t').innerHTML = ty.map(([k, m]) => ligne(k, hm(m))).join('') || '<p class="hint">Aucun vol sur la période.</p>';
  const pa = Object.entries(t.parAvion).sort((x, y) => y[1].minutes - x[1].minutes);
  $('#t-a').innerHTML = pa.map(([id, s]) => {
    const a = etat.avions.get(id);
    return ligne(`${a ? a.immat : '?'}${a && a.nom ? ' · ' + a.nom : ''}`, `${hm(s.minutes)} <small>${nombre(s.vols)} vol${s.vols > 1 ? 's' : ''}</small>`);
  }).join('') || '<p class="hint">Aucun vol sur la période.</p>';
  const tri = totauxTrigrammes(vols, etat.personnes, v => !!(avionDe(v)?.sim) || v.simTemps > 0);
  $('#t-tri').innerHTML = tri.map(l => `<div class="tline tri"><span><b>${esc(l.tri)}</b> <small>${nombre(l.vols)} vol${l.vols > 1 ? 's' : ''} · dernier le ${dateFr(l.dernier)}</small></span><b>${hm(l.minutes)}</b></div>`).join('')
    || '<p class="hint">Aucun vol avec une personne qui a un trigramme sur la période.</p>';
}

// ---------- Sections repliables ----------
const ouvertes = () => { const o = reglage('totauxOuverts'); return Array.isArray(o) ? o : []; };
function poserSections() {
  const o = ouvertes();
  for (const sec of document.querySelectorAll('#v-totaux .sec.repli')) {
    const ouvert = o.includes(sec.dataset.sec);
    sec.classList.toggle('ouvert', ouvert);
    sec.querySelector('.sec-t').setAttribute('aria-expanded', String(ouvert));
    sec.querySelector('.tot').hidden = !ouvert;
  }
}

export function initTotaux() {
  poserSections();
  $('#v-totaux').addEventListener('click', async e => {
    const b = e.target.closest('.sec-t');
    if (!b) return;
    const k = b.closest('.sec.repli').dataset.sec, o = ouvertes();
    await ecrireReglageDiscret('totauxOuverts', o.includes(k) ? o.filter(x => x !== k) : [...o, k]);
    poserSections();
  });
  segs('#per', b => {
    const p = b.dataset.p;
    periode = p === 'annee' ? { genre: 'annee', annee: $('#per-a').value } : p === 'dates' ? { genre: 'dates' } : { genre: p };
    $('#per-annee').hidden = p !== 'annee';
    $('#per-dates').hidden = p !== 'dates';
    if (p === 'dates' && !$('#per-du').value) {
      $('#per-du').value = `${aujourdhui().slice(0, 4)}-01-01`; $('#per-au').value = aujourdhui();
    }
    rafraichirTotaux();
  });
  $('#per-a').addEventListener('change', () => { periode = { genre: 'annee', annee: $('#per-a').value }; rafraichirTotaux(); });
  for (const s of ['#per-du', '#per-au']) $(s).addEventListener('change', rafraichirTotaux);
}

// Lot 1 : affichage (thème, taille du texte), sauvegarde de la progression, version imprimable.
// Chargé après app.js (utilise $, esc, prog, extra, save, errCount, today, FICHES, GLOSSAIRE, MANUEL).

// ── Affichage : thème clair / sombre / automatique, taille du texte (préférences de cet appareil) ──
const UI_KEY = 'phraseo-ui-v1';
let ui = { theme: 'auto', size: 16 };
try { ui = { ...ui, ...JSON.parse(localStorage.getItem(UI_KEY)) }; } catch {}
function applyUi() {
  if (ui.theme === 'light' || ui.theme === 'dark') document.documentElement.dataset.theme = ui.theme;
  else delete document.documentElement.dataset.theme;
  ui.size = Math.min(24, Math.max(14, +ui.size || 16));
  document.documentElement.style.fontSize = ui.size + 'px';
  $('#theme').value = ui.theme;
  $('#sizeVal').textContent = Math.round(ui.size / 16 * 100) + ' %';
  try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch {}
}
$('#theme').addEventListener('change', e => { ui.theme = e.target.value; applyUi(); });
$('#smaller').addEventListener('click', () => { ui.size -= 2; applyUi(); });
$('#bigger').addEventListener('click', () => { ui.size += 2; applyUi(); });
applyUi();

// ── Sauvegarde : export / import d'un fichier, pour changer d'appareil sans compte ──
function exportProgress() {
  const data = JSON.stringify({ app: 'phraseo', version: 1, date: new Date().toISOString(), prog, extra });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = `phraseo-progression-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// Le fichier importé vient de l'extérieur : on n'accepte que la structure attendue, avec des nombres finis.
function validProgress(d) {
  if (!d || d.app !== 'phraseo' || !d.prog || typeof d.prog !== 'object' || Array.isArray(d.prog)) return false;
  const ids = Object.keys(d.prog);
  return ids.length <= 5000 && ids.every(k => /^[a-z0-9]{1,12}$/.test(k) && Array.isArray(d.prog[k])
    && d.prog[k].length <= 5 && d.prog[k].every(n => Number.isFinite(n) && n >= 0));
}
function cleanExtra(e) {
  const out = {};
  if (!e || typeof e !== 'object' || Array.isArray(e)) return out;
  if (Number.isFinite(e.best)) out.best = e.best;
  if (Array.isArray(e.exams)) out.exams = e.exams.filter(x => x && /^\d{4}-\d\d-\d\d$/.test(x.date) && Number.isFinite(x.pct))
    .slice(-500).map(x => ({ date: x.date, pct: x.pct }));
  if (e.defi && typeof e.defi === 'object') out.defi = Object.fromEntries(Object.entries(e.defi)
    .filter(([d, s]) => /^\d{4}-\d\d-\d\d$/.test(d) && Number.isFinite(s)));
  if (e.tally && typeof e.tally === 'object') out.tally = Object.fromEntries(Object.entries(e.tally)
    .filter(([k, n]) => /^[a-z]{1,20}$/.test(k) && Number.isFinite(n)));
  return out;
}
$('#exportBtn').addEventListener('click', exportProgress);
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  let d = null;
  try { if (f.size < 2e6) d = JSON.parse(await f.text()); } catch {}
  if (!validProgress(d)) return alert('Ce fichier n’est pas une sauvegarde de progression Phraséo valide. Rien n’a été modifié.');
  if (!confirm(`Remplacer la progression de cet appareil par celle du fichier (${Object.keys(d.prog).length} exercices, sauvegardée le ${String(d.date).slice(0, 10)}) ?`)) return;
  prog = d.prog; extra = cleanExtra(d.extra);
  save(); errCount(); showStats();
});

// ── Version imprimable : fiches de cours + glossaire (le navigateur permet « Enregistrer en PDF ») ──
function printAll() {
  $('#print').innerHTML = `<h1>Phraséo – fiches de cours</h1>
    <p>Résumé du Manuel de phraséologie DSNA (10e édition, 15 avril 2023) et du règlement SERA (version consolidée du 1er mai 2025).
    Outil d'entraînement : seuls les documents officiels en vigueur font foi. Imprimé le ${today()}.</p>
    ${FICHES.map(f => `<section><h2>${esc(f.titre)}</h2><ul>${f.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      <p class="src">Sources : ${esc(f.src)}</p></section>`).join('')}
    <section class="gl"><h1>Glossaire FR ⇄ EN</h1><table><thead><tr><th>Français</th><th>English</th><th>Page</th></tr></thead><tbody>
    ${GLOSSAIRE.map(([fr, en, p]) => `<tr><td>${esc(fr)}</td><td>${esc(en)}</td><td>${p}</td></tr>`).join('')}</tbody></table></section>`;
  $$('dialog[open]').forEach(d => d.close());
  window.print();
}
$$('.printBtn').forEach(b => b.addEventListener('click', printAll));

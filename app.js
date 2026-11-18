const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const val = n => $(`input[name=${n}]:checked`).value;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let pool = [], idx = 0, cur, ok = 0, total = 0, streak = 0, answered = false;

function start() {
  const l = val('lang'), r = val('regle'), m = val('mode'), chrono = $('#chrono').checked;
  pool = QUESTIONS.filter(q =>
    (r === 'alpha' ? q.regle === 'alpha' : q.regle !== 'alpha' && (r === 'all' || q.regle === r) && (l === 'all' || q.lang === l))
    && (m === 'qcm' || !q.qcmOnly) && (!chrono || r === 'alpha' || q.st));
  if (!chrono) pool.sort(() => Math.random() - 0.5);
  idx = ok = total = streak = 0;
  stats();
  next();
}

function stats() {
  $('#score').textContent = `${ok} / ${total}`;
  $('#streak').textContent = `🔥 ${streak}`;
  $('#prog').style.width = pool.length ? `${100 * idx / pool.length}%` : '0';
}

function next() {
  speechSynthesis.cancel();
  if (!pool.length) { $('#card').innerHTML = '<p class="ctx">Aucune question pour ces réglages.</p>'; return; }
  if (idx >= pool.length) return end();
  cur = pool[idx++];
  answered = false;
  stats();
  const mode = val('mode'), en = cur.lang === 'en', listen = $('#ecoute').checked && cur.atc;
  const q = cur.q || (en ? 'Read back this instruction:' : 'Collationnez :');
  let h = `<div class="radio"><span class="led" id="led"></span><span>COM1</span><strong>${esc(cur.st || '—')}</strong>
    <span class="prog">${idx} / ${pool.length}</span></div>
    <div class="tags"><span class="tag">${cur.regle === 'alpha' ? 'OACI' : cur.regle.toUpperCase()}</span>${cur.regle === 'alpha' ? '' : `<span class="tag">${en ? 'EN' : 'FR'}</span>`}</div>
    <p class="ctx">${esc(cur.ctx)}</p>`;
  if (cur.atc) h += `<div class="bubble atc"><div class="who">ATC</div>
    <p class="msg ${listen ? 'hidden' : ''}" id="atc">${esc(radio(cur.atc))}</p>
    <button class="ghost" id="hear">🔊 ${listen ? 'Réécouter' : 'Écouter'}</button></div>`;
  h += `<p class="q">${esc(q)}</p>`;
  if (mode === 'qcm') {
    const opts = [cur.answers[0], ...cur.wrong].sort(() => Math.random() - 0.5);
    h += `<div class="opts">${opts.map((o, i) => `<button data-o="${esc(o)}"><span class="n">${i + 1}</span><span>${esc(radio(o))}</span></button>`).join('')}</div>`;
  } else if (mode === 'ecrit') {
    h += `<textarea id="txt" placeholder="${en ? 'Your readback…' : 'Votre collationnement…'}"></textarea>
      <div class="row"><button class="primary" id="go">Valider</button></div>`;
  } else {
    h += SR ? `<div class="row"><button class="primary mic" id="mic">🎤 Appuyer pour parler</button><span id="heard" class="muted"></span></div>`
      : '<p class="warn">La reconnaissance vocale n’est pas disponible dans ce navigateur. Utilisez Chrome ou Edge.</p>';
  }
  h += '<div id="fb"></div>';
  $('#card').innerHTML = h;

  $('#hear')?.addEventListener('click', say);
  $$('.opts button').forEach(b => b.addEventListener('click', () => pick(b)));
  $('#go')?.addEventListener('click', () => grade($('#txt').value));
  $('#mic')?.addEventListener('click', listenMic);
  if (listen) say();
  ($('#txt') || $('.opts button') || $('#mic'))?.focus();
}

function say() {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(speakable(cur.atc, cur.lang));
  u.lang = cur.lang === 'en' ? 'en-GB' : 'fr-FR';
  u.rate = 1.05;
  u.onstart = () => $('#led')?.classList.add('tx');
  u.onend = () => $('#led')?.classList.remove('tx');
  speechSynthesis.speak(u);
}

function pick(b) {
  if (answered) return;
  const good = b.dataset.o === cur.answers[0];
  $$('.opts button').forEach(x => { x.disabled = true; if (x.dataset.o === cur.answers[0]) x.classList.add('good'); });
  if (!good) b.classList.add('bad');
  feedback(good);
}

function listenMic() {
  const rec = new SR(), mic = $('#mic');
  rec.lang = cur.lang === 'en' ? 'en-GB' : 'fr-FR';
  mic.disabled = true; mic.classList.add('on'); mic.textContent = '🔴 À vous…';
  rec.onresult = e => grade(e.results[0][0].transcript);
  rec.onerror = e => { $('#heard').textContent = `Erreur micro : ${e.error}`; };
  rec.onend = () => { if (!answered) { mic.disabled = false; mic.classList.remove('on'); mic.textContent = '🎤 Réessayer'; } };
  rec.start();
}

function grade(text) {
  if (answered || !text.trim()) return;
  if (cur.regle === 'alpha') {
    const w = s => s.toLowerCase().replace(/[^a-z]/g, '');
    return feedback(cur.answers.some(a => w(a) === w(text)), '', text);
  }
  const r = check(text, cur.answers), why = [];
  if (!r.csOk) why.push('indicatif manquant');
  if (!r.numbersOk) why.push('nombres incorrects ou manquants');
  why.push(`${Math.round(r.score * 100)} % des mots corrects`);
  feedback(r.pass, why.join(' · '), text);
}

function feedback(good, detail = '', said = '') {
  answered = true;
  total++; if (good) { ok++; streak++; } else streak = 0;
  stats();
  $('#atc')?.classList.remove('hidden');
  if ($('#go')) $('#go').disabled = true;
  if ($('#mic')) { $('#mic').disabled = true; $('#mic').classList.remove('on'); $('#mic').textContent = '🎤'; }
  $('#fb').innerHTML = `<div class="fb ${good ? 'ok' : 'ko'}">
    <p><strong>${good ? '✅ Correct' : '❌ À revoir'}</strong> ${esc(detail)}</p>
    ${said ? `<p>Votre réponse : <em>${esc(said)}</em></p>` : ''}
    <p>Réponse attendue : <strong>${esc(radio(cur.answers[0]))}</strong></p>
    <p class="src">📘 Source : ${esc(cur.src)}</p>
    <div class="row"><button class="primary" id="nx">Suivant →</button></div></div>`;
  $('#nx').addEventListener('click', next);
  $('#nx').focus();
}

function end() {
  stats();
  const pct = total ? Math.round(100 * ok / total) : 0;
  $('#card').innerHTML = `<div class="radio"><span class="led"></span><span>COM1</span><strong>FIN DE SÉRIE</strong></div>
    <p class="ctx">Série terminée : ${ok} / ${total} (${pct} %)</p>
    <div class="row" style="margin:0 20px"><button class="primary" id="again">Recommencer</button></div>`;
  $('#again').addEventListener('click', start);
  $('#again').focus();
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA') {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#go')?.click(); }
    return;
  }
  if (!answered && /^[1-4]$/.test(e.key)) $$('.opts button')[e.key - 1]?.click();
});

$$('.settings input').forEach(i => i.addEventListener('change', start));
start();

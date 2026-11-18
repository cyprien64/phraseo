const $ = s => document.querySelector(s);
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let pool = [], cur, ok = 0, total = 0;

function start() {
  const l = $('#lang').value, r = $('#regle').value, m = $('#mode').value;
  pool = QUESTIONS.filter(q => (l === 'all' || q.lang === l) && (r === 'all' || q.regle === r) && (m === 'qcm' || !q.qcmOnly));
  next();
}

function next() {
  if (!pool.length) { $('#card').innerHTML = '<p>Aucune question pour ces filtres.</p>'; return; }
  cur = pool[Math.floor(Math.random() * pool.length)];
  const mode = $('#mode').value, en = cur.lang === 'en';
  const q = cur.q || (en ? 'Read back (collationnez) this instruction:' : 'Collationnez :');
  let html = `<span class="tag">${cur.regle.toUpperCase()}</span><span class="tag">${en ? 'EN' : 'FR'}</span>
    <p><strong>${esc(cur.ctx)}</strong></p>`;
  if (cur.atc) html += `<p class="atc">🎧 ATC : ${esc(cur.atc)}</p><button id="hear">🔊 Écouter</button>`;
  html += `<p>${esc(q)}</p>`;
  if (mode === 'qcm') {
    const opts = [cur.answers[0], ...cur.wrong].sort(() => Math.random() - 0.5);
    html += `<div class="opts">${opts.map(o => `<button data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  } else if (mode === 'ecrit') {
    html += `<textarea id="txt" placeholder="Votre réponse…"></textarea><div class="row"><button class="primary" id="go">Valider</button></div>`;
  } else {
    html += SR ? `<div class="row"><button class="primary" id="mic">🎤 Parler</button></div><p id="heard" class="muted"></p>`
      : '<p class="bad">La reconnaissance vocale n’est pas disponible dans ce navigateur. Utilisez Chrome ou Edge.</p>';
  }
  html += `<div id="fb"></div>`;
  $('#card').innerHTML = html;

  $('#hear')?.addEventListener('click', () => {
    const u = new SpeechSynthesisUtterance(cur.atc);
    u.lang = en ? 'en-GB' : 'fr-FR';
    speechSynthesis.speak(u);
  });
  document.querySelectorAll('.opts button').forEach(b => b.addEventListener('click', () => {
    const good = b.dataset.o === cur.answers[0];
    document.querySelectorAll('.opts button').forEach(x => {
      x.disabled = true;
      if (x.dataset.o === cur.answers[0]) x.classList.add('good');
    });
    if (!good) b.classList.add('bad');
    feedback(good);
  }));
  $('#go')?.addEventListener('click', () => grade($('#txt').value));
  $('#mic')?.addEventListener('click', listen);
}

function listen() {
  const rec = new SR();
  rec.lang = cur.lang === 'en' ? 'en-GB' : 'fr-FR';
  $('#mic').disabled = true;
  $('#heard').textContent = 'Écoute en cours…';
  rec.onresult = e => {
    const said = e.results[0][0].transcript;
    $('#heard').textContent = `Entendu : « ${said} »`;
    grade(said);
  };
  rec.onerror = e => { $('#heard').textContent = `Erreur micro : ${e.error}`; $('#mic').disabled = false; };
  rec.start();
}

function grade(text) {
  if (!text.trim()) return;
  const r = check(text, cur.answers);
  const why = [];
  if (!r.csOk) why.push('indicatif manquant');
  if (!r.numbersOk) why.push('nombres incorrects ou manquants');
  why.push(`${Math.round(r.score * 100)} % des mots corrects`);
  feedback(r.pass, why.join(' · '));
}

function feedback(good, detail = '') {
  total++; if (good) ok++;
  $('#score').textContent = `${ok} / ${total}`;
  $('#fb').innerHTML = `<div class="fb">
    <p class="${good ? 'good' : 'bad'}"><strong>${good ? '✅ Correct' : '❌ Incorrect'}</strong> ${esc(detail)}</p>
    <p>Réponse attendue : <strong>${esc(cur.answers[0])}</strong></p>
    <p class="src">Source : ${esc(cur.src)}</p>
    <button class="primary" id="nx">Suivant →</button></div>`;
  $('#go') && ($('#go').disabled = true);
  $('#nx').addEventListener('click', next);
  $('#nx').focus();
}

['#lang', '#regle', '#mode'].forEach(s => $(s).addEventListener('change', start));
start();

// Voix réaliste : synthèse neuronale Piper calculée dans ce worker (la page ne se fige pas).
// Phonétisation espeak-ng (piper-phonemize, via vits-web) + modèle VITS exécuté par onnxruntime-web.
// Chaque modèle (≈ 60 Mo) est téléchargé une fois puis gardé dans le cache du navigateur ; il reste chargé
// en mémoire tant que la page est ouverte.
import { createPiperPhonemize } from 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/dist/piper-DeOu3H9E.js';
import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/+esm';

// version figée du dépôt de voix (commit du 5 juillet 2024) : les fichiers ne peuvent plus changer sous nos pieds
const HF = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/840e38a7e26d813bd6221b78cfbaefa3585b3f71';
const PHON = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';
ort.env.wasm.wasmPaths = 'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/';
ort.env.wasm.numThreads = 1; // pas d'isolation cross-origin sur GitHub Pages
const PATHS = {
  'fr_FR-tom-medium': 'fr/fr_FR/tom/medium/fr_FR-tom-medium.onnx',
  'fr_FR-siwis-medium': 'fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx',
  'en_GB-alan-medium': 'en/en_GB/alan/medium/en_GB-alan-medium.onnx',
  'en_GB-cori-medium': 'en/en_GB/cori/medium/en_GB-cori-medium.onnx',
  'en_GB-northern_english_male-medium': 'en/en_GB/northern_english_male/medium/en_GB-northern_english_male-medium.onnx',
};

caches.delete('phraseo-voix-v1').catch(() => {}); // voix d'avant la version figée : place libérée

async function get(url, progress) {
  const cache = await caches.open('phraseo-voix-v2');
  const hit = await cache.match(url);
  if (hit) return hit.blob();
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const total = +(r.headers.get('Content-Length') || 0), reader = r.body.getReader(), parts = [];
  for (let loaded = 0; ;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); loaded += value.length;
    if (progress && total) progress(loaded / total);
  }
  const blob = new Blob(parts);
  await cache.put(url, new Response(blob)).catch(() => {}); // cache plein : on recommencera la prochaine fois
  return blob;
}

const voices = {};
const voice = (id, progress) => (voices[id] ||= (async () => {
  if (!PATHS[id]) throw new Error('voix inconnue ' + id);
  const cfg = JSON.parse(await (await get(`${HF}/${PATHS[id]}.json`)).text());
  const model = await get(`${HF}/${PATHS[id]}`, progress);
  return { cfg, session: await ort.InferenceSession.create(await model.arrayBuffer()) };
})().catch(e => { delete voices[id]; throw e; }));

function phonemes(text, lang) {
  return new Promise((resolve, reject) => {
    createPiperPhonemize({
      print: l => resolve(JSON.parse(l).phoneme_ids),
      printErr: l => reject(new Error(l)),
      locateFile: f => (f.endsWith('.wasm') ? `${PHON}.wasm` : f.endsWith('.data') ? `${PHON}.data` : f),
    }).then(m => m.callMain(['-l', lang, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']), reject);
  });
}

// message : { id, text, voiceId, slow } (slow : multiplie la durée, 1 = débit naturel du modèle)
onmessage = async ({ data: { id, text, voiceId, slow = 1 } }) => {
  try {
    const v = await voice(voiceId, p => postMessage({ id, progress: p }));
    const ids = await phonemes(text.trim(), v.cfg.espeak.voice);
    const { noise_scale, length_scale, noise_w } = v.cfg.inference;
    const feeds = {
      input: new ort.Tensor('int64', ids, [1, ids.length]),
      input_lengths: new ort.Tensor('int64', [ids.length]),
      scales: new ort.Tensor('float32', [noise_scale, length_scale * slow, noise_w]),
    };
    if (Object.keys(v.cfg.speaker_id_map || {}).length) feeds.sid = new ort.Tensor('int64', [0]);
    const { output } = await v.session.run(feeds);
    const pcm = new Float32Array(output.data);
    postMessage({ id, pcm, rate: v.cfg.audio.sample_rate }, [pcm.buffer]);
  } catch (e) {
    postMessage({ id, error: String(e) });
  }
};

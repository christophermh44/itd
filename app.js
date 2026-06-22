
const audioUrl = "audio/birds.mp3";

let audioCtx;
let audioEl;
let source;
let delayL, delayR;
let filterL, filterR;
let started = false;

async function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  audioEl = new Audio(audioUrl);
  audioEl.crossOrigin = "anonymous";
  audioEl.loop = true;

  source = audioCtx.createMediaElementSource(audioEl);
}

function buildGraph() {
  const splitter = audioCtx.createChannelSplitter(2);

  const gainL = audioCtx.createGain();
  const gainR = audioCtx.createGain();
  gainL.gain.value = 0.5;
  gainR.gain.value = 0.5;

  const mergerMono = audioCtx.createChannelMerger(1);

  delayL = audioCtx.createDelay();
  delayR = audioCtx.createDelay();

  // filtres tête (low-pass)
  filterL = audioCtx.createBiquadFilter();
  filterR = audioCtx.createBiquadFilter();

  filterL.type = "lowpass";
  filterR.type = "lowpass";

  const mergerStereo = audioCtx.createChannelMerger(2);

  /**
   * ROUTING: Source -> Splitter -> Gains -> Merger Mono -> Delays -> Filters -> Merger Stereo -> Destination
   */
  source.connect(splitter);

  splitter.connect(gainL, 0);
  splitter.connect(gainR, 1);

  gainL.connect(mergerMono, 0, 0);
  gainR.connect(mergerMono, 0, 0);

  mergerMono.connect(delayL);
  mergerMono.connect(delayR);

  delayL.connect(filterL);
  delayR.connect(filterR);

  filterL.connect(mergerStereo, 0, 0);
  filterR.connect(mergerStereo, 0, 1);

  mergerStereo.connect(audioCtx.destination);

  started = true;
}

function updatePan(panValue) {
  const maxDelay = 0.002; // 2 ms
  const now = audioCtx.currentTime;

  // Mise à jour de l'affichage de la valeur du pan en affichant le délai en ms
  const panOutput = document.querySelector(`output[for="pan"]`);
  if (panValue === 0) {
    panOutput.value = "Délai : 0ms, source au centre.";
  } else {
    panOutput.value = `Délai : ${Math.abs(panValue * maxDelay * 1000).toFixed(2)}ms plus tôt à ${panValue < 0 ? "gauche" : "droite"}.`;
  }

  document.body.style.setProperty("--pan-value", panValue);

  if (!started) return;

  // ITD
  if (panValue < 0) {
    delayL.delayTime.setValueAtTime(0, now);
    delayR.delayTime.setValueAtTime(-panValue * maxDelay, now);
  } else {
    delayL.delayTime.setValueAtTime(panValue * maxDelay, now);
    delayR.delayTime.setValueAtTime(0, now);
  }

  // Filtre tête (low-pass côté opposé)
  const minFreq = 3000;
  const maxFreq = 20000;

  // courbe adoucie (non linéaire)
  const amount = Math.pow(Math.abs(panValue), 1.5);

  // réduction de l'intensité globale
  const strength = 0.6;

  const cutoffOpposite = maxFreq - (amount * strength) * (maxFreq - minFreq);

  if (panValue < 0) {
    // son à gauche → filtrer droite
    filterL.frequency.setValueAtTime(maxFreq, now);
    filterR.frequency.setValueAtTime(cutoffOpposite, now);
  } else {
    // son à droite → filtrer gauche
    filterL.frequency.setValueAtTime(cutoffOpposite, now);
    filterR.frequency.setValueAtTime(maxFreq, now);
  }
}

const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");
const panSlider = document.getElementById("pan");

async function play() {
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  if (!started) {
    buildGraph();
  }

  updatePan(parseFloat(panSlider.value));

  audioEl.play();

  playBtn.setAttribute('hidden', '');
  stopBtn.removeAttribute('hidden');
}

async function stop() {
  if (audioEl) {
    audioEl.pause();

    stopBtn.setAttribute('hidden', '');
    playBtn.removeAttribute('hidden');
  }
}

// UI

playBtn.addEventListener("click", play);
stopBtn.addEventListener("click", stop);

panSlider.addEventListener("input", () => {
  updatePan(parseFloat(panSlider.value));
});

panSlider.addEventListener("dblclick", () => {
  panSlider.value = 0;
  updatePan(0);
});

initAudio();
updatePan(0);
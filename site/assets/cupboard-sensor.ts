export {};

const toggle = document.querySelector<HTMLButtonElement>('#sensor-toggle')!;
const status = document.querySelector<HTMLElement>('#sensor-status')!;
const brightness = document.querySelector<HTMLElement>('#sensor-brightness')!;
const range = document.querySelector<HTMLElement>('#sensor-range')!;
const change = document.querySelector<HTMLElement>('#sensor-change')!;
const reset = document.querySelector<HTMLButtonElement>('#sensor-reset')!;
const low = document.querySelector<HTMLElement>('#sensor-low')!;
const high = document.querySelector<HTMLElement>('#sensor-high')!;
const graphSummary = document.querySelector<HTMLElement>('#sensor-graph-summary')!;
const graph = document.querySelector<SVGSVGElement>('#sensor-graph')!;
const trace = document.querySelector<SVGPathElement>('#sensor-trace')!;
const lowLine = document.querySelector<SVGLineElement>('#sensor-low-line')!;
const highLine = document.querySelector<SVGLineElement>('#sensor-high-line')!;
const music = document.querySelector<HTMLElement>('#sensor-music')!;
const thresholdForm = document.querySelector<HTMLFormElement>('#sensor-thresholds')!;
const startInput = document.querySelector<HTMLInputElement>('#sensor-start-threshold')!;
const stopInput = document.querySelector<HTMLInputElement>('#sensor-stop-threshold')!;
const thresholdError = document.querySelector<HTMLElement>('#sensor-threshold-error')!;
const startLine = document.querySelector<SVGLineElement>('#sensor-start-line')!;
const stopLine = document.querySelector<SVGLineElement>('#sensor-stop-line')!;
const startLabel = document.querySelector<HTMLElement>('#sensor-start-label')!;
const stopLabel = document.querySelector<HTMLElement>('#sensor-stop-label')!;
const timeLabels = ['start', 'middle', 'end'].map(name => document.querySelector<HTMLElement>(`#sensor-time-${name}`)!);
const video = document.querySelector<HTMLVideoElement>('#sensor-video')!;
const canvas = document.createElement('canvas');
canvas.width = 160;
canvas.height = 120;
const context = canvas.getContext('2d', { willReadFrequently: true })!;
const historyDuration = 180_000;
const triggerHold = 600;

let stream: MediaStream | null = null;
let animation = 0;
let lastSample = -Infinity;
let previous: Float32Array | null = null;
let history: { time: number; brightness: number }[] = [];
let thresholds = { start: startInput.valueAsNumber, stop: stopInput.valueAsNumber };
type MusicState = 'start' | 'stop';
let musicState: MusicState = 'stop';
let pendingTrigger: { state: MusicState; since: number } | null = null;

function setMusic(state: MusicState) {
  musicState = state;
  if (music.dataset.state !== state) {
    music.dataset.state = state;
    music.textContent = `Music: ${state.toUpperCase()}`;
  }
  pendingTrigger = null;
}

function updateMusic(value: number, now: number) {
  const target = musicState === 'stop' && value >= thresholds.start ? 'start'
    : musicState === 'start' && value <= thresholds.stop ? 'stop'
      : musicState;
  if (target === musicState) {
    pendingTrigger = null;
  } else if (pendingTrigger?.state !== target) {
    pendingTrigger = { state: target, since: now };
  } else if (now - pendingTrigger.since >= triggerHold) {
    setMusic(target);
  }
}

function renderThresholds() {
  for (const [line, label, value] of [[startLine, startLabel, thresholds.start], [stopLine, stopLabel, thresholds.stop]] as const) {
    const y = String(graph.viewBox.baseVal.height * (1 - value / 100));
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    line.setAttribute('visibility', 'visible');
    label.textContent = `${value.toFixed(1)}%`;
  }
}

thresholdForm.addEventListener('submit', event => {
  event.preventDefault();
  const next = { start: startInput.valueAsNumber, stop: stopInput.valueAsNumber };
  const valid = startInput.validity.valid && stopInput.validity.valid && next.stop < next.start;
  startInput.setAttribute('aria-invalid', String(!valid));
  stopInput.setAttribute('aria-invalid', String(!valid));
  thresholdError.hidden = valid;
  if (!valid) {
    thresholdError.textContent = 'Not applied. Use 0–100% in steps of 0.1, with Stop lower than Start. The graph still shows the active thresholds.';
    return;
  }
  thresholds = next;
  setMusic('stop');
  renderThresholds();
});
renderThresholds();
document.querySelector<HTMLButtonElement>('#sensor-apply-thresholds')!.disabled = false;

function renderGraph() {
  const latest = history.at(-1);
  const elapsed = latest ? latest.time - history[0].time : 0;
  const span = Math.min(historyDuration, Math.max(30_000, Math.ceil(elapsed / 30_000) * 30_000));
  timeLabels.forEach((label, index) => {
    label.textContent = `−${Math.round(span / 1000 * (1 - index / 3))} s`;
  });
  reset.disabled = !latest;
  if (!latest) {
    trace.setAttribute('d', '');
    low.textContent = high.textContent = '—';
    lowLine.setAttribute('visibility', 'hidden');
    highLine.setAttribute('visibility', 'hidden');
    graphSummary.textContent = 'No samples yet. Start the camera to draw the graph.';
    return;
  }
  const minimum = Math.min(...history.map(reading => reading.brightness));
  const maximum = Math.max(...history.map(reading => reading.brightness));
  low.textContent = `${minimum.toFixed(1)}%`;
  high.textContent = `${maximum.toFixed(1)}%`;
  const { width, height } = graph.viewBox.baseVal;
  for (const [line, value] of [[lowLine, minimum], [highLine, maximum]] as const) {
    const y = String(height * (1 - value / 100));
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    line.setAttribute('visibility', 'visible');
  }
  trace.setAttribute('d', history.map((reading, index) => {
    const x = width * (1 - (latest.time - reading.time) / span);
    const y = height * (1 - reading.brightness / 100);
    const command = index === 0 || reading.time - history[index - 1].time > 1000 ? 'M' : 'L';
    return `${command}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' '));
  const seconds = Math.round(elapsed / 1000);
  graphSummary.textContent = `${seconds} s of history. Low ${minimum.toFixed(1)}%; high ${maximum.toFixed(1)}%. Fixed scale: 0–100%.`;
}

function clearReadings() {
  previous = null;
  brightness.textContent = range.textContent = change.textContent = '—';
}

function stop(message = history.length ? 'Camera off. Graph frozen.' : 'Camera off.') {
  cancelAnimationFrame(animation);
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
  lastSample = -Infinity;
  setMusic('stop');
  clearReadings();
  toggle.textContent = 'Start camera';
  toggle.disabled = false;
  status.textContent = message;
}

function sample(now: number) {
  if (!stream) return;
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && now - lastSample >= 200) {
    // Do not compare against stale frames after a background tab or camera pause.
    if (now - lastSample > 1000) {
      previous = null;
      setMusic('stop');
    }
    lastSample = now;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const current = new Float32Array(canvas.width * canvas.height);
    let total = 0;
    let difference = 0;
    for (let i = 0; i < current.length; i++) {
      const offset = i * 4;
      const lightness = (0.2126 * pixels[offset] + 0.7152 * pixels[offset + 1] + 0.0722 * pixels[offset + 2]) / 255 * 100;
      current[i] = lightness;
      total += lightness;
      if (previous) difference += Math.abs(current[i] - previous[i]);
    }
    // Trigger on the same precision as the displayed measurement.
    const average = Number((total / current.length).toFixed(1));
    history = history.filter(reading => now - reading.time < historyDuration);
    history.push({ time: now, brightness: average });
    const recent = history.filter(reading => now - reading.time < 10_000);
    brightness.textContent = `${average.toFixed(1)}%`;
    range.textContent = `${Math.min(...recent.map(reading => reading.brightness)).toFixed(1)} – ${Math.max(...recent.map(reading => reading.brightness)).toFixed(1)}%`;
    change.textContent = previous ? `${(difference / current.length).toFixed(1)}%` : '—';
    previous = current;
    renderGraph();
    updateMusic(average, now);
    status.textContent = 'Camera live.';
  }
  animation = requestAnimationFrame(sample);
}

reset.addEventListener('click', () => {
  history = [];
  clearReadings();
  renderGraph();
  if (!stream) status.textContent = 'Camera off.';
});

toggle.disabled = false;
toggle.addEventListener('click', async () => {
  if (stream) {
    stop();
    return;
  }
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    status.textContent = 'Camera access needs HTTPS and a supported browser. Open this page directly in Chrome or Safari.';
    return;
  }
  toggle.disabled = true;
  status.textContent = 'Allow camera access in your browser…';
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 10 } },
    });
    status.textContent = 'Starting camera…';
    for (const track of stream.getVideoTracks()) {
      track.addEventListener('ended', () => stop('Camera disconnected. Reconnect it, then start again.'));
      track.addEventListener('mute', () => {
        cancelAnimationFrame(animation);
        lastSample = -Infinity;
        setMusic('stop');
        clearReadings();
        status.textContent = 'Camera paused. Waiting for video…';
      });
      track.addEventListener('unmute', () => {
        cancelAnimationFrame(animation);
        animation = requestAnimationFrame(sample);
      });
    }
    video.srcObject = stream;
    await video.play();
    toggle.textContent = 'Stop camera';
    toggle.disabled = false;
    status.textContent = 'Waiting for the first camera frame…';
    cancelAnimationFrame(animation);
    animation = requestAnimationFrame(sample);
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    const message = name === 'NotAllowedError'
      ? 'Camera permission denied. Allow camera access in your browser and macOS Privacy & Security settings, then try again. If embedded, open this page in its own tab.'
      : name === 'NotFoundError'
        ? 'No camera found. Connect a webcam, then try again.'
        : 'Could not start the camera. Close other camera apps and try again.';
    stop(message);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) setMusic('stop');
});
window.addEventListener('pagehide', () => stop());

// node scripts/cupboard-sensor.e2e.mjs <sensor-url> [review-artifact-directory]
// Synthetic camera frames exercise the real video/canvas pipeline, not Mac hardware.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const url = process.argv[2];
assert(url, 'Supply the running cupboard-sensor URL');
const scratch = mkdtempSync(join(tmpdir(), 'outgun-sensor-'));
const artifacts = process.argv[3] ? resolve(process.argv[3]) : scratch;
mkdirSync(artifacts, { recursive: true });
const session = `sensor-${process.pid}`;
const browser = (...args) => {
  const response = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', ...args], { encoding: 'utf8' }));
  assert(response.success, JSON.stringify(response.error));
  return response.data;
};
const evaluate = code => browser('eval', code).result;
const waitFor = code => browser('wait', '--fn', code);
const readings = () => evaluate(`['brightness', 'range', 'change'].map(name => document.querySelector('#sensor-' + name).textContent)`);
const marks = () => evaluate(`['low', 'high'].map(name => document.querySelector('#sensor-' + name).textContent)`);
const flag = () => evaluate("document.querySelector('#sensor-music').textContent");
const applied = () => evaluate(`['start', 'stop'].map(name => document.querySelector('#sensor-' + name + '-label').textContent)`);
const paintGray = value => evaluate(`window.paintCamera('rgb(${value}, ${value}, ${value})')`);
const settle = () => evaluate('new Promise(resolve => setTimeout(resolve, 1200))');
const configure = (start, stop) => {
  browser('fill', '#sensor-start-threshold', String(start));
  browser('fill', '#sensor-stop-threshold', String(stop));
  browser('click', '#sensor-apply-thresholds');
};
const configureOffset = value => {
  browser('fill', '#sensor-start-offset', String(value));
  browser('click', '#sensor-apply-offset');
};
const appliedOffset = () => evaluate("document.querySelector('#sensor-offset-label').textContent");
const capture = name => {
  evaluate('window.scrollTo(0, 0)');
  evaluate('document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))');
  browser('screenshot', join(artifacts, `${name}.png`), '--full');
};

try {
  browser('open', url);
  browser('set', 'viewport', '1280', '900', '2');
  waitFor("!document.querySelector('#sensor-toggle').disabled");
  assert.deepEqual(readings(), ['—', '—', '—']);
  assert.equal(evaluate("document.querySelector('video').srcObject"), null);
  assert.deepEqual(marks(), ['—', '—']);
  assert(evaluate("document.querySelector('#sensor-reset').disabled"));
  assert.equal(flag(), 'Music: STOP');
  assert.deepEqual(applied(), ['54.0%', '52.0%']);
  assert.equal(appliedOffset(), '0.06', 'Default is 60 milliseconds, not six seconds');
  capture('sensor-off');

  // Replace only the camera boundary. All measurements come from actual video pixels.
  evaluate(`(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 240;
    const context = canvas.getContext('2d');
    window.paintCamera = (left, right = left) => {
      context.fillStyle = left; context.fillRect(0, 0, 160, 240);
      context.fillStyle = right; context.fillRect(160, 0, 160, 240);
    };
    window.paintCamera('black');
    window.cameraFixture = async () => {
      window.cameraStream = canvas.captureStream(10);
      requestAnimationFrame(() => context.drawImage(canvas, 0, 0));
      return window.cameraStream;
    };
    navigator.mediaDevices.getUserMedia = window.cameraFixture;
  })()`);
  browser('click', '#sensor-toggle');
  waitFor("document.querySelector('#sensor-change').textContent === '0.0%'");
  assert.deepEqual(readings(), ['0.0%', '0.0 – 0.0%', '0.0%']);
  assert.deepEqual(evaluate('window.cameraStream.getTracks().map(track => track.kind)'), ['video']);

  evaluate("window.paintCamera('white')");
  waitFor("document.querySelector('#sensor-brightness').textContent === '100.0%'");
  assert.equal(readings()[1], '0.0 – 100.0%');
  evaluate('new Promise(resolve => setTimeout(resolve, 10_500))');
  assert.deepEqual(readings(), ['100.0%', '100.0 – 100.0%', '0.0%']);
  assert.deepEqual(marks(), ['0.0%', '100.0%'], 'Graph retains extremes after the ten-second readout expires');
  assert(evaluate(`(() => {
    const plot = document.querySelector('#sensor-graph').viewBox.baseVal;
    const curve = document.querySelector('#sensor-trace').getBBox();
    const low = document.querySelector('#sensor-low-line');
    const high = document.querySelector('#sensor-high-line');
    return Math.abs(low.y1.baseVal.value - plot.height) < 0.01 && Math.abs(high.y1.baseVal.value) < 0.01
      && Math.abs(curve.y) < 0.01 && Math.abs(curve.height - plot.height) < 0.01
      && curve.width > 0 && curve.x >= 0 && curve.x + curve.width <= plot.width + 0.01;
  })()`), 'Curve and low/high lines use the labeled 0–100% axis and fit the time window');
  console.log('PASS: black = 0%, white = 100%, unchanged = 0%; brightness range expires after 10 seconds');

  // Same average brightness, different pixel positions: absolute mean change is not enough.
  evaluate(`(() => {
    let flipped = false;
    window.flipTimer = setInterval(() => {
      flipped = !flipped;
      window.paintCamera(flipped ? 'black' : 'white', flipped ? 'white' : 'black');
    }, 400);
  })()`);
  waitFor("document.querySelector('#sensor-brightness').textContent === '50.0%' && parseFloat(document.querySelector('#sensor-change').textContent) > 99");
  evaluate("clearInterval(window.flipTimer); window.paintCamera('black', 'white')");
  waitFor("document.querySelector('#sensor-change').textContent === '0.0%'");
  capture('sensor-live');
  console.log('PASS: swapping black/white halves keeps brightness at 50% but reports 100% frame change');

  browser('click', 'summary');
  assert(evaluate("document.querySelector('video').videoWidth > 0 && document.querySelector('details').open"));
  capture('sensor-preview');
  browser('click', 'summary');
  browser('set', 'viewport', '390', '844', '2');
  assert(evaluate('document.documentElement.scrollWidth <= innerWidth'), 'No narrow-screen overflow');
  capture('sensor-narrow');
  browser('set', 'viewport', '1280', '900', '2');

  browser('click', '#sensor-toggle');
  assert.deepEqual(readings(), ['—', '—', '—']);
  assert(evaluate("window.cameraStream.getTracks().every(track => track.readyState === 'ended')"), 'Stop releases the camera');
  assert.equal(evaluate("document.querySelector('video').srcObject"), null);
  const frozenGraph = evaluate("document.querySelector('#sensor-graph').outerHTML");
  evaluate('new Promise(resolve => setTimeout(resolve, 1200))');
  assert.equal(evaluate("document.querySelector('#sensor-graph').outerHTML"), frozenGraph, 'Stopped graph does not scroll or clear');
  assert.deepEqual(marks(), ['0.0%', '100.0%']);
  capture('sensor-frozen');
  browser('click', '#sensor-reset');
  assert.deepEqual(marks(), ['—', '—']);
  assert.equal(evaluate("document.querySelector('#sensor-trace').getTotalLength()"), 0);
  assert(evaluate("document.querySelector('#sensor-low-line').getAttribute('visibility') === 'hidden' && document.querySelector('#sensor-high-line').getAttribute('visibility') === 'hidden'"));
  capture('sensor-reset');
  evaluate("navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Test denial', 'NotAllowedError'); }");
  browser('click', '#sensor-toggle');
  waitFor("document.querySelector('#sensor-status').textContent.includes('permission denied')");
  assert(evaluate("!document.querySelector('#sensor-toggle').disabled"), 'Permission failure allows retry');
  capture('sensor-denied');
  evaluate("navigator.mediaDevices.getUserMedia = window.cameraFixture; window.paintCamera('black')");
  browser('click', '#sensor-toggle');
  waitFor("document.querySelector('#sensor-change').textContent === '0.0%'");
  assert.deepEqual(readings(), ['0.0%', '0.0 – 0.0%', '0.0%']);
  evaluate("window.paintCamera('white')");
  waitFor("document.querySelector('#sensor-high').textContent === '100.0%'");
  browser('click', '#sensor-reset');
  waitFor("document.querySelector('#sensor-change').textContent === '0.0%'");
  assert.deepEqual(marks(), ['100.0%', '100.0%'], 'Reset while live drops old marks and continues sampling');
  assert(evaluate("document.querySelector('#sensor-toggle').textContent === 'Stop camera'"));
  waitFor("document.querySelector('#sensor-music').textContent === 'Music: START'");
  browser('click', '#sensor-toggle');
  assert.equal(flag(), 'Music: STOP', 'Stopping camera always stops the trigger');

  paintGray(126); // 49.4%: the observed closed plateau.
  browser('click', '#sensor-toggle');
  waitFor("document.querySelector('#sensor-brightness').textContent === '49.4%'");
  browser('click', '#sensor-reset');
  settle();
  assert.equal(flag(), 'Music: STOP');
  capture('trigger-stop');
  paintGray(135); // 52.9%: between both thresholds.
  settle();
  assert.equal(flag(), 'Music: STOP', 'Dead band retains STOP');

  // A short crossing followed by the dead band must not latch a new state.
  const pulse = (gray, expectedBrightness) => evaluate(`(async () => {
    window.paintCamera('rgb(${gray}, ${gray}, ${gray})');
    const deadline = performance.now() + 3000;
    while (document.querySelector('#sensor-brightness').textContent !== '${expectedBrightness}') {
      if (performance.now() > deadline) throw new Error('Pulse did not reach the video');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    await new Promise(resolve => setTimeout(resolve, 250));
    window.paintCamera('rgb(135, 135, 135)');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return document.querySelector('#sensor-music').textContent;
  })()`);
  assert.equal(pulse(145, '56.9%'), 'Music: STOP', 'Short bright spike does not start');
  paintGray(145); // 56.9%: the observed open plateau.
  waitFor("document.querySelector('#sensor-music').textContent === 'Music: START'");
  capture('trigger-start');
  paintGray(135);
  settle();
  assert.equal(flag(), 'Music: START', 'Dead band retains START');
  browser('click', '#sensor-reset');
  settle();
  assert.equal(flag(), 'Music: START', 'Resetting the graph does not change the trigger');
  assert.equal(pulse(126, '49.4%'), 'Music: START', 'Short dark dip does not stop');
  paintGray(126);
  waitFor("document.querySelector('#sensor-music').textContent === 'Music: STOP'");
  console.log('PASS: 49.4% stops, 56.9% starts, dead band retains both states, short spikes/dips do not trigger');

  configure(60, 40);
  assert.deepEqual(applied(), ['60.0%', '40.0%']);
  assert.deepEqual(evaluate(`['start', 'stop'].map(name => Math.round(document.querySelector('#sensor-' + name + '-line').y1.baseVal.value))`), [80, 120], 'Applied lines match the percent axis');
  paintGray(145);
  settle();
  assert.equal(flag(), 'Music: STOP', 'New Start threshold replaces the old threshold');
  paintGray(153); // Exactly 60.0%.
  waitFor("document.querySelector('#sensor-music').textContent === 'Music: START'");
  paintGray(126);
  settle();
  assert.equal(flag(), 'Music: START', 'New Stop threshold replaces the old threshold');
  paintGray(102); // Exactly 40.0%.
  waitFor("document.querySelector('#sensor-music').textContent === 'Music: STOP'");
  capture('trigger-custom');

  for (const [start, stop] of [['', 40], [40, 40], [40, 60], [101, 40], [60, -1]]) {
    configure(start, stop);
    assert(evaluate("!document.querySelector('#sensor-threshold-error').hidden"), 'Invalid settings show an error');
    assert.deepEqual(applied(), ['60.0%', '40.0%'], 'Invalid drafts leave active thresholds unchanged');
  }
  capture('trigger-invalid');
  configure(54, 52);
  assert(evaluate("document.querySelector('#sensor-threshold-error').hidden"));
  paintGray(145);
  waitFor("document.querySelector('#sensor-music').textContent === 'Music: START'");
  browser('set', 'viewport', '390', '844', '2');
  assert(evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Threshold controls fit narrow screens');
  capture('trigger-narrow');
  browser('click', '#sensor-toggle');
  assert.equal(flag(), 'Music: STOP');

  // Tap real PCM at the browser's audio output, without replacing playback.
  // Compare it with independently decoded excerpts, not source-node calls.
  evaluate(`(() => {
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function(destination, ...args) {
      const result = connect.call(this, destination, ...args);
      if (destination instanceof AudioDestinationNode) {
        const context = destination.context;
        if (!window.audioTap) {
          window.testAudioContext = context;
          const tap = context.createScriptProcessor(4096, 2, 1);
          tap.onaudioprocess = event => {
            const samples = event.inputBuffer.getChannelData(0);
            window.outputPeak = Math.max(...samples.map(Math.abs));
            if (window.recordSound && window.recordSound.length < 16384
              && (window.recordSound.length || window.outputPeak > 0)) {
              window.recordSound.push(...samples);
            }
          };
          connect.call(tap, destination);
          window.audioTap = tap;
        }
        connect.call(this, window.audioTap);
      }
      return result;
    };
    window.realFetch = window.fetch;
    window.fetch = async () => { throw new TypeError('Test network failure'); };
  })()`);
  browser('set', 'viewport', '1280', '900', '2');
  browser('click', '#sensor-sound-toggle');
  waitFor("document.querySelector('#sensor-sound-status').textContent.startsWith('Could not')");
  capture('music-error');
  assert(evaluate("!document.querySelector('#sensor-sound-toggle').disabled"), 'Audio failure allows retry');

  // The door closes while the track is loading: finishing must not play stale START.
  paintGray(145);
  browser('click', '#sensor-toggle');
  waitFor("document.querySelector('#sensor-music').dataset.state === 'start'");
  configureOffset(1000); // Track length is not known before the first successful load.
  evaluate("window.fetch = (...args) => new Promise(resolve => { window.finishMusicLoad = () => resolve(window.realFetch(...args)); })");
  browser('click', '#sensor-sound-toggle');
  waitFor('!!window.finishMusicLoad');
  capture('music-loading');
  paintGray(126);
  waitFor("document.querySelector('#sensor-music').dataset.state === 'stop'");
  evaluate('window.finishMusicLoad(); window.fetch = window.realFetch');
  waitFor("document.querySelector('#sensor-sound-status').textContent.startsWith('Music not enabled.')");
  assert(!evaluate('!!window.audioTap'), 'An offset past the end cannot play after loading');
  configureOffset(0.06);
  browser('click', '#sensor-sound-toggle');
  waitFor("document.querySelector('#sensor-sound-status').textContent.startsWith('Ready.')");
  assert(!evaluate('!!window.audioTap'), 'Finishing a load after STOP produces no audio');
  capture('music-ready');

  for (const invalid of ['', -1, 0.001, 1000]) {
    configureOffset(invalid);
    assert(evaluate("!document.querySelector('#sensor-offset-error').hidden"), 'Invalid offset shows an error');
    assert.equal(appliedOffset(), '0.06', 'Invalid drafts leave the applied offset unchanged');
  }
  capture('offset-invalid');
  configureOffset(0);
  assert.equal(appliedOffset(), '0.00', 'Starting at the beginning is allowed');
  configureOffset(0.06);
  browser('fill', '#sensor-start-offset', '6.25'); // A draft must not change playback.

  for (const offset of [0.06, 6.25]) {
    if (offset === 6.25) configureOffset(offset);
    evaluate('window.recordSound = []');
    paintGray(145);
    waitFor('window.recordSound.length >= 16384');
    evaluate(`(async () => {
      const bytes = await (await fetch(document.querySelector('#sensor-track').href)).arrayBuffer();
      const reference = new OfflineAudioContext(2, 1, window.testAudioContext.sampleRate);
      const buffer = await reference.decodeAudioData(bytes);
      window.expectedSound = Array.from(buffer.getChannelData(0).slice(${offset} * buffer.sampleRate, ${offset} * buffer.sampleRate + 8192));
    })()`);
    const error = evaluate(`(() => {
      const actual = window.recordSound.slice(window.recordSound.findIndex(value => Math.abs(value) > 0.000001));
      const expected = window.expectedSound.slice(window.expectedSound.findIndex(value => Math.abs(value) > 0.000001));
      return actual.slice(0, 4096).reduce((sum, value, i) => sum + (value - expected[i]) ** 2, 0)
        / expected.slice(0, 4096).reduce((sum, value) => sum + value ** 2, 0);
    })()`);
    assert(error < 0.000001, `Opening must output the actual MP3 from ${offset} seconds (relative squared error ${error})`);
    console.log(`PASS: opening outputs the supplied MP3 from ${offset} seconds (PCM error ${error})`);
    if (offset === 6.25) {
      capture('music-playing');
      browser('set', 'viewport', '390', '844', '2');
      assert(evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Music controls fit narrow screens');
      capture('music-narrow');
      browser('set', 'viewport', '1280', '900', '2');
    }
    paintGray(126);
    waitFor("document.querySelector('#sensor-music').dataset.state === 'stop' && window.outputPeak === 0");
  }
  paintGray(145);
  waitFor('window.outputPeak > 0.01');
  configureOffset(1.25);
  waitFor("document.querySelector('#sensor-sound-status').textContent.startsWith('Playing from 1.25 seconds.')");
  assert.equal(flag(), 'Music: START', 'Applying an offset does not change the door signal');
  browser('click', '#sensor-sound-toggle');
  waitFor('window.outputPeak === 0');
  assert.equal(flag(), 'Music: START', 'Disabling sound does not stop calibration');
  browser('click', '#sensor-sound-toggle');
  waitFor('window.outputPeak > 0.01');
  browser('click', '#sensor-toggle');
  waitFor('window.outputPeak === 0');
  console.log('PASS: audio failure/retry, STOP during loading, silent door-close, disable/re-enable, and camera-stop silence');

  configure(60, 40);
  browser('reload');
  waitFor("!document.querySelector('#sensor-apply-thresholds').disabled");
  assert.deepEqual(applied(), ['54.0%', '52.0%'], 'Reload restores the documented defaults');
  assert.equal(flag(), 'Music: STOP');
  assert.equal(appliedOffset(), '0.06', 'Reload restores the default offset');
  assert.equal(evaluate("document.querySelector('#sensor-start-offset').value"), '0.06');
  assert.equal(evaluate("document.querySelector('#sensor-sound-toggle').textContent"), 'Enable music', 'Reload never autoplays sound');
  assert.equal(evaluate("document.querySelector('video').srcObject"), null);
  console.log('PASS: configurable lines and trigger values, inclusive thresholds, validation, reload defaults, camera-stop reset');
  assert.deepEqual(browser('errors').errors, []);
  console.log('PASS: graph bounds and low/high marks, frozen graph, stopped/live reset, preview, narrow layout, permission denial/retry, and no browser errors');
} finally {
  browser('close');
  rmSync(scratch, { recursive: true, force: true });
}

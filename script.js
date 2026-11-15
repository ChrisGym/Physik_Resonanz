/**
 * Interaktives Resonanz-Labor (12. Klasse Physik)
 * Beinhaltet:
 * 1. Echtzeit-Federpendel-Simulation + Zeitdiagramm y(t) & y_E(t)
 * 2. Interaktiver Amplitudengang A(f_E) und Phasengang Δφ(f_E)
 * 3. Bartons Fadenpendel-Experiment (5 gekoppelte Pendel)
 * 4. Optionaler WebAudio-Resonanzton
 * 5. Selbsttest-Quiz mit ausführlichen Erklärungen
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- ZUSTANDSPARAMETER DES HAUPTLABORS ---
  const state = {
    fe: 1.00,       // Erregerfrequenz in Hz
    f0: 1.00,       // Eigenfrequenz in Hz
    damping: 0.12,  // Lehrsches Dämpfungsmaß D_L
    running: true,
    time: 0,
    soundEnabled: false,
    history: []     // Zeitverlauf für y_E(t) und y(t)
  };

  // DOM-Elemente
  const sliderFe = document.getElementById('sliderFe');
  const sliderF0 = document.getElementById('sliderF0');
  const sliderDamping = document.getElementById('sliderDamping');

  const valFe = document.getElementById('valFe');
  const valF0 = document.getElementById('valF0');
  const valDamping = document.getElementById('valDamping');
  const markerF0Tick = document.getElementById('markerF0Tick');

  const metricRatio = document.getElementById('metricRatio');
  const metricAmp = document.getElementById('metricAmp');
  const metricPhase = document.getElementById('metricPhase');
  const metricFr = document.getElementById('metricFr');
  const phaseStateBadge = document.getElementById('phaseStateBadge');

  const regimeCardSub = document.getElementById('regimeCardSub');
  const regimeCardRes = document.getElementById('regimeCardRes');
  const regimeCardSuper = document.getElementById('regimeCardSuper');

  const btnPlayPause = document.getElementById('btnPlayPause');
  const btnSound = document.getElementById('btnSound');
  const presetButtons = document.querySelectorAll('.btn-preset');

  // Canvases
  const pendulumCanvas = document.getElementById('pendulumCanvas');
  const pCtx = pendulumCanvas.getContext('2d');

  const timeCanvas = document.getElementById('timeCanvas');
  const tCtx = timeCanvas.getContext('2d');

  const ampChartCanvas = document.getElementById('ampChartCanvas');
  const aCtx = ampChartCanvas.getContext('2d');

  const phaseChartCanvas = document.getElementById('phaseChartCanvas');
  const phCtx = phaseChartCanvas.getContext('2d');

  const bartonCanvas = document.getElementById('bartonCanvas');
  const bCtx = bartonCanvas.getContext('2d');

  // --- PHYSIKALISCHE BERECHNUNGSFUNKTIONEN ---
  /**
   * Berechnet den stationären Vergrößerungsfaktor V = A / y_E_hat
   */
  function calcMagnification(fe, f0, D) {
    const eta = fe / f0;
    const denom = Math.sqrt(Math.pow(1 - eta * eta, 2) + Math.pow(2 * D * eta, 2));
    return 1 / Math.max(denom, 0.0001);
  }

  /**
   * Berechnet die Phasenverschiebung Δφ im Bogenmaß [0, π]
   */
  function calcPhaseShift(fe, f0, D) {
    const eta = fe / f0;
    return Math.atan2(2 * D * eta, 1 - eta * eta);
  }

  /**
   * Berechnet die tatsächliche Resonanzfrequenz f_R des Amplitudenmaximums
   */
  function calcResonanceFreq(f0, D) {
    const inside = 1 - 2 * D * D;
    if (inside <= 0) return 0;
    return f0 * Math.sqrt(inside);
  }

  // --- WEB AUDIO SYNTHESIZER FÜR AKUSTISCHES FEEDBACK ---
  let audioCtx = null;
  let oscNode = null;
  let gainNode = null;

  function updateAudio() {
    if (!state.soundEnabled || !state.running) {
      if (gainNode && audioCtx) {
        gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
      }
      return;
    }
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
      oscNode = audioCtx.createOscillator();
      gainNode = audioCtx.createGain();
      oscNode.type = 'sine';
      gainNode.gain.value = 0;
      oscNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscNode.start();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const V = calcMagnification(state.fe, state.f0, state.damping);
    // Mappe 0.1..2.5 Hz auf hörbare 140..440 Hz
    const baseFreq = 120 + state.fe * 110;
    const volume = Math.min(0.22, 0.015 * V);
    oscNode.frequency.setTargetAtTime(baseFreq, audioCtx.currentTime, 0.04);
    gainNode.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.06);
  }

  btnSound.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    btnSound.textContent = state.soundEnabled ? '🔊 Ton an' : '🔇 Ton aus';
    btnSound.classList.toggle('sound-active', state.soundEnabled);
    updateAudio();
  });

  btnPlayPause.addEventListener('click', () => {
    state.running = !state.running;
    btnPlayPause.textContent = state.running ? '⏸ Pause' : '▶ Start';
    updateAudio();
  });

  // --- UI-SYNCHRONISATION ---
  function updateUI() {
    const { fe, f0, damping } = state;
    const eta = fe / f0;
    const V = calcMagnification(fe, f0, damping);
    const phi = calcPhaseShift(fe, f0, damping);
    const phiDeg = (phi * 180) / Math.PI;
    const fr = calcResonanceFreq(f0, damping);

    valFe.textContent = `${fe.toFixed(2)} Hz`;
    valF0.textContent = `${f0.toFixed(2)} Hz`;

    let dampLabel = 'mittel';
    if (damping <= 0.05) dampLabel = 'extrem schwach (Gefahr!)';
    else if (damping <= 0.15) dampLabel = 'schwach gedämpft';
    else if (damping >= 0.45) dampLabel = 'stark gedämpft';
    valDamping.textContent = `${damping.toFixed(2)} (${dampLabel})`;

    markerF0Tick.textContent = `▲ f₀ = ${f0.toFixed(2)} Hz`;

    metricRatio.textContent = eta.toFixed(2);
    metricAmp.textContent = `${V.toFixed(2)}×`;
    metricPhase.textContent = `${phiDeg.toFixed(1)}° (${(phi / Math.PI).toFixed(2)} π)`;
    metricFr.textContent = fr > 0 ? `${fr.toFixed(2)} Hz` : 'kein Max.';

    // Regime-Hervorhebung
    regimeCardSub.classList.remove('active-regime');
    regimeCardRes.classList.remove('active-regime');
    regimeCardSuper.classList.remove('active-regime');

    if (eta < 0.78) {
      regimeCardSub.classList.add('active-regime');
      phaseStateBadge.textContent = `Δφ = ${phiDeg.toFixed(0)}° · Fast gleichphasig (Unterkritisch)`;
      phaseStateBadge.style.color = '#38bdf8';
      phaseStateBadge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      phaseStateBadge.style.background = 'rgba(56, 189, 248, 0.12)';
    } else if (eta <= 1.22) {
      regimeCardRes.classList.add('active-regime');
      phaseStateBadge.textContent = `Δφ = ${phiDeg.toFixed(0)}° · Resonanzbereich (Optimaler Schub!)`;
      phaseStateBadge.style.color = '#fbbf24';
      phaseStateBadge.style.borderColor = 'rgba(251, 191, 36, 0.4)';
      phaseStateBadge.style.background = 'rgba(251, 191, 36, 0.15)';
    } else {
      regimeCardSuper.classList.add('active-regime');
      phaseStateBadge.textContent = `Δφ = ${phiDeg.toFixed(0)}° · Fast gegenphasig (Trägheit dominiert)`;
      phaseStateBadge.style.color = '#c084fc';
      phaseStateBadge.style.borderColor = 'rgba(192, 132, 252, 0.4)';
      phaseStateBadge.style.background = 'rgba(192, 132, 252, 0.12)';
    }

    drawAmpChart();
    drawPhaseChart();
    updateAudio();
  }

  // Event-Listener für Regler
  sliderFe.addEventListener('input', (e) => {
    state.fe = parseFloat(e.target.value);
    clearActivePresets();
    updateUI();
  });

  sliderF0.addEventListener('input', (e) => {
    state.f0 = parseFloat(e.target.value);
    clearActivePresets();
    updateUI();
  });

  sliderDamping.addEventListener('input', (e) => {
    state.damping = parseFloat(e.target.value);
    clearActivePresets();
    updateUI();
  });

  function clearActivePresets() {
    presetButtons.forEach((b) => b.classList.remove('active'));
  }

  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      clearActivePresets();
      btn.classList.add('active');
      const preset = btn.dataset.preset;
      if (preset === 'sub') {
        state.f0 = 1.00;
        state.fe = 0.30;
        state.damping = 0.12;
      } else if (preset === 'res') {
        state.f0 = 1.00;
        state.fe = 1.00;
        state.damping = 0.12;
      } else if (preset === 'super') {
        state.f0 = 1.00;
        state.fe = 2.15;
        state.damping = 0.12;
      } else if (preset === 'catastrophe') {
        state.f0 = 1.00;
        state.fe = 1.00;
        state.damping = 0.03;
      }
      sliderFe.value = state.fe;
      sliderF0.value = state.f0;
      sliderDamping.value = state.damping;
      state.history = [];
      updateUI();
    });
  });

  // Interaktives Klicken/Ziehen in den beiden Frequenz-Diagrammen
  function bindChartInteraction(canvas) {
    let dragging = false;
    const setFreqFromMouse = (evt) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const x = (evt.clientX - rect.left) * scaleX;
      const padLeft = 48;
      const padRight = 20;
      const plotW = canvas.width - padLeft - padRight;
      const ratio = Math.max(0, Math.min(1, (x - padLeft) / plotW));
      const newFe = 0.10 + ratio * (2.50 - 0.10);
      state.fe = Math.round(newFe * 100) / 100;
      sliderFe.value = state.fe;
      clearActivePresets();
      updateUI();
    };

    canvas.addEventListener('mousedown', (e) => {
      dragging = true;
      setFreqFromMouse(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (dragging) setFreqFromMouse(e);
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
    });
  }

  bindChartInteraction(ampChartCanvas);
  bindChartInteraction(phaseChartCanvas);

  // --- DIAGRAMM 1: AMPLITUDENGANG (RESONANZKURVE) ---
  function drawAmpChart() {
    const w = ampChartCanvas.width;
    const h = ampChartCanvas.height;
    aCtx.clearRect(0, 0, w, h);

    const padL = 48;
    const padR = 20;
    const padT = 18;
    const padB = 30;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const minF = 0.10;
    const maxF = 2.50;
    const maxV = 10.0; // Skala bis 10x Vergrößerung

    const fToX = (f) => padL + ((f - minF) / (maxF - minF)) * plotW;
    const vToY = (v) => padT + plotH - (Math.min(v, maxV) / maxV) * plotH;

    // Gitternetz
    aCtx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    aCtx.lineWidth = 1;
    aCtx.font = '11px Inter, sans-serif';
    aCtx.fillStyle = '#94a3b8';

    [0, 2, 4, 6, 8, 10].forEach((v) => {
      const y = vToY(v);
      aCtx.beginPath();
      aCtx.moveTo(padL, y);
      aCtx.lineTo(w - padR, y);
      aCtx.stroke();
      aCtx.fillText(`${v}×`, 14, y + 4);
    });

    [0.5, 1.0, 1.5, 2.0, 2.5].forEach((f) => {
      const x = fToX(f);
      aCtx.beginPath();
      aCtx.moveTo(x, padT);
      aCtx.lineTo(x, padT + plotH);
      aCtx.stroke();
      aCtx.fillText(`${f.toFixed(1)} Hz`, x - 16, h - 8);
    });

    // Vertikale Markierung bei Eigenfrequenz f0
    const xF0 = fToX(state.f0);
    aCtx.save();
    aCtx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    aCtx.setLineDash([5, 4]);
    aCtx.beginPath();
    aCtx.moveTo(xF0, padT);
    aCtx.lineTo(xF0, padT + plotH);
    aCtx.stroke();
    aCtx.fillStyle = '#38bdf8';
    aCtx.fillText('f₀', xF0 + 5, padT + 12);
    aCtx.restore();

    // Vergleichskurven (blass im Hintergrund für starke/schwache Dämpfung)
    [0.35, 0.06].forEach((ghostD) => {
      aCtx.beginPath();
      aCtx.strokeStyle = 'rgba(148, 163, 184, 0.20)';
      aCtx.lineWidth = 1.2;
      for (let i = 0; i <= 200; i++) {
        const f = minF + (i / 200) * (maxF - minF);
        const v = calcMagnification(f, state.f0, ghostD);
        const x = fToX(f);
        const y = vToY(v);
        if (i === 0) aCtx.moveTo(x, y);
        else aCtx.lineTo(x, y);
      }
      aCtx.stroke();
    });

    // Aktuelle Resonanzkurve mit Farbverlauf darunter
    aCtx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const f = minF + (i / 240) * (maxF - minF);
      const v = calcMagnification(f, state.f0, state.damping);
      const x = fToX(f);
      const y = vToY(v);
      if (i === 0) aCtx.moveTo(x, y);
      else aCtx.lineTo(x, y);
    }
    aCtx.strokeStyle = '#fbbf24';
    aCtx.lineWidth = 2.6;
    aCtx.stroke();

    // Fläche unter der Kurve
    aCtx.lineTo(fToX(maxF), vToY(0));
    aCtx.lineTo(fToX(minF), vToY(0));
    aCtx.closePath();
    const grad = aCtx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, 'rgba(251, 191, 36, 0.28)');
    grad.addColorStop(1, 'rgba(251, 191, 36, 0.01)');
    aCtx.fillStyle = grad;
    aCtx.fill();

    // Aktueller Betriebspunkt (f_E, V)
    const curV = calcMagnification(state.fe, state.f0, state.damping);
    const curX = fToX(state.fe);
    const curY = vToY(curV);

    aCtx.strokeStyle = 'rgba(192, 132, 252, 0.6)';
    aCtx.lineWidth = 1.5;
    aCtx.beginPath();
    aCtx.moveTo(curX, padT + plotH);
    aCtx.lineTo(curX, curY);
    aCtx.stroke();

    aCtx.beginPath();
    aCtx.arc(curX, curY, 6, 0, Math.PI * 2);
    aCtx.fillStyle = '#c084fc';
    aCtx.fill();
    aCtx.lineWidth = 2;
    aCtx.strokeStyle = '#fff';
    aCtx.stroke();

    if (curV > maxV) {
      aCtx.fillStyle = '#f87171';
      aCtx.font = 'bold 11px Inter, sans-serif';
      aCtx.fillText(`⚠️ Spitze: ${curV.toFixed(1)}×`, curX + 10, padT + 14);
    }
  }

  // --- DIAGRAMM 2: PHASENGANG Δφ(f_E) ---
  function drawPhaseChart() {
    const w = phaseChartCanvas.width;
    const h = phaseChartCanvas.height;
    phCtx.clearRect(0, 0, w, h);

    const padL = 48;
    const padR = 20;
    const padT = 14;
    const padB = 28;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const minF = 0.10;
    const maxF = 2.50;

    const fToX = (f) => padL + ((f - minF) / (maxF - minF)) * plotW;
    const degToY = (deg) => padT + plotH - (deg / 180) * plotH;

    // Gitternetz
    phCtx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    phCtx.lineWidth = 1;
    phCtx.font = '11px Inter, sans-serif';
    phCtx.fillStyle = '#94a3b8';

    [0, 90, 180].forEach((deg) => {
      const y = degToY(deg);
      phCtx.beginPath();
      phCtx.moveTo(padL, y);
      phCtx.lineTo(w - padR, y);
      phCtx.stroke();
      phCtx.fillText(`${deg}°`, 14, y + 4);
    });

    // 90° Horizontallinie besonders betonen
    const y90 = degToY(90);
    phCtx.save();
    phCtx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
    phCtx.setLineDash([4, 4]);
    phCtx.beginPath();
    phCtx.moveTo(padL, y90);
    phCtx.lineTo(w - padR, y90);
    phCtx.stroke();
    phCtx.restore();

    // Eigenfrequenz-Linie
    const xF0 = fToX(state.f0);
    phCtx.save();
    phCtx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    phCtx.setLineDash([5, 4]);
    phCtx.beginPath();
    phCtx.moveTo(xF0, padT);
    phCtx.lineTo(xF0, padT + plotH);
    phCtx.stroke();
    phCtx.restore();

    // Phasenkurve zeichnen
    phCtx.beginPath();
    for (let i = 0; i <= 220; i++) {
      const f = minF + (i / 220) * (maxF - minF);
      const phiDeg = (calcPhaseShift(f, state.f0, state.damping) * 180) / Math.PI;
      const x = fToX(f);
      const y = degToY(phiDeg);
      if (i === 0) phCtx.moveTo(x, y);
      else phCtx.lineTo(x, y);
    }
    phCtx.strokeStyle = '#38bdf8';
    phCtx.lineWidth = 2.4;
    phCtx.stroke();

    // Aktueller Punkt
    const curPhiDeg = (calcPhaseShift(state.fe, state.f0, state.damping) * 180) / Math.PI;
    const curX = fToX(state.fe);
    const curY = degToY(curPhiDeg);

    phCtx.beginPath();
    phCtx.arc(curX, curY, 6, 0, Math.PI * 2);
    phCtx.fillStyle = '#c084fc';
    phCtx.fill();
    phCtx.lineWidth = 2;
    phCtx.strokeStyle = '#fff';
    phCtx.stroke();
  }

  // --- HAUPT-ANIMATION: FEDERPENDEL & ZEITVERLAUF ---
  function drawSpring(ctx, x, yStart, yEnd, coils = 13, radius = 18) {
    const totalLen = yEnd - yStart;
    const lead = 14;
    const springLen = totalLen - 2 * lead;

    ctx.beginPath();
    ctx.moveTo(x, yStart);
    ctx.lineTo(x, yStart + lead);

    for (let i = 0; i <= coils * 2; i++) {
      const py = yStart + lead + (i / (coils * 2)) * springLen;
      let px = x;
      if (i > 0 && i < coils * 2) {
        px = x + (i % 2 === 0 ? -radius : radius);
      }
      ctx.lineTo(px, py);
    }

    ctx.lineTo(x, yEnd);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function drawArrow(ctx, x1, y1, x2, y2, color, label) {
    const dy = y2 - y1;
    if (Math.abs(dy) < 4) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const dir = Math.sign(dy);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 5, y2 - dir * 8);
    ctx.lineTo(x2 + 5, y2 - dir * 8);
    ctx.closePath();
    ctx.fill();

    if (label) {
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(label, x2 + 8, y2);
    }
    ctx.restore();
  }

  function renderPendulumAndTime(dt) {
    if (state.running) {
      state.time += dt;
    }

    const { fe, f0, damping, time } = state;
    const omegaE = 2 * Math.PI * fe;
    const V = calcMagnification(fe, f0, damping);
    const phi = calcPhaseShift(fe, f0, damping);

    // Erreger-Amplitude in Pixeln
    const driverAmpPx = 18;
    // Oszillator-Amplitude in Pixeln (begrenzt für das Gehäuse, mit Warnanzeige bei Anschlag)
    const rawMassAmpPx = driverAmpPx * V;
    const maxSafePx = 115;
    const isClipping = rawMassAmpPx > maxSafePx;
    const massAmpPx = Math.min(rawMassAmpPx, maxSafePx);

    // Momentane Auslenkungen (nach unten negativ, nach oben positiv im mathematischen Sinn)
    const yDriver = driverAmpPx * Math.sin(omegaE * time);
    const yMass = massAmpPx * Math.sin(omegaE * time - phi);
    const vMass = massAmpPx * omegaE * Math.cos(omegaE * time - phi);

    if (state.running) {
      state.history.push({ yDriver, yMass });
      if (state.history.length > 260) state.history.shift();
    }

    // 1. PENDEL-CANVAS ZEICHNEN
    const w = pendulumCanvas.width;
    const h = pendulumCanvas.height;
    pCtx.clearRect(0, 0, w, h);

    const centerX = w * 0.44;
    const driverBaseY = 62;
    const eqMassY = 235; // Gleichgewichtslage der Masse

    // Ruhelage-Hilfslinien
    pCtx.save();
    pCtx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    pCtx.setLineDash([5, 5]);
    pCtx.beginPath();
    pCtx.moveTo(45, eqMassY);
    pCtx.lineTo(w - 30, eqMassY);
    pCtx.stroke();
    pCtx.fillStyle = '#94a3b8';
    pCtx.font = '11px Inter, sans-serif';
    pCtx.fillText('Ruhelage y = 0', 52, eqMassY - 6);

    // Amplituden-Hüllkurve (+/- A)
    pCtx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    pCtx.beginPath();
    pCtx.moveTo(centerX - 65, eqMassY - massAmpPx);
    pCtx.lineTo(centerX + 95, eqMassY - massAmpPx);
    pCtx.moveTo(centerX - 65, eqMassY + massAmpPx);
    pCtx.lineTo(centerX + 95, eqMassY + massAmpPx);
    pCtx.stroke();
    pCtx.restore();

    // Exzenter-Scheibe oben (Rotierender Phasen-Zeiger des Erregers)
    const wheelX = centerX - 105;
    const wheelY = driverBaseY;
    pCtx.beginPath();
    pCtx.arc(wheelX, wheelY, driverAmpPx, 0, Math.PI * 2);
    pCtx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
    pCtx.lineWidth = 2;
    pCtx.stroke();

    const pinX = wheelX + driverAmpPx * Math.cos(omegaE * time);
    const pinY = wheelY - yDriver;

    // Verbindungsstange vom Exzenter zum Aufhängepunkt
    pCtx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
    pCtx.beginPath();
    pCtx.moveTo(pinX, pinY);
    pCtx.lineTo(centerX, driverBaseY - yDriver);
    pCtx.stroke();

    pCtx.beginPath();
    pCtx.arc(pinX, pinY, 4.5, 0, Math.PI * 2);
    pCtx.fillStyle = '#c084fc';
    pCtx.fill();

    // Erreger-Plattform
    const currentDriverY = driverBaseY - yDriver;
    pCtx.fillStyle = '#c084fc';
    pCtx.beginPath();
    pCtx.roundRect(centerX - 38, currentDriverY - 7, 76, 14, 5);
    pCtx.fill();

    // Feder zwischen Erreger und Kugel
    const currentMassY = eqMassY - yMass;
    const massRadius = 26;
    drawSpring(pCtx, centerX, currentDriverY + 7, currentMassY - massRadius, 12, 16);

    // Dämpfungs-Zylinder (optional angedeutet bei höherer Dämpfung)
    if (state.damping > 0.08) {
      pCtx.fillStyle = `rgba(251, 191, 36, ${Math.min(0.35, state.damping * 0.5)})`;
      pCtx.fillRect(centerX - 48, eqMassY - 95, 96, 190);
      pCtx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
      pCtx.strokeRect(centerX - 48, eqMassY - 95, 96, 190);
    }

    // Massekugel
    const massGrad = pCtx.createRadialGradient(
      centerX - 8,
      currentMassY - 8,
      4,
      centerX,
      currentMassY,
      massRadius
    );
    if (isClipping) {
      massGrad.addColorStop(0, '#fca5a5');
      massGrad.addColorStop(1, '#ef4444');
    } else {
      massGrad.addColorStop(0, '#bae6fd');
      massGrad.addColorStop(1, '#0284c7');
    }

    pCtx.beginPath();
    pCtx.arc(centerX, currentMassY, massRadius, 0, Math.PI * 2);
    pCtx.fillStyle = massGrad;
    pCtx.fill();
    pCtx.lineWidth = 2;
    pCtx.strokeStyle = '#e0f2fe';
    pCtx.stroke();

    pCtx.fillStyle = '#0f172a';
    pCtx.font = 'bold 12px Inter, sans-serif';
    pCtx.fillText('m', centerX - 5, currentMassY + 4);

    // Geschwindigkeitsvektor v(t) an der Masse
    drawArrow(
      pCtx,
      centerX + 42,
      currentMassY,
      centerX + 42,
      currentMassY - vMass * 0.14,
      '#34d399',
      'v(t)'
    );

    // Phasen-Zeigerdiagramm oben rechts im Pendel-Canvas
    const phasorX = w - 72;
    const phasorY = 75;
    const phasorR = 36;
    pCtx.save();
    pCtx.beginPath();
    pCtx.arc(phasorX, phasorY, phasorR, 0, Math.PI * 2);
    pCtx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    pCtx.lineWidth = 1.5;
    pCtx.stroke();

    // Erregerzeiger (Lila)
    const angE = omegaE * time;
    const angM = omegaE * time - phi;
    pCtx.strokeStyle = '#c084fc';
    pCtx.lineWidth = 2.5;
    pCtx.beginPath();
    pCtx.moveTo(phasorX, phasorY);
    pCtx.lineTo(phasorX + phasorR * Math.cos(angE), phasorY - phasorR * Math.sin(angE));
    pCtx.stroke();

    // Massezeiger (Blau)
    pCtx.strokeStyle = '#38bdf8';
    pCtx.lineWidth = 2.5;
    pCtx.beginPath();
    pCtx.moveTo(phasorX, phasorY);
    pCtx.lineTo(phasorX + phasorR * Math.cos(angM), phasorY - phasorR * Math.sin(angM));
    pCtx.stroke();

    pCtx.fillStyle = '#94a3b8';
    pCtx.font = '10px Inter, sans-serif';
    pCtx.fillText('Zeigerbild Δφ', phasorX - 32, phasorY + phasorR + 14);
    pCtx.restore();

    // Warnhinweis bei Resonanzkatastrophe
    if (isClipping) {
      pCtx.fillStyle = 'rgba(239, 68, 68, 0.92)';
      pCtx.beginPath();
      pCtx.roundRect(w / 2 - 135, 12, 270, 28, 6);
      pCtx.fill();
      pCtx.fillStyle = '#fff';
      pCtx.font = 'bold 12px Inter, sans-serif';
      pCtx.fillText('⚠️ RESONANZKATASTROPHE (Anschlag!)', w / 2 - 118, 30);
    }

    // 2. ZEITDIAGRAMM y(t) & y_E(t) ZEICHNEN
    const tw = timeCanvas.width;
    const th = timeCanvas.height;
    tCtx.clearRect(0, 0, tw, th);

    const midY = th / 2;
    tCtx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    tCtx.beginPath();
    tCtx.moveTo(0, midY);
    tCtx.lineTo(tw, midY);
    tCtx.stroke();

    if (state.history.length > 1) {
      // Oszillator y(t) (Blau)
      tCtx.beginPath();
      state.history.forEach((pt, idx) => {
        const x = (idx / 260) * tw;
        const y = midY - pt.yMass * 0.45;
        if (idx === 0) tCtx.moveTo(x, y);
        else tCtx.lineTo(x, y);
      });
      tCtx.strokeStyle = '#38bdf8';
      tCtx.lineWidth = 2.2;
      tCtx.stroke();

      // Erreger y_E(t) (Lila, leicht hochskaliert für bessere Sichtbarkeit)
      tCtx.beginPath();
      state.history.forEach((pt, idx) => {
        const x = (idx / 260) * tw;
        const y = midY - pt.yDriver * 1.1;
        if (idx === 0) tCtx.moveTo(x, y);
        else tCtx.lineTo(x, y);
      });
      tCtx.strokeStyle = '#c084fc';
      tCtx.lineWidth = 1.8;
      tCtx.stroke();
    }
  }

  // --- BARTONS PENDEL SIMULATION ---
  const bartonPendulums = [
    { f0: 1.35, lenPx: 85, label: 'P1 (1.35 Hz)' },
    { f0: 1.12, lenPx: 120, label: 'P2 (1.12 Hz)' },
    { f0: 0.95, lenPx: 158, label: 'P3 (0.95 Hz)' },
    { f0: 0.82, lenPx: 195, label: 'P4 (0.82 Hz)' },
    { f0: 0.72, lenPx: 232, label: 'P5 (0.72 Hz)' }
  ];
  let bartonDriverFreq = 0.95;

  const bartonButtons = document.querySelectorAll('.btn-barton');
  bartonButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      bartonButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      bartonDriverFreq = parseFloat(btn.dataset.freq);
    });
  });

  function renderBarton(time) {
    const w = bartonCanvas.width;
    const h = bartonCanvas.height;
    bCtx.clearRect(0, 0, w, h);

    const barY = 34;
    // Tragseil zeichnen
    bCtx.strokeStyle = '#64748b';
    bCtx.lineWidth = 3;
    bCtx.beginPath();
    bCtx.moveTo(30, barY);
    bCtx.lineTo(w - 30, barY);
    bCtx.stroke();

    const omegaE = 2 * Math.PI * bartonDriverFreq;
    const dampingBarton = 0.06;

    bartonPendulums.forEach((p, idx) => {
      const anchorX = 72 + idx * 94;
      const V = calcMagnification(bartonDriverFreq, p.f0, dampingBarton);
      const phi = calcPhaseShift(bartonDriverFreq, p.f0, dampingBarton);

      // Maximaler Ausschlagwinkel im Bild
      const maxAngleRad = Math.min(0.45, 0.045 * V);
      const angle = maxAngleRad * Math.sin(omegaE * time - phi);

      const bobX = anchorX + p.lenPx * Math.sin(angle);
      const bobY = barY + p.lenPx * Math.cos(angle);

      const isResonant = Math.abs(bartonDriverFreq - p.f0) < 0.03;

      // Faden
      bCtx.strokeStyle = isResonant ? '#fbbf24' : '#94a3b8';
      bCtx.lineWidth = isResonant ? 2.4 : 1.5;
      bCtx.beginPath();
      bCtx.moveTo(anchorX, barY);
      bCtx.lineTo(bobX, bobY);
      bCtx.stroke();

      // Pendelkugel
      bCtx.beginPath();
      bCtx.arc(bobX, bobY, isResonant ? 16 : 12, 0, Math.PI * 2);
      bCtx.fillStyle = isResonant ? '#fbbf24' : '#38bdf8';
      bCtx.fill();
      bCtx.lineWidth = 2;
      bCtx.strokeStyle = '#fff';
      bCtx.stroke();

      // Beschriftung
      bCtx.fillStyle = isResonant ? '#fbbf24' : '#94a3b8';
      bCtx.font = isResonant ? 'bold 11px Inter, sans-serif' : '11px Inter, sans-serif';
      bCtx.fillText(p.label, anchorX - 32, barY - 10);
      if (isResonant) {
        bCtx.fillText('⚡ RESONANZ!', anchorX - 36, h - 10);
      }
    });
  }

  // --- SELBSTTEST-QUIZ (4 FRAGEN FÜR DIE 12. KLASSE) ---
  const quizQuestions = [
    {
      q: '1. Welche Phasenverschiebung Δφ besteht zwischen Erreger und Oszillator exakt bei f_E = f₀?',
      options: [
        'Δφ = 0° (Erreger und Oszillator schwingen exakt im Gleichtakt)',
        'Δφ = 90° bzw. π/2 (der Erreger eilt dem Oszillator um eine Viertelperiode voraus)',
        'Δφ = 180° bzw. π (Erreger und Oszillator schwingen gegenphasig)'
      ],
      correct: 1,
      explanation:
        'Richtig! Bei f_E = f₀ eilt der Erreger um 90° (π/2) voraus. Dadurch wirkt die antreibende Kraft immer genau in Richtung der momentanen Geschwindigkeit des Oszillators – die Energiezufuhr ist maximal.'
    },
    {
      q: '2. Was passiert mit der Resonanzkurve, wenn die Dämpfung b des schwingfähigen Systems verringert wird?',
      options: [
        'Das Resonanzmaximum wird höher und schärfer; bei b → 0 droht die Resonanzkatastrophe.',
        'Das Resonanzmaximum wird flacher und breiter.',
        'Die Eigenfrequenz f₀ verdoppelt sich automatisch.'
      ],
      correct: 0,
      explanation:
        'Genau! Je kleiner die Dämpfung, desto weniger Energie geht pro Periode durch Reibung verloren und desto steiler und höher wächst die Resonanzspitze an.'
    },
    {
      q: '3. Eine Waschmaschine rüttelt beim Hochlaufen kurzzeitig stark, läuft aber beim schnellen Schleudern (f_E ≫ f₀) wieder ruhig. Warum?',
      options: [
        'Weil bei hoher Drehzahl keine Fliehkraft mehr wirkt.',
        'Weil die Trommel oberhalb der Resonanzfrequenz wegen ihrer Massenträgheit den schnellen Wechseln kaum noch folgen kann (A → 0, Δφ ≈ 180°).',
        'Weil die Federn bei hoher Frequenz starr werden.'
      ],
      correct: 1,
      explanation:
        'Korrekt! Im überkritischen Bereich (f_E ≫ f₀) dominiert die Massenträgheit: Die Amplitude A sinkt gegen null und die Trommel schwingt fast gegenphasig mit sehr kleiner Auslenkung.'
    },
    {
      q: '4. Mit welcher Frequenz schwingt ein gedämpfter Oszillator nach Abschluss des Einschwingvorgangs?',
      options: [
        'Immer mit seiner eigenen Eigenfrequenz f₀.',
        'Immer mit der aufgezwungenen Erregerfrequenz f_E.',
        'Mit dem Mittelwert aus f₀ und f_E.'
      ],
      correct: 1,
      explanation:
        'Richtig! Nach dem Abklingen des Einschwingvorgangs schwingt ein erzwungener Oszillator stets exakt mit der Erregerfrequenz f_E.'
    }
  ];

  const quizContainer = document.getElementById('quizContainer');
  const btnResetQuiz = document.getElementById('btnResetQuiz');

  function setQuizText(element, text) {
    element.replaceChildren();
    text.split('f_E').forEach((part, index) => {
      if (index > 0) {
        const formula = document.createElement('span');
        formula.className = 'math';
        formula.append('f');

        const subscript = document.createElement('sub');
        subscript.textContent = 'E';
        formula.appendChild(subscript);
        element.appendChild(formula);
      }

      element.appendChild(document.createTextNode(part));
    });
  }

  function renderQuiz() {
    quizContainer.innerHTML = '';
    quizQuestions.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'quiz-card';

      const title = document.createElement('div');
      title.className = 'quiz-q';
      setQuizText(title, item.q);
      card.appendChild(title);

      const optsWrap = document.createElement('div');
      optsWrap.className = 'quiz-options';

      const feedback = document.createElement('div');
      feedback.className = 'quiz-feedback';

      item.options.forEach((optText, optIndex) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        setQuizText(btn, optText);

        btn.addEventListener('click', () => {
          const allBtns = optsWrap.querySelectorAll('.quiz-option');
          allBtns.forEach((b) => (b.disabled = true));

          if (optIndex === item.correct) {
            btn.classList.add('correct');
            setQuizText(feedback, '✅ ' + item.explanation);
          } else {
            btn.classList.add('wrong');
            allBtns[item.correct].classList.add('correct');
            setQuizText(feedback, '❌ Nicht ganz. ' + item.explanation);
          }
          feedback.classList.add('visible');
        });

        optsWrap.appendChild(btn);
      });

      card.appendChild(optsWrap);
      card.appendChild(feedback);
      quizContainer.appendChild(card);
    });
  }

  btnResetQuiz.addEventListener('click', renderQuiz);

  // --- ANIMATIONSSCHLEIFE STARTEN ---
  let lastTimestamp = performance.now();
  function animate(now) {
    const dt = Math.min(0.05, (now - lastTimestamp) / 1000);
    lastTimestamp = now;

    renderPendulumAndTime(dt);
    renderBarton(state.time);

    requestAnimationFrame(animate);
  }

  updateUI();
  renderQuiz();
  requestAnimationFrame(animate);
});

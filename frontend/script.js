'use strict';
const API_URL = 'http://127.0.0.1:5000/predict';
const TOAST_DURATION = 4500; 
const form           = document.getElementById('predict-form');
const predictBtn     = document.getElementById('predict-btn');
const btnText        = document.getElementById('btn-text');
const btnIcon        = document.getElementById('btn-icon');
const btnSpinner     = document.getElementById('btn-spinner');

const locationCard   = document.getElementById('location-card');
const locationCoords = document.getElementById('location-coords');
const locationStatus = document.getElementById('location-status');

const resultSection  = document.getElementById('result-section');
const resultCard     = document.getElementById('result-card');
const resultIconWrap = document.getElementById('result-icon-wrap');
const resultIconEl   = document.getElementById('result-icon');
const resultStatus   = document.getElementById('result-status');
const circleFill     = document.getElementById('circle-fill');
const circlePct      = document.getElementById('circle-pct');
const weatherValue   = document.getElementById('weather-value');
const probabilityValue = document.getElementById('probability-value');

const toastEl        = document.getElementById('toast');
const toastMessage   = document.getElementById('toast-message');
let userLatitude  = null;
let userLongitude = null;
let toastTimeout  = null;
function initGeolocation() {
  if (!('geolocation' in navigator)) {
    setLocationDenied('Geolocation not supported by this browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLatitude  = position.coords.latitude;
      userLongitude = position.coords.longitude;

      const lat = userLatitude.toFixed(5);
      const lon = userLongitude.toFixed(5);
      const label = locationCard.querySelector('.location-label');
      label.textContent = 'Current Location Detected';
      locationCoords.textContent = `Lat: ${lat}  ·  Lon: ${lon}`;

      locationCard.classList.remove('location-detecting');
      locationCard.classList.add('location-ok');
      const iconEl = locationCard.querySelector('.location-icon');
      iconEl.setAttribute('data-lucide', 'map-pin-check');
      lucide.createIcons();
      locationStatus.innerHTML = '<div style="width:10px;height:10px;border-radius:50%;background:var(--success);box-shadow:0 0 8px var(--success);"></div>';
    },
    (error) => {
      setLocationDenied('Location access denied. Weather data cannot be retrieved.');
    },
    { timeout: 10000, enableHighAccuracy: false }
  );
}

function setLocationDenied(message) {
  const label = locationCard.querySelector('.location-label');
  label.textContent = 'Location Access Denied';
  locationCoords.textContent = message;

  locationCard.classList.remove('location-detecting');
  locationCard.classList.add('location-denied');

  const iconEl = locationCard.querySelector('.location-icon');
  iconEl.setAttribute('data-lucide', 'map-pin-off');
  lucide.createIcons();

  locationStatus.innerHTML = '<div style="width:10px;height:10px;border-radius:50%;background:var(--danger);box-shadow:0 0 8px var(--danger);"></div>';
}
function initRangeBars() {
  const oilInput   = document.getElementById('oil-quality');
  const oilBar     = document.getElementById('oil-quality-bar');
  const brakeInput = document.getElementById('brake-wear');
  const brakeBar   = document.getElementById('brake-wear-bar');

  function updateBar(input, bar, invert = false) {
    const val = Math.min(100, Math.max(0, Number(input.value) || 0));
    bar.style.width = val + '%';

    if (invert) {
      const ratio = val / 100;
      if (ratio > 0.7) bar.style.background = 'var(--danger)';
      else if (ratio > 0.4) bar.style.background = 'var(--accent)';
      else bar.style.background = 'var(--success)';
    } else {
      // High oil quality = good (green)
      const ratio = val / 100;
      if (ratio < 0.3) bar.style.background = 'var(--danger)';
      else if (ratio < 0.6) bar.style.background = 'var(--accent)';
      else bar.style.background = 'var(--success)';
    }
  }

  oilInput.addEventListener('input', () => updateBar(oilInput, oilBar, false));
  brakeInput.addEventListener('input', () => updateBar(brakeInput, brakeBar, true));
}

/* ============================================================
   Toast Notification
   ============================================================ */
function showToast(message) {
  clearTimeout(toastTimeout);
  toastMessage.textContent = message;
  toastEl.classList.add('show');

  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('show');
  }, TOAST_DURATION);
}

/* ============================================================
   Button Loading State
   ============================================================ */
function setLoading(isLoading) {
  if (isLoading) {
    predictBtn.disabled = true;
    btnText.textContent = 'Analyzing Vehicle…';
    btnIcon.classList.add('hidden');
    btnSpinner.classList.remove('hidden');
  } else {
    predictBtn.disabled = false;
    btnText.textContent = 'Predict Maintenance';
    btnIcon.classList.remove('hidden');
    btnSpinner.classList.add('hidden');
  }
}

/* ============================================================
   Collect Form Data
   ============================================================ */
function collectFormData() {
  const get = (id) => document.getElementById(id);

  return {
    Make_and_Model:       get('make-model').value,
    Vehicle_Type:         get('vehicle-type').value,
    Vehicle_Age:          Number(get('vehicle-age').value),
    Usage_Hours:          Number(get('usage-hours').value),
    Load_Capacity:        Number(get('load-capacity').value),
    Actual_Load:          Number(get('actual-load').value),
    Engine_Temperature:   Number(get('engine-temp').value),
    Fuel_Consumption:     Number(get('fuel-consumption').value),
    Oil_Quality:          Number(get('oil-quality').value),
    Brake_Wear_Percentage: Number(get('brake-wear').value),
    Tire_Pressure:        Number(get('tire-pressure').value),
    Vibration_Levels:     Number(get('vibration').value),
    Road_Conditions:      get('road-conditions').value,
    Average_Speed:        Number(get('avg-speed').value),
    latitude:             userLatitude,
    longitude:            userLongitude,
  };
}

/* ============================================================
   Validate Form Fields
   ============================================================ */
function validateForm(data) {
  const requiredStrings = ['Make_and_Model', 'Vehicle_Type', 'Road_Conditions'];
  for (const key of requiredStrings) {
    if (!data[key]) return `Please select a value for "${key.replace(/_/g,' ')}".`;
  }

  const requiredNumbers = [
    'Vehicle_Age','Usage_Hours','Load_Capacity','Actual_Load',
    'Engine_Temperature','Fuel_Consumption','Oil_Quality',
    'Brake_Wear_Percentage','Tire_Pressure','Vibration_Levels','Average_Speed'
  ];
  for (const key of requiredNumbers) {
    if (data[key] === '' || isNaN(data[key])) {
      return `Please enter a valid number for "${key.replace(/_/g,' ')}".`;
    }
  }

  if (data.Oil_Quality < 0 || data.Oil_Quality > 100)
    return 'Oil Quality must be between 0 and 100.';
  if (data.Brake_Wear_Percentage < 0 || data.Brake_Wear_Percentage > 100)
    return 'Brake Wear Percentage must be between 0 and 100.';

  return null; // valid
}

/* ============================================================
   AI Insights via Puter.js
   ============================================================ */

/**
 * Build a detailed prompt from the vehicle payload + Flask response
 * so the AI has the full picture to generate meaningful insights.
 */
function buildInsightsPrompt(payload, flaskResult) {
  const status = flaskResult.prediction === 1 ? 'MAINTENANCE REQUIRED' : 'NO MAINTENANCE REQUIRED';
  const prob   = Math.round(flaskResult.maintenance_probability ?? 0);
  const weather = flaskResult.weather_detected ?? 'Unknown';

  return `
You are an expert fleet maintenance engineer analysing a heavy vehicle health report.

PREDICTION RESULT: ${status}
Maintenance Probability: ${prob}%
Weather at location: ${weather}

VEHICLE DATA:
- Make & Model: ${payload.Make_and_Model}
- Vehicle Type: ${payload.Vehicle_Type}
- Vehicle Age: ${payload.Vehicle_Age} years
- Usage Hours: ${payload.Usage_Hours} hrs
- Load Capacity: ${payload.Load_Capacity} tons | Actual Load: ${payload.Actual_Load} tons (utilisation: ${((payload.Actual_Load / payload.Load_Capacity) * 100).toFixed(1)}%)

SENSOR READINGS:
- Engine Temperature: ${payload.Engine_Temperature}°C
- Fuel Consumption: ${payload.Fuel_Consumption} L/100km
- Oil Quality: ${payload.Oil_Quality}/100
- Brake Wear: ${payload.Brake_Wear_Percentage}%
- Tire Pressure: ${payload.Tire_Pressure} PSI
- Vibration Levels: ${payload.Vibration_Levels} mm/s
- Average Speed: ${payload.Average_Speed} km/h
- Road Conditions: ${payload.Road_Conditions}

INSTRUCTIONS:
Generate exactly 5 concise maintenance insights based on the data above.
Each insight must directly reference a specific sensor value or vehicle stat from the data.
Format your response as a valid JSON array — nothing else, no markdown, no explanation outside the array.
Each element must have:
  - "severity": one of "critical", "warning", "ok", "info"
  - "icon": a single Lucide icon name (e.g. "thermometer", "droplets", "gauge", "zap", "wind", "wrench", "shield-alert", "activity", "fuel", "circle-check")
  - "text": a 1–2 sentence insight. Bold the key metric using **value** markdown syntax.

Return ONLY the JSON array.
`.trim();
}

/**
 * Parse the raw AI text into structured insight objects.
 * Handles cases where the model wraps JSON in markdown fences.
 */
function parseInsights(rawText) {
  let cleaned = rawText.trim();
  // Strip ```json ... ``` or ``` ... ``` fences if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned);
}

/**
 * Render the insights array into the DOM.
 */
function renderInsights(insights, isMaintenance) {
  const content = document.getElementById('insights-content');
  content.innerHTML = '';

  // Summary badge
  const summaryDiv = document.createElement('div');
  summaryDiv.className = `insights-summary ${isMaintenance ? 'insights-summary--danger' : 'insights-summary--success'}`;
  summaryDiv.innerHTML = `
    <i data-lucide="${isMaintenance ? 'alert-triangle' : 'shield-check'}" class="insights-summary-icon"></i>
    <span>${isMaintenance
      ? 'Critical issues detected — immediate attention recommended'
      : 'Vehicle is in healthy operating condition'
    }</span>`;
  content.appendChild(summaryDiv);

  // Individual insight items
  insights.forEach(item => {
    const div = document.createElement('div');
    div.className = `insight-item insight-item--${item.severity ?? 'info'}`;

    // Convert **bold** markdown to <strong> tags
    const formatted = (item.text ?? '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    div.innerHTML = `
      <i data-lucide="${item.icon ?? 'info'}" class="insight-bullet-icon"></i>
      <p class="insight-text">${formatted}</p>`;
    content.appendChild(div);
  });

  // Refresh Lucide icons for newly created elements
  lucide.createIcons();
}

/**
 * Main entry point — called after Flask responds.
 * Shows skeleton, calls Puter AI, then renders or shows error.
 */
async function generateInsights(payload, flaskResult) {
  const panel   = document.getElementById('insights-panel');
  const loading = document.getElementById('insights-loading');
  const content = document.getElementById('insights-content');
  const errorEl = document.getElementById('insights-error');
  const errorMsg = document.getElementById('insights-error-msg');

  // Reset state
  loading.classList.remove('hidden');
  content.classList.add('hidden');
  errorEl.classList.add('hidden');
  content.innerHTML = '';

  const prompt = buildInsightsPrompt(payload, flaskResult);

  try {
    const response = await puter.ai.chat(prompt, {
      model: 'gpt-4o-mini',
    });

    // Puter returns a message object — extract text
    const rawText = typeof response === 'string'
      ? response
      : response?.message?.content ?? response?.content ?? String(response);

    const insights = parseInsights(rawText);

    loading.classList.add('hidden');
    renderInsights(insights, flaskResult.prediction === 1);
    content.classList.remove('hidden');

  } catch (err) {
    loading.classList.add('hidden');
    errorMsg.textContent = `Could not generate insights: ${err.message ?? 'Unknown error'}`;
    errorEl.classList.remove('hidden');
    lucide.createIcons();
  }
}

/* ============================================================
   Render Result
   ============================================================ */
function renderResult(data) {
  // --- Map exact Flask response fields ---
  // Backend returns: { prediction, maintenance_probability, weather_detected, result }
  const prediction  = data.prediction;                          // 0 or 1
  const pct         = Math.round(data.maintenance_probability ?? 0); // already 0–100
  const weather     = data.weather_detected ?? 'N/A';           // e.g. "Rain", "Clear"
  const resultLabel = data.result ?? (prediction === 1 ? 'Maintenance Required' : 'No Maintenance');

  const isMaintenance = prediction === 1;

  // Update card classes
  resultCard.classList.remove('result-card--danger', 'result-card--success');
  resultCard.classList.add(isMaintenance ? 'result-card--danger' : 'result-card--success');

  // Icon & status text
  resultIconWrap.classList.toggle('is-danger', isMaintenance);
  resultIconEl.setAttribute('data-lucide', isMaintenance ? 'alert-triangle' : 'check-circle');
  resultIconEl.classList.toggle('is-danger', isMaintenance);
  resultStatus.textContent = resultLabel;
  resultStatus.classList.toggle('is-danger', isMaintenance);

  // Circular progress  (circumference = 2π × r50 = 314.16)
  const circumference = 2 * Math.PI * 50;
  const offset = circumference - (pct / 100) * circumference;
  circleFill.style.strokeDashoffset = offset;
  circleFill.classList.toggle('is-danger', isMaintenance);
  circlePct.textContent = pct + '%';

  // Info panel values
  weatherValue.textContent     = weather;
  probabilityValue.textContent = pct + '%';

  // Re-render lucide icons after data-lucide attribute change
  lucide.createIcons();

  // Reveal section and scroll into view
  resultSection.classList.remove('hidden');
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ============================================================
   API Call
   ============================================================ */
async function predictMaintenance(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMsg = `Server error: ${response.status} ${response.statusText}`;
    try {
      const errData = await response.json();
      if (errData.error || errData.message) {
        errorMsg = errData.error || errData.message;
      }
    } catch (_) { /* ignore parse errors */ }
    throw new Error(errorMsg);
  }

  return response.json();
}

/* ============================================================
   Form Submit Handler
   ============================================================ */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = collectFormData();
  const validationError = validateForm(payload);

  if (validationError) {
    showToast(validationError);
    return;
  }

  setLoading(true);

  try {
    const result = await predictMaintenance(payload);
    renderResult(result);
    // Kick off AI insights in parallel — non-blocking
    generateInsights(payload, result);
  } catch (err) {
    showToast(err.message || 'Prediction failed. Check that the Flask server is running.');
  } finally {
    setLoading(false);
  }
});

/* ============================================================
   Theme Toggle
   ============================================================ */
const THEME_KEY = 'fleet-theme';
const htmlEl    = document.documentElement;

/**
 * Apply a theme ('dark' | 'light') to the <html> element,
 * persist to localStorage, and keep the toggle button icon in sync.
 */
function applyTheme(theme) {
  htmlEl.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

/**
 * Read the saved preference, falling back to the OS preference
 * and finally to 'dark' if neither is available.
 */
function resolveInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  // Respect OS preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;

  // Set initial theme without transition flash
  applyTheme(resolveInitialTheme());

  toggleBtn.addEventListener('click', () => {
    const current = htmlEl.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  // Also update when OS preference changes (e.g. system auto-switch)
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    // Only follow OS if user hasn't manually set a preference
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(e.matches ? 'light' : 'dark');
    }
  });
}

/* ============================================================
   Boot
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved / OS theme before paint
  initThemeToggle();

  // Initialize Lucide icons (must run after DOM is ready)
  lucide.createIcons();

  // Request geolocation
  initGeolocation();
  initRangeBars();
});
/**
 * EcoStat — UI Interactions
 * Search, compare, ticker, modal, global indicators
 */

// ═══ SEARCH & GEOCODE ═══

const searchInput = document.getElementById('searchInput');
const sugBox = document.getElementById('suggestions');

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  sugBox.style.display = 'none';
  if (searchInput.value.length < 2) return;

  debounceTimer = setTimeout(async () => {
    try {
      const r = await geocode(searchInput.value);
      if (!r.length) { showError('CITY_NOT_FOUND', searchInput.value); return; }
      sugBox.innerHTML = r.map((s, i) =>
        `<div class="sug-item" onclick="selectCity(${i})" data-lat="${s.lat}" data-lon="${s.lon}" data-name="${s.display_name}">` +
        `<strong>${s.display_name.split(',')[0]}</strong><br><small>${s.display_name}</small></div>`
      ).join('');
      sugBox.style.display = 'block';
      window._sugResults = r;
    } catch (e) { showError('GEO_FAIL'); }
  }, 300);
});

async function selectCity(i) {
  sugBox.style.display = 'none';
  const s = window._sugResults[i];
  const name = s.display_name.split(',')[0].trim();
  searchInput.value = name;
  showLoading();
  try {
    setLoadStep(1); setLoadStep(2);
    const d = await fetchCityData(s.lat, s.lon, name);
    setLoadStep(3); renderDashboard(d); setLoadStep(4);
    setTimeout(hideLoading, 500);
  } catch (e) { hideLoading(); showError('API_FAIL'); }
}

function useGeo() {
  if (!navigator.geolocation) { showError('GEO_DENIED'); return; }
  navigator.geolocation.getCurrentPosition(async pos => {
    showLoading(); setLoadStep(1);
    try {
      // Reverse geocode via BigDataCloud (free, no API key, CORS-friendly)
      let name = 'My Location';
      try {
        const rgRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`
        );
        if (rgRes.ok) {
          const rgData = await rgRes.json();
          name = rgData.city || rgData.locality || rgData.principalSubdivision || 'My Location';
        }
      } catch (_) { /* fallback to 'My Location' */ }
      searchInput.value = name;
      setLoadStep(2);
      const d = await fetchCityData(pos.coords.latitude, pos.coords.longitude, name);
      setLoadStep(3); renderDashboard(d); setLoadStep(4);
      setTimeout(hideLoading, 500);
    } catch (e) { hideLoading(); showError('API_FAIL'); }
  }, () => showError('GEO_DENIED'));
}

// ═══ LOADING / ERROR UI ═══

function showLoading() {
  document.getElementById('loadBar').style.display = 'block';
  document.querySelectorAll('.load-step').forEach(s => { s.className = 'load-step'; });
}

function hideLoading() {
  document.getElementById('loadBar').style.display = 'none';
}

function setLoadStep(n) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('ls' + i);
    el.className = i < n ? 'load-step done' : i === n ? 'load-step active' : 'load-step';
  }
}

function showError(code, q = '') {
  const el = document.getElementById('errorMsg');
  el.style.display = 'block';
  const msgs = {
    CITY_NOT_FOUND: `No results for "${q}". Try a more specific name.`,
    API_FAIL: 'API error. <button onclick="location.reload()">Retry</button>',
    GEO_DENIED: 'Location access denied. Search manually.',
    GEO_FAIL: 'Location service unavailable.'
  };
  el.innerHTML = msgs[code] || 'Unknown error';
  setTimeout(() => el.style.display = 'none', 8000);
}

// ═══ TICKER ═══

function updateTicker(d) {
  const items = [
    `🌍 CO₂: <span>421.08 ppm</span> · NOAA 2023`,
    `🌡️ Temp Anomaly: <span>+1.28°C</span> · NASA GISS 2024`,
    `🌊 Sea Level: <span>+4.5 mm/yr</span> · NOAA 2024`,
    `❄️ Arctic Ice: <span>4.28M km²</span> · NSIDC 2024`,
    `🌳 India Forest: <span>21.76%</span> · FSI 2023`,
    `☀️ Solar: <span>1.42 TW</span> · IRENA 2023`,
  ];
  if (d) {
    items.unshift(
      `📍 ${d.cityName} PM2.5: <span>${d.pollutants.pm25 ? d.pollutants.pm25.toFixed(1) : 'N/A'} μg/m³</span> · AQI ${d.indiaAQI.value}`,
      `📍 ${d.cityName}: <span>×${(d.whoExceedances.pm2_5 || 0).toFixed(1)} WHO</span>`,
      `🌡️ ${d.cityName}: <span>${d.temperature}°C</span> · ${d.windSpeed} km/h wind`
    );
  }
  document.getElementById('tickerTrack').innerHTML =
    items.concat(items).map(t => `<span class="ticker-item">${t}</span>`).join('');
}

// ═══ COMPARE ENGINE ═══

function toggleCompare() {
  const s = document.getElementById('compareSection');
  s.style.display = s.style.display === 'none' ? 'block' : 'none';
}

function showCmpTab(n) {
  document.querySelectorAll('.tab-content').forEach((t, i) => {
    t.className = i === n ? 'tab-content active' : 'tab-content';
  });
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.className = i === n ? 'tab-btn active' : 'tab-btn';
  });
}

async function runCompare() {
  const names = [
    document.getElementById('cmp1').value,
    document.getElementById('cmp2').value,
    document.getElementById('cmp3').value
  ].filter(Boolean);
  if (names.length < 2) { alert('Enter at least 2 cities'); return; }
  try {
    const geos = await Promise.all(names.map(n => geocode(n)));
    const cities = geos.map((g, i) => ({ lat: g[0]?.lat, lon: g[0]?.lon, name: names[i] })).filter(c => c.lat);
    compData = await Promise.all(cities.map(c => fetchCityData(c.lat, c.lon, c.name)));
    renderCompare();
  } catch (e) { alert('Comparison failed: ' + e.message); }
}

function renderCompare() {
  if (!compData.length) return;

  // Tab 0: Gauges
  if (charts.cmpGauge) charts.cmpGauge.destroy();
  const ctx0 = document.getElementById('cmpGaugeChart').getContext('2d');
  charts.cmpGauge = new Chart(ctx0, {
    type: 'bar',
    data: { labels: compData.map(d => d.cityName), datasets: [{ label: 'India AQI', data: compData.map(d => d.indiaAQI.value), backgroundColor: CITY_COLORS.slice(0, compData.length), borderRadius: 6 }] },
    options: { responsive: true, indexAxis: 'y', scales: { x: { max: 500, ticks: { color: '#4a6678' }, grid: { color: 'rgba(255,255,255,.03)' } }, y: { ticks: { color: '#8ba8b8' } } }, plugins: { legend: { display: false } } }
  });
  const best = compData.reduce((a, b) => a.indiaAQI.value < b.indiaAQI.value ? a : b);
  const worst = compData.reduce((a, b) => a.indiaAQI.value > b.indiaAQI.value ? a : b);
  const oldBW = document.getElementById('cmpTab0').querySelector('.cmp-bw');
  if (oldBW) oldBW.remove();
  document.getElementById('cmpTab0').insertAdjacentHTML('afterbegin',
    `<div class="cmp-bw" style="font-size:.85rem;margin-bottom:.5rem">🏆 Best: <span style="color:var(--accent)">${best.cityName}</span> · ⚠ Worst: <span style="color:var(--danger)">${worst.cityName}</span></div>`);

  // Tab 1: Grouped bars
  if (charts.cmpBar) charts.cmpBar.destroy();
  const ctx1 = document.getElementById('cmpBarChart').getContext('2d');
  charts.cmpBar = new Chart(ctx1, {
    type: 'bar',
    data: { labels: ['PM2.5', 'PM10', 'NO₂', 'CO÷100', 'O₃', 'SO₂'], datasets: compData.map((d, i) => ({ label: d.cityName, data: [d.pollutants.pm25, d.pollutants.pm10, d.pollutants.no2, (d.pollutants.co || 0) / 100, d.pollutants.o3, d.pollutants.so2], backgroundColor: CITY_COLORS[i], borderRadius: 3 })) },
    options: { responsive: true, scales: { x: { ticks: { color: '#8ba8b8' }, grid: { display: false } }, y: { ticks: { color: '#4a6678' }, grid: { color: 'rgba(255,255,255,.03)' } } }, plugins: { legend: { labels: { color: '#8ba8b8' } } } }
  });

  // Tab 2: Trend overlay
  if (charts.cmpTrend) charts.cmpTrend.destroy();
  const ctx2 = document.getElementById('cmpTrendChart').getContext('2d');
  const dashes = [[], [6, 4], [3, 3]];
  charts.cmpTrend = new Chart(ctx2, {
    type: 'line',
    data: { labels: compData[0].rawHourly.time.slice(0, 168).map(t => new Date(t).toLocaleDateString('en', { month: 'short', day: 'numeric' })), datasets: compData.map((d, i) => ({ label: d.cityName, data: d.rawHourly.pm2_5.slice(0, 168), borderColor: CITY_COLORS[i], borderDash: dashes[i], borderWidth: 2, pointRadius: 0, tension: .3, spanGaps: true })) },
    options: { responsive: true, scales: { x: { ticks: { maxTicksLimit: 7, color: '#4a6678' }, grid: { color: 'rgba(255,255,255,.03)' } }, y: { ticks: { color: '#4a6678' }, grid: { color: 'rgba(255,255,255,.03)' } } }, plugins: { legend: { labels: { color: '#8ba8b8' } } } }
  });

  // Tab 3: Ranking table
  const ehs = d => {
    const e = d.whoExceedances;
    return Math.max(0, Math.min(100, Math.round(100 - ((e.pm2_5 || 0) * 40 + (e.o3 || 0) * 20 + (e.no2 || 0) * 20 + (e.pm10 || 0) * 20))));
  };
  document.getElementById('cmpTable').innerHTML =
    `<table style="width:100%;border-collapse:collapse;font-size:.8rem"><thead><tr>` +
    ['City', 'AQI', 'PM2.5', 'WHO ×', 'CPCB', 'EPA', 'EHS'].map(h => `<th style="padding:.5rem;border:1px solid var(--border1);background:var(--bg-surface);color:var(--text2)">${h}</th>`).join('') +
    `</tr></thead><tbody>` +
    compData.map(d =>
      `<tr><td style="padding:.5rem;border:1px solid var(--border1)">${d.cityName}</td>` +
      `<td style="padding:.5rem;border:1px solid var(--border1);color:${d.indiaAQI.color}">${d.indiaAQI.value}</td>` +
      `<td style="padding:.5rem;border:1px solid var(--border1)">${(d.pollutants.pm25 || 0).toFixed(1)}</td>` +
      `<td style="padding:.5rem;border:1px solid var(--border1)">×${(d.whoExceedances.pm2_5 || 0).toFixed(1)}</td>` +
      `<td style="padding:.5rem;border:1px solid var(--border1);color:${d.indiaAQI.color}">${d.indiaAQI.category}</td>` +
      `<td style="padding:.5rem;border:1px solid var(--border1);color:${d.usAQI.color}">${d.usAQI.category}</td>` +
      `<td style="padding:.5rem;border:1px solid var(--border1)">${ehs(d)}/100</td></tr>`
    ).join('') +
    `</tbody></table><div style="font-size:.65rem;color:var(--text3);margin-top:.5rem">EHS = 100 − (PM2.5×40% + O₃×20% + NO₂×20% + PM10×20%) WHO exceedance weighted</div>`;
}

// ═══ GLOBAL CLIMATE INDICATORS ═══

function renderGlobalIndicators() {
  const cards = [
    { val: '421.08 ppm', title: 'Global CO₂', label: 'NOAA GML · Mauna Loa · 2023 confirmed annual mean', badge: '⚠ CRITICAL', bcls: 'badge-crit', sub: 'Highest in 3 million years of geological record', spark: [393.8, 395.5, 397.2, 399.4, 401.3, 403.9, 406.5, 408.5, 411.4, 414.2, 416.5, 418.5, 419, 420, 421.08] },
    { val: '+1.28°C', title: 'Temp Anomaly', label: 'NASA GISS GISTEMP v4 · 2024 · vs 1951-1980 baseline', badge: '⚡ WARNING', bcls: 'badge-warn', sub: '+1.47°C vs 1850-1900 pre-industrial · WMO: +1.54°C' },
    { val: '4.5 mm/yr', title: 'Sea Level Rise', label: 'NOAA Satellite Altimetry · 2014-2024 decadal avg', badge: '⚡ WARNING', bcls: 'badge-warn', sub: 'Accelerating: was 1.5 mm/yr in 1990s → 3.6 in 2006-15 → 4.5 now' },
    { val: '4.28 M km²', title: 'Arctic Sea Ice', label: 'NSIDC · September 2024 minimum extent', badge: '⚠ CRITICAL', bcls: 'badge-crit', sub: 'Declining ~13% per decade since 1979' },
    { val: '21.76%', title: 'India Forest Cover', label: 'FSI State of Forest Report 2023 · 715,343 km²', badge: '↘ DECLINING', bcls: 'badge-dec', sub: '21.76% = 715,343 ÷ 3,287,263 km² · +1,445 km² from 2021' },
    { val: '1.42 TW', title: 'Global Solar', label: 'IRENA · 2023 confirmed installed capacity', badge: '✓ GROWING', bcls: 'badge-good', sub: '2024 preliminary ~1.87 TW (unconfirmed)' }
  ];

  document.getElementById('giGrid').innerHTML = cards.map((c, i) =>
    `<div class="card gi-card"><div class="card-title">${c.title}</div>` +
    `<div class="gi-val" style="color:var(--accent)">${c.val}</div>` +
    `<div class="gi-label">${c.label}</div>` +
    `<div class="gi-badge ${c.bcls}">${c.badge}</div>` +
    `<div style="font-size:.7rem;color:var(--text3);margin-top:.25rem">${c.sub}</div>` +
    (c.spark ? `<div class="gi-spark"><canvas id="giSpark${i}" width="350" height="30"></canvas></div>` : '') +
    `<div style="font-size:.6rem;color:var(--text3);margin-top:.25rem;font-style:italic">Authoritative static · Not real-time</div></div>`
  ).join('');

  // CO₂ sparkline
  setTimeout(() => {
    const ctx = document.getElementById('giSpark0');
    if (!ctx) return;
    new Chart(ctx, {
      type: 'line',
      data: { labels: cards[0].spark.map((_, i) => 2009 + i), datasets: [{ data: cards[0].spark, borderColor: '#00e5a0', borderWidth: 1.5, pointRadius: 0, fill: true, backgroundColor: 'rgba(0,229,160,.08)', tension: .3 }] },
      options: { responsive: false, maintainAspectRatio: false, scales: { x: { display: false }, y: { display: false } }, plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });
  }, 100);
}

// ═══ METHODOLOGY MODAL ═══

function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('methodModal').innerHTML = `<button class="modal-close" onclick="closeModal()">✕</button>
<h2>📋 Data Transparency & Methodology</h2>
<h3>A. Live Data — What is Fetched</h3>
<p>This dashboard makes direct <code>fetch()</code> calls from your browser to <strong>air-quality-api.open-meteo.com</strong>. No server. No API key. Copernicus CAMS is the EU's operational atmospheric monitoring service, fusing satellite observations with ground sensors. Resolution: 11km global grid. Updated: hourly.</p>
<h3>B. How AQI is Computed</h3>
<p>AQI is always computed from <strong>24-hour rolling average</strong> of PM2.5, not from a single hourly reading. This matches official methodology.</p>
<table><thead><tr><th>PM2.5 μg/m³</th><th>CPCB AQI</th><th>Category</th></tr></thead><tbody>
<tr><td>0–30</td><td>0–50</td><td>Good</td></tr><tr><td>31–60</td><td>51–100</td><td>Satisfactory</td></tr><tr><td>61–90</td><td>101–200</td><td>Moderate</td></tr><tr><td>91–120</td><td>201–300</td><td>Poor</td></tr><tr><td>121–250</td><td>301–400</td><td>Very Poor</td></tr><tr><td>250+</td><td>401–500</td><td>Severe</td></tr></tbody></table>
<h3>C. WHO 2021 Guidelines</h3>
<table><thead><tr><th>Pollutant</th><th>Guideline</th><th>Unit</th></tr></thead><tbody>
<tr><td>PM2.5</td><td>15</td><td>μg/m³ (24-hr)</td></tr><tr><td>PM10</td><td>45</td><td>μg/m³</td></tr><tr><td>NO₂</td><td>25</td><td>μg/m³</td></tr><tr><td>O₃</td><td>100</td><td>μg/m³ (8-hr)</td></tr><tr><td>SO₂</td><td>40</td><td>μg/m³</td></tr><tr><td>CO</td><td>4000</td><td>μg/m³ (= 4 mg/m³)</td></tr></tbody></table>
<p><strong>CO Note:</strong> API returns CO in μg/m³. WHO CO guideline is 4 mg/m³ = 4000 μg/m³.</p>
<h3>D. Authoritative Static Data</h3>
<ul>
<li>CO₂: 421.08 ppm — NOAA GML Mauna Loa 2023 confirmed annual mean</li>
<li>Temp Anomaly: +1.28°C — NASA GISS GISTEMP v4, 2024 vs 1951-1980 (+1.47°C vs pre-industrial)</li>
<li>Sea Level: 4.5 mm/yr — NOAA Satellite Altimetry 2014-2024 decadal average</li>
<li>Arctic Ice: 4.28M km² — NSIDC September 2024 minimum</li>
<li>India Forest: 715,343 km² (21.76%) — FSI ISFR 2023 (released Dec 2024)</li>
<li>Solar: 1.42 TW — IRENA 2023 confirmed</li>
</ul>
<h3>E. Known Limitations</h3>
<ul>
<li><strong>Resolution:</strong> 11km grid — street-level variation not captured.</li>
<li><strong>Remote areas:</strong> fewer ground stations = more model interpolation.</li>
<li><strong>Forecast:</strong> 7-day AQI forecast is model output, not guaranteed.</li>
<li><strong>Geocoding:</strong> uses Open-Meteo Geocoding (GeoNames) — may not include very new or minor place names.</li>
<li><strong>Static data:</strong> CO₂, sea level etc are annual figures, not streaming.</li>
</ul>`;
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

/**
 * EcoStat — Chart Rendering
 * All Chart.js visualization functions
 */

// ═══ GAUGE ═══
function renderGauge(d) {
  const v = d.indiaAQI.value;
  document.getElementById('gaugeVal').textContent = v;
  document.getElementById('gaugeVal').style.color = d.indiaAQI.color;
  document.getElementById('gaugeCat').textContent = d.indiaAQI.category;
  document.getElementById('gaugeCat').style.color = d.indiaAQI.color;
  document.getElementById('gaugeSub').innerHTML =
    `Based on 24-hr rolling avg PM2.5<br>` +
    `<span class="mono" style="font-size:.65rem;color:var(--text3)">` +
    `${d.cityName} · ${parseFloat(d.lat).toFixed(2)}°N, ${parseFloat(d.lon).toFixed(2)}°E · ` +
    `Fetched ${new Date(d.fetchTimestamp).toLocaleTimeString()} · Copernicus CAMS</span>`;

  if (charts.gauge) charts.gauge.destroy();
  const ctx = document.getElementById('gaugeChart').getContext('2d');
  charts.gauge = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [v, 500 - v],
        backgroundColor: [d.indiaAQI.color, 'rgba(255,255,255,.05)'],
        borderWidth: 0
      }]
    },
    options: {
      rotation: -90, circumference: 180, cutout: '75%',
      responsive: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

// ═══ TRIPLE STANDARD ═══
function renderStdCards(d) {
  const s = (id, val, cat, col) => {
    document.getElementById(id + 'Val').textContent = val;
    document.getElementById(id + 'Cat').textContent = cat;
    document.getElementById(id + 'Cat').style.background = col;
    document.getElementById(id + 'Cat').style.color = '#000';
  };
  s('cpcb', d.indiaAQI.value, d.indiaAQI.category, d.indiaAQI.color);
  s('epa', d.usAQI.value, d.usAQI.category, d.usAQI.color);

  const wv = d.whoExceedances.pm2_5;
  document.getElementById('whoVal').textContent = wv < 1 ? 'Within limit' : `×${wv.toFixed(1)} above`;
  document.getElementById('whoCat').textContent = 'WHO PM2.5 15 μg/m³';
  document.getElementById('whoCat').style.background = wv < 1 ? '#00e400' : wv < 2 ? '#ffff00' : wv < 5 ? '#ff7e00' : '#ff0000';
  document.getElementById('whoCat').style.color = '#000';
}

// ═══ POLLUTANT CARDS + SPARKLINES ═══
function renderPollCards(d) {
  const g = document.getElementById('pollGrid');
  const polls = [
    { key: 'pm25', name: 'PM2.5', icon: '🌫️', unit: 'μg/m³', who: WHO.pm2_5 },
    { key: 'pm10', name: 'PM10',  icon: '💨', unit: 'μg/m³', who: WHO.pm10 },
    { key: 'no2',  name: 'NO₂',   icon: '🏭', unit: 'μg/m³', who: WHO.nitrogen_dioxide },
    { key: 'co',   name: 'CO',    icon: '🚗', unit: 'μg/m³', who: WHO.carbon_monoxide },
    { key: 'o3',   name: 'O₃',    icon: '☀️', unit: 'μg/m³', who: WHO.ozone },
    { key: 'so2',  name: 'SO₂',   icon: '⚡', unit: 'μg/m³', who: WHO.sulphur_dioxide }
  ];

  // Key mapping: pollutant key → rawHourly key
  const RAW_KEY = { pm25: 'pm2_5', pm10: 'pm10', no2: 'no2', co: 'co', o3: 'o3', so2: 'so2' };

  g.innerHTML = polls.map(p => {
    const v = d.pollutants[p.key];
    const vn = v !== null ? v : 0;
    const ratio = vn / p.who;
    const barW = Math.min(ratio * 100, 100);
    const barCol = ratio < 1 ? 'var(--aqi-good)' : ratio < 2 ? 'var(--aqi-mod)' : ratio < 5 ? 'var(--aqi-poor)' : 'var(--aqi-vpoor)';
    const badge = ratio < 1
      ? `<span class="who-badge" style="background:rgba(0,228,0,.15);color:#00e400">Within WHO limit</span>`
      : `<span class="who-badge" style="background:rgba(255,0,0,.15);color:#ff6b6b">×${ratio.toFixed(1)} above WHO</span>`;
    let extra = '';
    if (p.key === 'co') extra = `<div style="font-size:.65rem;color:var(--text3)">${(vn / 1000).toFixed(2)} mg/m³ · WHO: 4 mg/m³</div>`;

    return `<div class="card poll-card">
      <div class="card-title">${p.icon} ${p.name}</div>
      <div class="poll-val mono">${v !== null ? v.toFixed(1) : 'N/A'}</div>
      <div class="poll-unit">${p.unit}</div>${extra}
      <div class="who-bar"><div class="who-bar-fill" style="width:${barW}%;background:${barCol}"></div></div>
      ${badge}
      <div class="sparkline-wrap"><canvas id="spark_${p.key}" width="300" height="35"></canvas></div>
    </div>`;
  }).join('');

  // Render sparklines
  polls.forEach(p => {
    const rawKey = RAW_KEY[p.key];
    const last24 = (d.rawHourly[rawKey] || []).slice(Math.max(0, d.currentIdx - 23), d.currentIdx + 1);
    if (charts['spark_' + p.key]) charts['spark_' + p.key].destroy();
    const ctx = document.getElementById('spark_' + p.key);
    if (!ctx) return;
    charts['spark_' + p.key] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: last24.map((_, i) => i),
        datasets: [{
          data: last24, borderColor: '#00e5a0', borderWidth: 1.5,
          pointRadius: 0, fill: true, backgroundColor: 'rgba(0,229,160,.08)',
          tension: .4, spanGaps: true
        }]
      },
      options: {
        responsive: false, maintainAspectRatio: false,
        scales: { x: { display: false }, y: { display: false } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } }
      }
    });
  });
}

// ═══ STATS PANEL ═══
function renderStats(d) {
  const s = d.stats;
  document.getElementById('statsTitle').textContent = `7-Day PM2.5 Statistical Summary · ${d.cityName}`;
  document.getElementById('statPills').innerHTML =
    `<div class="stat-pill">Mean: <span>${s.mean.toFixed(1)} μg/m³</span></div>` +
    `<div class="stat-pill">Median: <span>${s.median.toFixed(1)}</span></div>` +
    `<div class="stat-pill">Std Dev: <span>±${s.stddev.toFixed(1)}</span></div>` +
    `<div class="stat-pill">Min: <span>${s.min.toFixed(1)}</span></div>` +
    `<div class="stat-pill">Max: <span>${s.max.toFixed(1)}</span></div>`;

  document.getElementById('threshBars').innerHTML =
    `<div style="font-size:.8rem;margin:.5rem 0">${s.pctWHO.toFixed(0)}% of hours exceeded WHO 15 μg/m³</div>` +
    `<div class="thresh-bar"><div class="thresh-fill" style="width:${s.pctWHO}%;background:${s.pctWHO > 50 ? 'var(--danger)' : 'var(--warn)'}"></div></div>` +
    `<div style="font-size:.8rem;margin:.5rem 0">${s.pctCPCB.toFixed(0)}% of hours exceeded CPCB Good 30 μg/m³</div>` +
    `<div class="thresh-bar"><div class="thresh-fill" style="width:${s.pctCPCB}%;background:${s.pctCPCB > 50 ? 'var(--danger)' : 'var(--accent)'}"></div></div>`;

  const r = d.regression;
  const daily = (r.slope * 24).toFixed(2);
  let trend = Math.abs(r.slope) < 0.02
    ? `→ Stable — no significant trend · R²=${r.r2.toFixed(3)}`
    : r.slope > 0
      ? `↗ Worsening — +${daily} μg/m³/day · R²=${r.r2.toFixed(3)}`
      : `↘ Improving — ${daily} μg/m³/day · R²=${r.r2.toFixed(3)}`;
  if (r.r2 < 0.2) trend += ' · Low trend confidence — high variability';
  document.getElementById('trendText').innerHTML = trend;
}

// ═══ 14-DAY PIVOT CHART ═══
function renderPivotChart(d) {
  if (charts.pivot) charts.pivot.destroy();
  const ctx = document.getElementById('pivotChart').getContext('2d');
  const times = d.rawHourly.time.map(t => new Date(t));
  const isMobile = window.innerWidth < 640;
  let labels, pm, temps, pastLen;

  if (isMobile) {
    labels = []; pm = []; temps = [];
    for (let i = 0; i < 14; i++) {
      const s = d.rawHourly.pm2_5.slice(i * 24, (i + 1) * 24).filter(v => v !== null);
      pm.push(s.length ? avg(s) : null);
      const ts = d.rawHourly.temp.slice(i * 24, (i + 1) * 24).filter(v => v !== null);
      temps.push(ts.length ? avg(ts) : null);
      labels.push(times[i * 24] ? times[i * 24].toLocaleDateString('en', { month: 'short', day: 'numeric' }) : `Day ${i + 1}`);
    }
    pastLen = 7;
  } else {
    labels = times.map(t => t.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit' }));
    pm = d.rawHourly.pm2_5;
    temps = d.rawHourly.temp;
    pastLen = 168;
  }

  const regLine = d.rawHourly.pm2_5.slice(0, pastLen).map((_, i) => d.regression.slope * i + d.regression.intercept);

  charts.pivot = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'PM2.5 (Actual)', data: pm.slice(0, pastLen), borderColor: '#00e5a0', backgroundColor: 'rgba(0,229,160,.1)', borderWidth: 2, pointRadius: 0, fill: true, tension: .3, spanGaps: true },
        { label: 'PM2.5 (Forecast)', data: Array(pastLen).fill(null).concat(pm.slice(pastLen)), borderColor: '#00e5a0', borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, tension: .3, spanGaps: true },
        { label: 'Temperature °C', data: temps, borderColor: 'rgba(245,158,11,.5)', borderWidth: 1, pointRadius: 0, yAxisID: 'y2', tension: .3, spanGaps: true },
        { label: 'Trend', data: regLine.concat(Array(pm.length - pastLen).fill(null)), borderColor: 'rgba(239,68,68,.6)', borderDash: [8, 4], borderWidth: 1.5, pointRadius: 0, spanGaps: true }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { maxTicksLimit: isMobile ? 7 : 14, font: { size: 9 }, color: '#4a6678' }, grid: { color: 'rgba(255,255,255,.03)' } },
        y: { title: { display: true, text: 'PM2.5 μg/m³', color: '#8ba8b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.03)' }, ticks: { color: '#4a6678' } },
        y2: { position: 'right', title: { display: true, text: 'Temp °C', color: '#f59e0b', font: { size: 10 } }, grid: { display: false }, ticks: { color: '#f59e0b66' } }
      },
      plugins: { legend: { labels: { color: '#8ba8b8', font: { size: 10 } } }, annotation: false }
    }
  });
}

// ═══ RADAR ═══
function renderRadar(d) {
  if (charts.radar) charts.radar.destroy();
  const ctx = document.getElementById('radarChart').getContext('2d');
  const ex = d.whoExceedances;
  charts.radar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['PM2.5', 'PM10', 'NO₂', 'CO', 'O₃', 'SO₂'],
      datasets: [
        { label: 'WHO Normalized', data: [ex.pm2_5 || 0, ex.pm10 || 0, ex.no2 || 0, ex.co || 0, ex.o3 || 0, ex.so2 || 0], backgroundColor: 'rgba(0,229,160,.15)', borderColor: '#00e5a0', borderWidth: 2, pointBackgroundColor: '#00e5a0' },
        { label: 'WHO Limit (1.0)', data: [1, 1, 1, 1, 1, 1], backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,.2)', borderDash: [4, 4], borderWidth: 1, pointRadius: 0 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { r: { beginAtZero: true, grid: { color: 'rgba(255,255,255,.05)' }, angleLines: { color: 'rgba(255,255,255,.05)' }, pointLabels: { color: '#8ba8b8', font: { size: 10 } }, ticks: { display: false } } },
      plugins: { legend: { display: false } }
    }
  });
}

// ═══ HEATMAP (Raw Canvas) ═══
function renderHeatmap(d) {
  const canvas = document.getElementById('heatmapChart');
  const ctx = canvas.getContext('2d');
  const w = canvas.parentElement.clientWidth - 40, h = 200;
  canvas.width = w; canvas.height = h;
  ctx.clearRect(0, 0, w, h);
  const cw = Math.floor(w / 24), ch = Math.floor(h / 7);
  const getCol = v => {
    if (v === null) return '#111';
    if (v <= 30)  return '#00e400';
    if (v <= 60)  return '#92d14f';
    if (v <= 90)  return '#ffff00';
    if (v <= 120) return '#ff7e00';
    if (v <= 250) return '#ff0000';
    return '#7e0023';
  };
  for (let dy = 0; dy < 7; dy++) {
    for (let hr = 0; hr < 24; hr++) {
      ctx.fillStyle = getCol(d.heatmapGrid[dy][hr]);
      ctx.fillRect(hr * cw, dy * ch, cw - 1, ch - 1);
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.font = '8px IBM Plex Mono';
      if (d.heatmapGrid[dy][hr] !== null) {
        ctx.fillText(d.heatmapGrid[dy][hr].toFixed(0), hr * cw + 2, dy * ch + ch / 2 + 3);
      }
    }
  }
  ctx.fillStyle = '#8ba8b8'; ctx.font = '9px Sora';
  for (let hr = 0; hr < 24; hr += 3) ctx.fillText(`${hr}h`, hr * cw, h - 2);
}

// ═══ DONUT ═══
function renderDonut(d) {
  if (charts.donut) charts.donut.destroy();
  const ctx = document.getElementById('donutChart').getContext('2d');
  const cd = d.stats.catDist;
  charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Good', 'Satisfactory', 'Moderate', 'Poor', 'Very Poor', 'Severe'],
      datasets: [{ data: [cd.good, cd.satisfactory, cd.moderate, cd.poor, cd.verypoor, cd.severe], backgroundColor: ['#00e400', '#92d14f', '#ffff00', '#ff7e00', '#ff0000', '#7e0023'], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { color: '#8ba8b8', font: { size: 9 }, boxWidth: 12 } } } }
  });
}

// ═══ HISTOGRAM ═══
function renderHistogram(d) {
  if (charts.hist) charts.hist.destroy();
  const ctx = document.getElementById('histChart').getContext('2d');
  const hp = d.hourlyPattern;
  const sorted = [...hp.map((v, i) => ({ v, i }))].sort((a, b) => b.v - a.v);
  const top3 = sorted.slice(0, 3).map(x => x.i);
  const bot3 = sorted.slice(-3).map(x => x.i);
  const colors = hp.map((_, i) => top3.includes(i) ? '#ef4444' : bot3.includes(i) ? '#00e400' : '#00e5a066');

  charts.hist = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array(24).fill(0).map((_, i) => `${i}:00`),
      datasets: [
        { label: 'Avg PM2.5', data: hp, backgroundColor: colors, borderRadius: 3 },
        { label: 'WHO 15μg/m³', data: Array(24).fill(15), type: 'line', borderColor: 'rgba(255,255,255,.3)', borderDash: [4, 4], borderWidth: 1, pointRadius: 0 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { ticks: { font: { size: 8 }, color: '#4a6678', maxRotation: 0 }, grid: { display: false } }, y: { ticks: { color: '#4a6678' }, grid: { color: 'rgba(255,255,255,.03)' } } },
      plugins: { legend: { display: false } }
    }
  });
}

// ═══ SCATTER ═══
function renderScatter(d) {
  if (charts.scatter) charts.scatter.destroy();
  const ctx = document.getElementById('scatterChart').getContext('2d');
  const pm = d.rawHourly.pm2_5.slice(0, 168);
  const tmp = d.rawHourly.temp.slice(0, 168);
  const pts = pm.map((p, i) => p !== null && tmp[i] !== null ? { x: tmp[i], y: p } : null).filter(Boolean);
  const r = d.correlation;
  const interp = Math.abs(r) < 0.3
    ? 'Weak correlation'
    : r < 0
      ? 'Negative: higher temp → better dispersion'
      : 'Positive: possible pollution trapping';

  charts.scatter = new Chart(ctx, {
    type: 'scatter',
    data: { datasets: [{ label: 'PM2.5 vs Temp', data: pts, backgroundColor: 'rgba(0,229,160,.3)', borderColor: '#00e5a0', pointRadius: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Temperature °C', color: '#8ba8b8' }, ticks: { color: '#4a6678' }, grid: { color: 'rgba(255,255,255,.03)' } },
        y: { title: { display: true, text: 'PM2.5 μg/m³', color: '#8ba8b8' }, ticks: { color: '#4a6678' }, grid: { color: 'rgba(255,255,255,.03)' } }
      },
      plugins: { legend: { display: false }, title: { display: true, text: `Correlation: r = ${r.toFixed(3)} · ${interp}`, color: '#8ba8b8', font: { size: 11 } } }
    }
  });
}

// ═══ FINGERPRINT ═══
function renderFingerprint(d) {
  const fp = d.fingerprint;
  document.getElementById('fpIcon').textContent = fp.icon;
  document.getElementById('fpLabel').textContent = fp.label;
  document.getElementById('fpDetail').textContent = fp.confidence === 'Low'
    ? '⚠ Mixed signals — pollution source inconclusive from current ratios'
    : fp.detail;
  document.getElementById('fpCite').textContent = `Methodology: ${fp.citation}`;
  const c = document.getElementById('fpConf');
  c.textContent = fp.confidence + ' confidence';
  c.style.background = fp.confidence === 'High' ? 'rgba(0,228,0,.15)' : fp.confidence === 'Moderate' ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.15)';
  c.style.color = fp.confidence === 'High' ? '#00e400' : fp.confidence === 'Moderate' ? '#f59e0b' : '#ef4444';
}

// ═══ HEALTH MATRIX ═══
function renderHealth(d) {
  const groups = [
    { name: 'General Population',   mult: 1 },
    { name: 'Children (0-12)',      mult: 1 },
    { name: 'Elderly (65+)',        mult: .7 },
    { name: 'Heart/Cardiovascular', mult: .7 },
    { name: 'Respiratory',          mult: .7 }
  ];
  const polls = [
    { key: 'pm25', name: 'PM2.5', who: 15 },
    { key: 'o3',   name: 'O₃',    who: 100 },
    { key: 'no2',  name: 'NO₂',   who: 25 }
  ];
  const advise = {
    pm25: { caution: 'Monitor air quality updates', avoid: 'Limit outdoor activity', danger: 'Stay indoors · Use air purifier' },
    o3:   { caution: 'Reduce prolonged outdoor exertion', avoid: 'Avoid outdoor exercise', danger: 'Remain indoors · Keep windows closed' },
    no2:  { caution: 'Sensitive individuals reduce exposure', avoid: 'Avoid traffic areas', danger: 'Stay indoors · Carry prescribed inhaler' }
  };

  let html = '<table><thead><tr><th>Group</th>';
  polls.forEach(p => html += `<th>${p.name}</th>`);
  html += '</tr></thead><tbody>';

  groups.forEach(g => {
    html += `<tr><td style="text-align:left;font-weight:600">${g.name}</td>`;
    polls.forEach(p => {
      const v = d.pollutants[p.key] || 0;
      const thresh = p.who * g.mult;
      const ratio = v / thresh;
      let cls, txt;
      if (ratio < .7) { cls = 'hm-safe'; txt = 'Safe'; }
      else if (ratio < 1) { cls = 'hm-caution'; txt = advise[p.key].caution; }
      else if (ratio < 2) { cls = 'hm-avoid'; txt = advise[p.key].avoid; }
      else { cls = 'hm-danger'; txt = advise[p.key].danger; }
      html += `<td class="${cls}" title="${p.name}: ${v.toFixed(1)} μg/m³">${txt}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('healthMatrix').innerHTML = html;
}

// ═══ WEATHER ═══
function renderWeather(d) {
  const wCodes = { 0: '☀️ Clear', 1: '🌤️ Mostly Clear', 2: '⛅ Partly Cloudy', 3: '☁️ Overcast', 45: '🌫️ Foggy', 48: '🌫️ Rime Fog', 51: '🌦️ Light Drizzle', 61: '🌧️ Rain', 71: '🌨️ Snow', 80: '🌧️ Showers', 95: '⛈️ Thunderstorm' };
  const wDesc = wCodes[d.weatherCode] || '🌤️ Fair';
  const dispText = d.windSpeed > 20 ? 'excellent dispersion rapidly clears pollutants'
    : d.windSpeed > 12 ? 'good dispersion reduces pollution accumulation'
    : d.windSpeed > 6 ? 'moderate dispersion — pollutants may linger'
    : 'poor dispersion traps pollutants near ground level';

  document.getElementById('wxGrid').innerHTML =
    `<div><div class="wx-item"><span style="font-size:1.5rem">${wDesc.split(' ')[0]}</span><div><div class="val">${d.temperature}°C</div><div style="font-size:.75rem;color:var(--text3)">Feels like ${d.feelsLike}°C</div></div></div>` +
    `<div class="wx-item">💧 <div class="val">${d.humidity}%</div><span style="font-size:.75rem;color:var(--text3);margin-left:.5rem">Humidity</span></div></div>` +
    `<div><div class="compass"><div class="compass-arrow" style="transform:translateX(-50%) translateY(-100%) rotate(${d.windDirection}deg)"></div></div>` +
    `<div style="text-align:center;margin-top:.5rem"><span class="mono" style="font-size:1.1rem">${d.windSpeed} km/h</span>` +
    `<div style="font-size:.75rem;color:var(--text3)">Wind dispersion: <span style="color:${d.windDispersion === 'poor' ? 'var(--danger)' : 'var(--accent)'}"> ${d.windDispersion}</span></div>` +
    `<div style="font-size:.7rem;color:var(--text3);margin-top:.25rem">Current wind ${d.windSpeed} km/h — ${dispText}</div></div></div>`;
}

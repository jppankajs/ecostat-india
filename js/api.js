/**
 * EcoStat — API Layer
 * Geocoding, data fetching, processing pipeline
 */

// ═══ AQI COMPUTATION ═══

function computeAQI(pm, bp) {
  if (pm === null) return { value: 0, category: 'N/A', color: '#666' };
  for (const [bpl, bph, al, ah, cat, col] of bp) {
    if (pm <= bph) {
      return {
        value: Math.round(((ah - al) / (bph - bpl)) * (pm - bpl) + al),
        category: cat,
        color: col
      };
    }
  }
  return { value: 500, category: bp[bp.length - 1][4], color: bp[bp.length - 1][5] };
}

function computeCPCB(pm) { return computeAQI(pm, CPCB_BP); }
function computeEPA(pm)  { return computeAQI(pm, EPA_BP); }

// ═══ POLLUTANT FINGERPRINTING ═══

function classifySource({ no2, co, pm25, pm10, so2, o3 }) {
  const r = pm25 / (pm10 || 1);
  const sc = {
    traffic:      (no2 > 40 ? 3 : 0) + (co > 1000 ? 3 : 0) + (r > .6 ? 2 : 0),
    industrial:   (so2 > 50 ? 4 : 0) + (pm10 > 100 ? 2 : 0) + (r < .4 ? 2 : 0),
    construction: (pm10 > 150 ? 4 : 0) + (r < .3 ? 3 : 0) + (so2 < 20 ? 1 : 0),
    photochem:    (o3 > 80 ? 4 : 0) + (no2 < 20 ? 2 : 0),
    biomass:      (pm25 > 60 ? 2 : 0) + (co > 2000 ? 3 : 0) + (so2 < 15 ? 2 : 0)
  };
  const mk = Object.keys(sc).reduce((a, b) => sc[a] > sc[b] ? a : b);
  const ms = Math.max(...Object.values(sc));
  const conf = ms >= 6 ? 'High' : ms >= 3 ? 'Moderate' : 'Low';

  const labels = {
    traffic:      { icon: '🚗', label: 'Traffic & Combustion',    detail: 'Elevated NO₂ and CO suggest vehicle exhaust dominance.' },
    industrial:   { icon: '🏭', label: 'Industrial Activity',     detail: 'High SO₂ and coarse particles indicate industrial source.' },
    construction: { icon: '🏗️', label: 'Construction / Dust',     detail: 'PM10 dominated — coarse crustal particles typical of dust.' },
    photochem:    { icon: '☀️', label: 'Photochemical Smog',       detail: 'Elevated O₃ without NOx suggests secondary pollution from sunlight.' },
    biomass:      { icon: '🔥', label: 'Biomass / Crop Burning',   detail: 'High CO and fine PM2.5 consistent with open burning.' }
  };

  return {
    ...labels[mk],
    confidence: conf,
    citation: 'EPA Air Quality Monitoring Guide + WHO Pollution Source Attribution'
  };
}

// ═══ GEOCODING (Open-Meteo) ═══

async function geocode(q) {
  if (q.length < 2) return [];
  const now = Date.now();
  if (now - lastGeoTime < 300) {
    await new Promise(r => setTimeout(r, 300 - (now - lastGeoTime)));
  }
  lastGeoTime = Date.now();

  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`
  );
  if (!r.ok) throw new Error('GEO_FAIL');
  const data = await r.json();
  if (!data.results || !data.results.length) return [];

  // Normalize to a shape compatible with the rest of the app
  return data.results.map(r => ({
    lat: r.latitude,
    lon: r.longitude,
    name: r.name,
    display_name: [r.name, r.admin1, r.country].filter(Boolean).join(', ')
  }));
}

// ═══ DATA FETCHING (Open-Meteo + CAMS) ═══

async function fetchCityData(lat, lon, cityName) {
  const ck = `${parseFloat(lat).toFixed(2)}_${parseFloat(lon).toFixed(2)}`;
  const cached = sessionStorage.getItem(`ecostat_${ck}`);
  if (cached) {
    const p = JSON.parse(cached);
    if ((Date.now() - p.timestamp) / 60000 < 30) return p.data;
  }

  const [aqR, wxR] = await Promise.all([
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,pm10,nitrogen_dioxide,carbon_monoxide,ozone,sulphur_dioxide,us_aqi,european_aqi,dust,uv_index&past_days=7&forecast_days=7&timezone=auto`),
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,apparent_temperature,precipitation,weather_code&hourly=temperature_2m&past_days=7&forecast_days=7&timezone=auto`)
  ]);
  if (!aqR.ok || !wxR.ok) throw new Error('API_FAIL');

  const [aq, wx] = await Promise.all([aqR.json(), wxR.json()]);
  const result = processData(aq, wx, cityName, lat, lon);

  sessionStorage.setItem(`ecostat_${ck}`, JSON.stringify({ timestamp: Date.now(), data: result }));
  return result;
}

// ═══ DATA PROCESSING PIPELINE ═══

function processData(aq, wx, cityName, lat, lon) {
  const h = aq.hourly;
  const now = new Date();

  // Find current hour index
  let ci = h.time.findIndex(t => new Date(t) >= new Date(now - 3600000));
  if (ci < 0) ci = 167;

  // 24-hour rolling averages for each pollutant
  const pm25a = get24hrAvg(h.pm2_5, ci);
  const pm10a = get24hrAvg(h.pm10, ci);
  const no2a  = get24hrAvg(h.nitrogen_dioxide, ci);
  const coa   = get24hrAvg(h.carbon_monoxide, ci);
  const o3a   = get24hrAvg(h.ozone, ci);
  const so2a  = get24hrAvg(h.sulphur_dioxide, ci);

  // AQI computation (both standards)
  const indiaAQI = computeCPCB(pm25a);
  const usAQI    = computeEPA(pm25a);

  // WHO exceedance ratios (null-safe)
  const whoEx = {
    pm2_5: safeDiv(pm25a, WHO.pm2_5),
    pm10:  safeDiv(pm10a, WHO.pm10),
    no2:   safeDiv(no2a, WHO.nitrogen_dioxide),
    co:    safeDiv(coa, WHO.carbon_monoxide),
    o3:    safeDiv(o3a, WHO.ozone),
    so2:   safeDiv(so2a, WHO.sulphur_dioxide)
  };

  // 7-day statistics (past data only: indices 0-167)
  const pp = h.pm2_5.slice(0, 168).filter(v => v !== null);
  const stats = {
    mean:    avg(pp),
    median:  median(pp),
    stddev:  stdDev(pp),
    min:     pp.length ? Math.min(...pp) : 0,
    max:     pp.length ? Math.max(...pp) : 0,
    pctWHO:  pp.length ? (pp.filter(v => v > 15).length / pp.length * 100) : 0,
    pctCPCB: pp.length ? (pp.filter(v => v > 30).length / pp.length * 100) : 0,
    catDist: catDist(pp)
  };

  // Linear regression (trend)
  const reg = pp.length > 10
    ? linearRegression(pp.map((_, i) => i), pp)
    : { slope: 0, intercept: 0, r2: 0 };

  // Hourly pattern (average PM2.5 at each hour-of-day across 7 days)
  const hp = Array(24).fill(0).map((_, hr) => {
    const v = h.pm2_5.slice(0, 168).filter((_, i) => i % 24 === hr && h.pm2_5[i] !== null);
    return v.length ? avg(v) : 0;
  });

  // Correlation: PM2.5 vs Temperature (using raw unfiltered arrays for proper alignment)
  const t7 = wx.hourly.temperature_2m.slice(0, 168);
  const pm7raw = h.pm2_5.slice(0, 168);
  const pairs = pm7raw.map((pm, i) => ({ pm, t: t7[i] }))
    .filter(p => p.pm !== null && p.t !== null);
  const corr = pairs.length > 10
    ? pearsonR(pairs.map(p => p.pm), pairs.map(p => p.t))
    : 0;

  // Heatmap grid: 7 days × 24 hours
  const hg = Array(7).fill(null).map((_, d) =>
    Array(24).fill(null).map((_, hr) => h.pm2_5[d * 24 + hr])
  );

  // Source fingerprint
  const fp = classifySource({
    no2: no2a || 0, co: coa || 0, pm25: pm25a || 0,
    pm10: pm10a || 0, so2: so2a || 0, o3: o3a || 0
  });

  // Wind dispersion assessment
  const ws = wx.current.wind_speed_10m;
  const wd = ws > 20 ? 'excellent' : ws > 12 ? 'good' : ws > 6 ? 'moderate' : 'poor';

  // Null percentage (data quality)
  const np = (h.pm2_5.slice(0, 168).filter(v => v === null).length / 168) * 100;

  return {
    cityName, lat, lon,
    fetchTimestamp: new Date().toISOString(),
    dataSource: 'Copernicus CAMS via Open-Meteo',
    sparseWarning: np > 30, nullPct: np,
    indiaAQI, usAQI, whoExceedances: whoEx,
    pollutants: { pm25: pm25a, pm10: pm10a, no2: no2a, co: coa, o3: o3a, so2: so2a },
    stats, regression: reg, hourlyPattern: hp,
    correlation: corr, heatmapGrid: hg, fingerprint: fp,
    windSpeed: ws, windDispersion: wd,
    windDirection: wx.current.wind_direction_10m,
    temperature: wx.current.temperature_2m,
    humidity: wx.current.relative_humidity_2m,
    feelsLike: wx.current.apparent_temperature,
    weatherCode: wx.current.weather_code,
    rawHourly: {
      pm2_5: h.pm2_5, pm10: h.pm10,
      no2: h.nitrogen_dioxide, co: h.carbon_monoxide,
      o3: h.ozone, so2: h.sulphur_dioxide,
      time: h.time, temp: wx.hourly.temperature_2m
    },
    currentIdx: ci
  };
}

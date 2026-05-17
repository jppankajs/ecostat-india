/**
 * EcoStat — Math Utilities
 * Statistical functions, regression, and correlation
 */

/** Arithmetic mean */
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;

/** Median value */
const median = a => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Population standard deviation */
const stdDev = a => {
  const m = avg(a);
  return Math.sqrt(avg(a.map(x => (x - m) ** 2)));
};

/** Ordinary least-squares linear regression */
const linearRegression = (xs, ys) => {
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sx2 = xs.reduce((a, x) => a + x * x, 0);
  const sl = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  const ic = (sy - sl * sx) / n;
  const yH = xs.map(x => sl * x + ic);
  const sT = ys.reduce((a, y) => a + (y - avg(ys)) ** 2, 0);
  const sR = ys.reduce((a, y, i) => a + (y - yH[i]) ** 2, 0);
  return { slope: sl, intercept: ic, r2: Math.max(0, 1 - sR / sT) };
};

/** Pearson correlation coefficient */
const pearsonR = (xs, ys) => {
  const mx = avg(xs), my = avg(ys);
  const n = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
  const d = Math.sqrt(
    xs.reduce((a, x) => a + (x - mx) ** 2, 0) *
    ys.reduce((a, y) => a + (y - my) ** 2, 0)
  );
  return d === 0 ? 0 : n / d;
};

/** 24-hour rolling average (requires ≥12 non-null values) */
const get24hrAvg = (arr, ci) => {
  const s = arr.slice(Math.max(0, ci - 23), ci + 1)
    .filter(v => v !== null && !isNaN(v));
  return s.length < 12 ? null : avg(s);
};

/** CPCB category distribution (percentages) */
const catDist = pm => {
  const c = { good: 0, satisfactory: 0, moderate: 0, poor: 0, verypoor: 0, severe: 0 };
  pm.forEach(v => {
    if (v <= 30) c.good++;
    else if (v <= 60) c.satisfactory++;
    else if (v <= 90) c.moderate++;
    else if (v <= 120) c.poor++;
    else if (v <= 250) c.verypoor++;
    else c.severe++;
  });
  const t = pm.length;
  Object.keys(c).forEach(k => c[k] = c[k] / t * 100);
  return c;
};

/** Null-safe division (returns 0 for null numerator) */
const safeDiv = (a, b) => a !== null && a !== undefined ? a / b : 0;

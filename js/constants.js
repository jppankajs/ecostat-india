/**
 * EcoStat — Constants & Breakpoints
 * WHO 2021 Guidelines, CPCB NAQI, EPA 2024 AQI
 */

// WHO 2021 Air Quality Guidelines (24-hr means, μg/m³)
const WHO = {
  pm2_5: 15,
  pm10: 45,
  nitrogen_dioxide: 25,
  ozone: 100,           // 8-hr peak season mean
  sulphur_dioxide: 40,
  carbon_monoxide: 4000  // = 4 mg/m³
};

// India CPCB National AQI — PM2.5 breakpoints
// [PM_low, PM_high, AQI_low, AQI_high, Category, Color]
const CPCB_BP = [
  [0,      30,    0,   50,  'Good',          '#00e400'],
  [30.01,  60,    51,  100, 'Satisfactory',  '#92d14f'],
  [60.01,  90,    101, 200, 'Moderate',      '#ffff00'],
  [90.01,  120,   201, 300, 'Poor',          '#ff7e00'],
  [120.01, 250,   301, 400, 'Very Poor',     '#ff0000'],
  [250.01, 500,   401, 500, 'Severe',        '#7e0023']
];

// US EPA AQI — PM2.5 breakpoints (Revised Feb 2024, effective May 6 2024)
const EPA_BP = [
  [0,     9,     0,   50,  'Good',                  '#00e400'],
  [9.1,   35.4,  51,  100, 'Moderate',              '#ffff00'],
  [35.5,  55.4,  101, 150, 'Unhealthy (Sensitive)',  '#ff7e00'],
  [55.5,  125.4, 151, 200, 'Unhealthy',             '#ff0000'],
  [125.5, 225.4, 201, 300, 'Very Unhealthy',        '#9900cc'],
  [225.5, 500,   301, 500, 'Hazardous',             '#7e0023']
];

// Comparison chart city colors
const CITY_COLORS = ['#00e5a0', '#00c8e0', '#f59e0b'];

// Chart.js instance registry (for destroy-before-recreate)
const charts = {};

// State
let lastGeoTime = 0;
let currentData = null;
let compData = [];
let debounceTimer = null;

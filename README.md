# 🌿 EcoStat — Real-Time Environmental Analytics Dashboard

> A citizen-science environmental analytics tool that computes air quality under three simultaneous
> standards (India CPCB, US EPA 2024, WHO 2021) using live Copernicus CAMS satellite data for any
> city worldwide — with statistical analysis, pollutant source fingerprinting, and 8 chart types.
> Built as a portfolio project demonstrating data pipeline design, statistical computing, and
> real-time API integration without any framework or build tools.

Live air quality, AQI computation, and climate analytics powered by **Copernicus CAMS** satellite data via Open-Meteo.

## Features

- **Triple AQI Standard** — India CPCB, US EPA (2024 revised), WHO 2021
- **6 Pollutant Cards** — PM2.5, PM10, NO₂, CO, O₃, SO₂ with WHO comparison bars + sparklines
- **14-Day Pivot Chart** — Past + forecast with temperature overlay and regression trend
- **Pollutant Fingerprinting** — Source classification (traffic, industrial, construction, photochemical, biomass)
- **Statistical Summary** — Mean, median, std dev, threshold exceedance percentages
- **8 Chart Types** — Gauge, radar, heatmap, donut, histogram, scatter, comparison bars, trend overlay
- **Health Advisory Matrix** — 5 population groups × 3 pollutants with WHO-based thresholds
- **City Comparison** — Side-by-side analysis of up to 3 cities (4 tabs)
- **Global Climate Indicators** — CO₂, temperature anomaly, sea level, Arctic ice, forest cover, solar capacity
- **Methodology Modal** — Full data transparency with sources and limitations

## File Structure

```
ECOSTAT INDIA/
├── index.html          ← HTML skeleton (~160 lines)
├── css/
│   └── styles.css      ← Design system (~310 lines)
├── js/
│   ├── constants.js    ← WHO, CPCB, EPA breakpoints
│   ├── math.js         ← Statistical functions
│   ├── api.js          ← Geocoding, data fetch, processing
│   ├── charts.js       ← All Chart.js rendering
│   ├── ui.js           ← Search, compare, ticker, modal
│   └── app.js          ← Initialization & orchestration
├── METHODOLOGY.md      ← Full methodology & data transparency
└── README.md           ← This file
```

## Data Sources

| Data | Source | Type |
|------|--------|------|
| Air Quality | Copernicus CAMS via Open-Meteo | Live API |
| Weather | Open-Meteo Forecast API | Live API |
| Geocoding | Nominatim (OpenStreetMap) | Live API |
| CO₂ (421.08 ppm) | NOAA GML Mauna Loa 2023 | Static |
| Temp Anomaly (+1.47°C) | NASA GISS GISTEMP v4, 2024 | Static |
| Sea Level (3.7 mm/yr) | NOAA Satellite Altimetry 2024 | Static |
| Arctic Ice (4.28M km²) | NSIDC September 2024 | Static |
| India Forest (21.71%) | FSI SFR 2023 | Static |
| Solar (1.42 TW) | IRENA 2023 | Static |

## Deployment

Zero build step. Deploy to any static hosting:

```bash
# GitHub Pages — just push and enable Pages
git add .
git commit -m "deploy ecostat"
git push

# Or serve locally
npx serve .
```

## Tech Stack

- **HTML5** — Semantic structure
- **CSS3** — Custom properties, Grid, Flexbox
- **Vanilla JS** — No framework, no build tools
- **Chart.js 4.4.3** — Visualization (CDN)
- **Google Fonts** — Sora, Bebas Neue, IBM Plex Mono

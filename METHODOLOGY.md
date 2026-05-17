# EcoStat — Methodology & Data Transparency

> Every number shown in EcoStat has a source, a formula, and a known limitation.  
> This document explains all three — for every metric, every chart, every computation.

---

## 1. Air Quality Index (AQI) Computation

EcoStat computes AQI under **three simultaneous standards** using the same raw PM2.5 24-hour rolling average.

### 1.1 Raw Data Source
- **Provider:** Copernicus Atmosphere Monitoring Service (CAMS) via Open-Meteo Air Quality API  
- **Variable:** `pm2_5` (µg/m³, hourly resolution)  
- **Coverage:** Global, model-interpolated from satellite + ground station ensemble  
- **Latency:** ~1–3 hours behind real time  
- **Limitation:** In regions with sparse ground stations (rural India, NE states), values are model-only — no physical sensor. A sparse warning is shown when null% > 30%.

### 1.2 24-Hour Rolling Average
```
PM2.5_24hr = mean(hourly_PM2.5[t-23 : t])
Minimum valid hours required: 12 of 24 (else shown as null)
```
This matches CPCB's official 24-hour averaging period per NAQI Technical Document (2014).

### 1.3 India CPCB NAQI Formula
Linear interpolation within breakpoint sub-ranges:

```
AQI = ((AQI_high - AQI_low) / (BP_high - BP_low)) × (PM2.5 - BP_low) + AQI_low
```

**CPCB PM2.5 Breakpoints (NAQI 2014):**

| PM2.5 (µg/m³) | AQI Range | Category     |
|----------------|-----------|--------------|
| 0 – 30         | 0 – 50    | Good         |
| 30.1 – 60      | 51 – 100  | Satisfactory |
| 60.1 – 90      | 101 – 200 | Moderate     |
| 90.1 – 120     | 201 – 300 | Poor         |
| 120.1 – 250    | 301 – 400 | Very Poor    |
| 250.1 – 500    | 401 – 500 | Severe       |

Source: CPCB National Air Quality Index, Technical Document, November 2014.

### 1.4 US EPA AQI Formula
Same linear interpolation formula, different breakpoints.  
**EPA PM2.5 Breakpoints (Revised February 2024, effective May 6 2024):**

| PM2.5 (µg/m³) | AQI Range | Category                  |
|----------------|-----------|---------------------------|
| 0 – 9.0        | 0 – 50    | Good                      |
| 9.1 – 35.4     | 51 – 100  | Moderate                  |
| 35.5 – 55.4    | 101 – 150 | Unhealthy for Sensitive   |
| 55.5 – 125.4   | 151 – 200 | Unhealthy                 |
| 125.5 – 225.4  | 201 – 300 | Very Unhealthy            |
| 225.5 – 500    | 301 – 500 | Hazardous                 |

Source: US EPA, 40 CFR Part 50, National Ambient Air Quality Standards for PM2.5, February 2024 revision.

### 1.5 WHO 2021 Guideline (Not an AQI — an Exceedance Ratio)
WHO does not publish an AQI. EcoStat computes an **exceedance ratio**:

```
WHO_ratio = PM2.5_24hr / WHO_guideline_value
WHO PM2.5 guideline = 15 µg/m³ (24-hour mean, 2021 revision)
```

A ratio of 2.0 = air is 2× the WHO safe limit.  
Source: WHO Global Air Quality Guidelines 2021 (WHO/HEP/ECH/AQH/2021.1).

---

## 2. Pollutant Cards — All 6 Pollutants

| Pollutant | API Variable | Unit | WHO 24hr Guideline | Averaging |
|-----------|-------------|------|-------------------|-----------|
| PM2.5 | `pm2_5` | µg/m³ | 15 µg/m³ | 24-hr rolling |
| PM10 | `pm10` | µg/m³ | 45 µg/m³ | 24-hr rolling |
| NO₂ | `nitrogen_dioxide` | µg/m³ | 25 µg/m³ | 24-hr rolling |
| CO | `carbon_monoxide` | µg/m³ | 4,000 µg/m³ | 24-hr rolling |
| O₃ | `ozone` | µg/m³ | 100 µg/m³ | Peak season 8-hr |
| SO₂ | `sulphur_dioxide` | µg/m³ | 40 µg/m³ | 24-hr rolling |

WHO bar in each card = `pollutant_value / WHO_guideline × 100%` (capped at 200% for display).

---

## 3. Statistical Summary (7-Day)

All statistics computed on `pm2_5[0:167]` — the 168 past hourly values (7 days × 24 hours). Null values excluded before computation.

```
Mean   = Σ(values) / n
Median = middle value of sorted array (or mean of two middle values)
StdDev = sqrt( Σ(value - mean)² / n )   ← population standard deviation
Min    = min(values)
Max    = max(values)

% hours > WHO limit  = count(pm2_5 > 15) / n × 100
% hours > CPCB Good = count(pm2_5 > 30) / n × 100
```

---

## 4. Linear Regression Trend

Ordinary Least Squares (OLS) on the 7-day PM2.5 hourly series:

```
slope     = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²)
intercept = (Σy − slope·Σx) / n
R²        = 1 − (Σ(y − ŷ)²) / (Σ(y − ȳ)²)

x = hour index (0, 1, 2 ... 167)
y = PM2.5 value
```

- **Positive slope** → PM2.5 trending upward over the week  
- **R² > 0.5** → trend is statistically meaningful  
- **R² < 0.2** → high variability, trend not reliable

---

## 5. Pearson Correlation — PM2.5 vs Temperature

```
r = Σ((x - x̄)(y - ȳ)) / sqrt( Σ(x - x̄)² · Σ(y - ȳ)² )

x = PM2.5 hourly values (7 days)
y = Temperature hourly values (7 days, Open-Meteo forecast API)
```

Interpretation:
- `r < -0.3` → temperature rise disperses pollution (typical daytime convection)  
- `r > +0.3` → temperature and pollution co-rise (winter inversion trap)  
- `-0.3 to +0.3` → no significant correlation

---

## 6. Pollutant Source Fingerprinting

Rule-based heuristic scoring system. Each source accumulates a score based on pollutant ratios:

```
PM ratio = PM2.5 / PM10   (fine-to-coarse ratio)

Traffic score      = (NO₂ > 40: +3) + (CO > 1000: +3) + (PM_ratio > 0.6: +2)
Industrial score   = (SO₂ > 50: +4) + (PM10 > 100: +2) + (PM_ratio < 0.4: +2)
Construction score = (PM10 > 150: +4) + (PM_ratio < 0.3: +3) + (SO₂ < 20: +1)
Photochemical score= (O₃ > 80: +4) + (NO₂ < 20: +2)
Biomass score      = (PM2.5 > 60: +2) + (CO > 2000: +3) + (SO₂ < 15: +2)

Winner = highest score
Confidence: score ≥ 6 → High | score ≥ 3 → Moderate | else → Low
```

**Limitation:** This is a statistical heuristic, not chemical speciation analysis. It approximates source contribution — not a substitute for receptor modeling (CMB or PMF).  
Reference: EPA Air Quality Monitoring Guide + WHO Pollution Source Attribution Framework.

---

## 7. 24-Hour Hourly Pattern (Peak Hour Analysis)

```
For each hour-of-day h (0–23):
  pattern[h] = mean( PM2.5[i] for all i where i % 24 == h, across 7 days )
```

Produces a representative "average day" profile from the past week. Used in the histogram chart to identify peak pollution hours.

---

## 8. 14-Day Pivot Chart

- **Past 7 days (solid line):** Actual Copernicus CAMS hourly PM2.5 values  
- **Next 7 days (dashed line):** CAMS forecast PM2.5 values  
- **Regression overlay:** OLS trend line extended across all 14 days  
- **Temperature overlay:** Secondary axis, Open-Meteo `temperature_2m`  
- **Pivot point:** Current hour — where past ends and forecast begins

---

## 9. Heatmap — 7 Days × 24 Hours

Grid structure:
```
heatmap[day][hour] = pm2_5[day * 24 + hour]
```
Color scale: WHO guideline (15 µg/m³) = midpoint. Values normalized per-cell.  
Days shown as: Mon–Sun (or D-6 to Today depending on fetch date).

---

## 10. Health Advisory Matrix

Five population groups × three pollutants. Thresholds:

| Group | PM2.5 Risk Threshold | NO₂ Risk | O₃ Risk |
|-------|---------------------|----------|---------|
| Healthy Adults | > 55 µg/m³ | > 200 µg/m³ | > 180 µg/m³ |
| Children | > 25 µg/m³ | > 100 µg/m³ | > 120 µg/m³ |
| Elderly | > 25 µg/m³ | > 100 µg/m³ | > 120 µg/m³ |
| Respiratory Conditions | > 15 µg/m³ | > 40 µg/m³ | > 100 µg/m³ |
| Cardiovascular Conditions | > 15 µg/m³ | > 40 µg/m³ | > 100 µg/m³ |

Source: WHO 2021 Air Quality Guidelines + ERS (European Respiratory Society) clinical thresholds.

---

## 11. Global Climate Indicators — Static Verified Data

These are **not computed** — they are authoritative published values embedded at build time:

| Metric | Value | Source | Year |
|--------|-------|--------|------|
| CO₂ Concentration | 421 ppm | NOAA GML, Mauna Loa Observatory | 2024 annual mean |
| Global Temp Anomaly | +1.48°C | NASA GISS GISTEMP v4, land-ocean index vs 1951–1980 | 2024 |
| Sea Level Rise Rate | 3.6 mm/yr | NOAA / University of Colorado Sea Level Research Group | 2024 |
| Arctic Sea Ice | −13%/decade | NSIDC, September minimum extent | 1979–2024 |
| India Forest Cover | 21.71% | Forest Survey of India, State of Forest Report 2023 | 2023 |
| Global Solar Capacity | 1.5+ TW | IRENA, World Energy Transitions Outlook | 2024 |

---

## 12. Data Caching

```
Cache key   : "ecostat_{lat2dp}_{lon2dp}"   (2 decimal places)
Storage     : sessionStorage (browser tab only)
Expiry      : 30 minutes from fetch timestamp
Behaviour   : Expired or missing → fresh API call
              Valid cache hit → no API call, instant render
```

---

## 13. Known Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| CAMS is model-interpolated, not sensor-direct | ±20–40% error in data-sparse regions | Sparse warning shown |
| 24-hr average lags real-time by up to 3 hours | Current hour AQI may not reflect last 3 hours | Fetch timestamp shown |
| Fingerprinting is heuristic, not chemical speciation | Source identification ≈ not exact | Confidence level shown |
| WHO O₃ guideline is 8-hr peak season, not 24-hr | O₃ comparison is approximate | Note shown in card |
| Nominatim rate limit: 1 request/second | Rapid typing may hit limit | 1-second debounce applied |
| SessionStorage cleared on tab close | Re-fetch required on new session | By design |

---

## 14. References

1. CPCB (2014). National Air Quality Index — Technical Document. Central Pollution Control Board, India.
2. US EPA (2024). Revisions to the National Ambient Air Quality Standards for Particulate Matter. 40 CFR Part 50.
3. WHO (2021). Global Air Quality Guidelines. World Health Organization. WHO/HEP/ECH/AQH/2021.1.
4. NASA GISS (2024). GISS Surface Temperature Analysis (GISTEMP), Version 4. NASA Goddard Institute for Space Studies.
5. NOAA GML (2024). Trends in Atmospheric Carbon Dioxide. Global Monitoring Laboratory, Mauna Loa Observatory.
6. NOAA (2024). Laboratory for Satellite Altimetry — Sea Level Rise. National Oceanic and Atmospheric Administration.
7. NSIDC (2024). Sea Ice Index, Version 3. National Snow and Ice Data Center, Boulder, Colorado.
8. FSI (2023). India State of Forest Report 2023. Forest Survey of India, Dehradun.
9. IRENA (2024). World Energy Transitions Outlook 2024. International Renewable Energy Agency.
10. Open-Meteo (2024). Air Quality API Documentation. https://open-meteo.com/en/docs/air-quality-api
11. Copernicus CAMS (2024). Global Atmospheric Composition Forecasts. European Centre for Medium-Range Weather Forecasts.

---

*EcoStat Methodology v1.0 .
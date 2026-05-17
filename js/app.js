/**
 * EcoStat — Application Entry Point
 * Dashboard orchestration and initialization
 */

// ═══ RENDER DASHBOARD ═══

function renderDashboard(d) {
  currentData = d;
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('fetchTs').textContent = new Date(d.fetchTimestamp).toLocaleTimeString();

  if (d.sparseWarning) {
    document.getElementById('sparseBanner').style.display = 'block';
    document.getElementById('sparseBanner').textContent =
      `⚠ Sparse sensor coverage (${d.nullPct.toFixed(0)}% null). Data from Copernicus CAMS model interpolation only.`;
  } else {
    document.getElementById('sparseBanner').style.display = 'none';
  }

  // Render all dashboard modules
  renderGauge(d);
  renderStdCards(d);
  renderPollCards(d);
  renderStats(d);
  renderPivotChart(d);
  renderFingerprint(d);
  renderRadar(d);
  renderHeatmap(d);
  renderDonut(d);
  renderHistogram(d);
  renderScatter(d);
  renderHealth(d);
  renderWeather(d);
  updateTicker(d);
}

// ═══ INITIALIZATION ═══

// Boot ticker with static data
updateTicker(null);

// Render global climate indicators
renderGlobalIndicators();

// Auto-load Bengaluru on start
(async () => {
  try {
    showLoading();
    setLoadStep(1);
    searchInput.value = 'Bengaluru';
    setLoadStep(2);
    const d = await fetchCityData(12.97, 77.59, 'Bengaluru');
    setLoadStep(3);
    renderDashboard(d);
    setLoadStep(4);
    setTimeout(hideLoading, 500);
  } catch (e) {
    hideLoading();
    console.error(e);
  }
})();

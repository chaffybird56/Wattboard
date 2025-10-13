async function fetchJSON(url) {
  const res = await fetch(url);
  return await res.json();
}

function lineChart(ctx, labels, datasetLabel, data) {
  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: datasetLabel, data, tension: 0.25 }] },
    options: {
      responsive: true,
      scales: { x: { ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true } }
    }
  });
}

function barChart(ctx, labels, datasetLabel, data) {
  return new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: datasetLabel, data }] },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}

async function load() {
  const ts = await fetchJSON('/api/timeseries?hours=24');
  const labels = ts.series.map(p => new Date(p.t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}));
  const kw = ts.series.map(p => p.kw);
  const volts = ts.series.map(p => p.volts);

  const kwCtx = document.getElementById('kwChart').getContext('2d');
  const voltsCtx = document.getElementById('voltsChart').getContext('2d');
  lineChart(kwCtx, labels, 'kW', kw);
  lineChart(voltsCtx, labels, 'Volts', volts);

  if (ts.peak) {
    const el = document.getElementById('peakBox');
    const when = new Date(ts.peak.ts).toLocaleString();
    el.textContent = `Peak: ${ts.peak.kw.toFixed(1)} kW @ ${when}`;
  }

  const daily = await fetchJSON('/api/daily?days=14');
  const sums = {};
  daily.forEach(d => { sums[d.date] = (sums[d.date] || 0) + (d.kwh || 0); });
  const dLabels = Object.keys(sums);
  const kwh = Object.values(sums).map(v => +v.toFixed(2));
  const dailyCtx = document.getElementById('dailyKwhChart').getContext('2d');
  barChart(dailyCtx, dLabels, 'kWh (sum)', kwh);
}
load();
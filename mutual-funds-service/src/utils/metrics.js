export function cagrFromDates(startNav, endNav, years) {
  if (!startNav || !endNav || startNav <= 0 || years <= 0) return null;
  return Math.pow(Number(endNav) / Number(startNav), 1 / years) - 1;
}

export function dailyReturns(navs) {
  // navs: [{ date, nav }] oldest -> newest
  const returns = [];
  for (let i = 1; i < navs.length; i++) {
    const prev = Number(navs[i - 1].nav);
    const curr = Number(navs[i].nav);
    if (prev > 0 && isFinite(prev) && isFinite(curr)) {
      returns.push((curr - prev) / prev);
    }
  }
  return returns;
}

export function stddevSample(arr) {
  if (!arr || arr.length < 2) return null;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

export function annualizedVolatilityFromSeries(navs) {
  const rets = dailyReturns(navs);
  const sd = stddevSample(rets);
  if (sd == null) return null;
  return sd * Math.sqrt(252); // ~trading days/year
}

export function riskLabelFromVol(vol) {
  if (vol == null) return 'Unknown';
  if (vol < 0.12) return 'Low';
  if (vol < 0.18) return 'Moderate';
  if (vol < 0.24) return 'High';
  return 'Very High';
}

export function percentileRank(value, sortedAsc) {
  if (!sortedAsc || !sortedAsc.length) return null;
  let i = 0;
  while (i < sortedAsc.length && sortedAsc[i] <= value) i++;
  return i / sortedAsc.length; // 0..1
}

export function starsFromPercentile(p) {
  if (p == null) return null;
  if (p >= 0.8) return 5;
  if (p >= 0.6) return 4;
  if (p >= 0.4) return 3;
  if (p >= 0.2) return 2;
  return 1;
}
'use strict';

/* ===== STATE ===== */
let carData      = null;   // last API response
let selectedType = 'brukt'; // 'ny' | 'brukt'

/* ===== HELPERS ===== */
const $ = id => document.getElementById(id);

function formatNOK(amount) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency', currency: 'NOK', maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

// Monthly annuity payment
function monthlyPayment(principal, annualPct, years) {
  if (principal <= 0) return 0;
  if (annualPct === 0) return principal / (years * 12);
  const r = annualPct / 100 / 12;
  const n = years * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function estimateInsurance(price) {
  // Comprehensive (kasko) insurance in Norway ~1.5–2 % of car value per year
  return Math.round(Math.max(1200, Math.min(5500, price * 0.018 / 12)));
}

function estimateFuel(price, modelName) {
  const m = (modelName || '').toLowerCase();
  const isEV = /tesla|ioniq|leaf|id\.|ev6|zoe|polestar|enyaq|mach-e|niro ev|i4|e-tron|bz4x|atto|mg4/.test(m);
  return isEV ? 700 : 1600;
}

function estimateService(price) {
  // ~1.5 % of car value per year
  return Math.round(Math.max(350, Math.min(2200, price * 0.015 / 12)));
}

/* ===== DOWN-PAYMENT ADVICE ===== */
function dpAdvice(carPrice, savings) {
  const rec = Math.round(carPrice * 0.20); // 20 %
  const min = Math.round(carPrice * 0.15); // 15 %
  const dp  = Math.min(savings, carPrice);

  if (savings >= carPrice) {
    return {
      status: 'good', icon: '🎉',
      title: 'Du kan kjøpe bilen kontant!',
      text:  `Du har spart nok til å kjøpe bilen uten lån. Kontantkjøp sparer deg for alle rentekostnader.`,
      dp, rec,
    };
  }
  if (savings >= rec) {
    return {
      status: 'good', icon: '✅',
      title: 'Utmerket egenandel',
      text:  `Du oppfyller anbefalt 20 % egenandel (${formatNOK(rec)}). Dette gir deg de beste lånebetingelsene og lavest rente.`,
      dp, rec,
    };
  }
  if (savings >= min) {
    return {
      status: 'ok', icon: '⚠️',
      title: 'Akseptabel egenandel',
      text:  `Du har ${formatNOK(savings)} spart. Anbefalt egenandel er ${formatNOK(rec)} (20 %). Spar ${formatNOK(rec - savings)} mer for å oppnå de beste betingelsene.`,
      dp, rec,
    };
  }
  return {
    status: 'bad', icon: '❗',
    title: 'For lav egenandel',
    text:  `De fleste norske banker krever minst 15 % egenandel (${formatNOK(min)}). Du mangler ${formatNOK(min - savings)}. Anbefalt er 20 % (${formatNOK(rec)}).`,
    dp, rec,
  };
}

/* ===== SEARCH ===== */
async function searchCar(model) {
  $('loading').classList.remove('hidden');
  $('results').classList.add('hidden');
  $('loading').scrollIntoView({ behavior: 'smooth', block: 'center' });

  try {
    const res = await fetch(`/api/search?model=${encodeURIComponent(model)}`);
    if (!res.ok) throw new Error('Feil ved søk');
    carData = await res.json();
    renderResults(carData);
  } catch (err) {
    console.error(err);
    alert('Beklager – kunne ikke hente prisdata akkurat nå. Prøv igjen om litt.');
  } finally {
    $('loading').classList.add('hidden');
  }
}

function renderResults(data) {
  $('results').classList.remove('hidden');
  $('results-model-name').textContent = data.model;

  // Source badge
  const badge = $('data-source-badge');
  if (data.source === 'finn') {
    badge.textContent = 'Hentet fra finn.no';
    badge.className = 'badge badge--finn';
  } else {
    badge.textContent = 'Estimerte markedspriser';
    badge.className = 'badge badge--estimate';
  }

  // New prices
  if (data.ny) {
    $('new-price-avg').textContent   = formatNOK(data.ny.avg);
    $('new-price-range').textContent = `Fra ${formatNOK(data.ny.min)} til ${formatNOK(data.ny.max)}`;
  }
  // Used prices
  if (data.brukt) {
    $('used-price-avg').textContent   = formatNOK(data.brukt.avg);
    $('used-price-range').textContent = `Fra ${formatNOK(data.brukt.min)} til ${formatNOK(data.brukt.max)}`;
  }

  // Finn links
  if (data.finnLinks) {
    $('new-finn-link').href  = data.finnLinks.ny;
    $('used-finn-link').href = data.finnLinks.brukt;
  }

  // Reset calc results
  $('calc-results').classList.add('hidden');
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===== CALCULATE ===== */
function calculate() {
  if (!carData) { alert('Søk etter en bilmodell først!'); return; }

  const salary   = parseFloat($('salary').value)        || 0;
  const savings  = parseFloat($('savings').value)       || 0;
  const years    = parseInt($('loan-term').value)       || 5;
  const ratePct  = parseFloat($('interest-rate').value) || 8.5;

  const priceObj = selectedType === 'ny' ? carData.ny : carData.brukt;
  if (!priceObj) { alert('Prisdata ikke tilgjengelig for valgt biltype.'); return; }
  const carPrice = priceObj.avg;

  // Loan
  const advice      = dpAdvice(carPrice, savings);
  const downPayment = advice.dp;
  const principal   = Math.max(0, carPrice - downPayment);
  const loanPay     = monthlyPayment(principal, ratePct, years);

  // Other monthly costs
  const insurance   = estimateInsurance(carPrice);
  const fuel        = estimateFuel(carPrice, carData.model);
  const service     = estimateService(carPrice);
  const total       = loanPay + insurance + fuel + service;

  // Total loan cost
  const totalPaid    = loanPay * years * 12;
  const totalInterest = Math.max(0, totalPaid - principal);

  // Financial health: car cost should be ≤ 15–20 % of net income
  // Rough net: brutto × 0.66 (35 % tax rate is typical in Norway)
  const netIncome = salary * 0.66;
  const ratio     = netIncome > 0 ? (total / netIncome) * 100 : 999;

  let healthClass, healthLabel, healthMsg;
  if (ratio <= 15) {
    healthClass = ''; healthLabel = 'God økonomi 👍';
    healthMsg = `Bilkostnaden utgjør ${ratio.toFixed(1)} % av nettoinntekten din – innenfor anbefalt grense på 15 %.`;
  } else if (ratio <= 22) {
    healthClass = 'health-bar--ok'; healthLabel = 'Akseptabelt ⚠️';
    healthMsg = `Bilkostnaden utgjør ${ratio.toFixed(1)} % av nettoinntekten din. Litt høyt – vurder høyere egenandel eller lengre nedbetalingstid.`;
  } else {
    healthClass = 'health-bar--bad'; healthLabel = 'For høyt ❗';
    healthMsg = `Bilkostnaden utgjør ${ratio.toFixed(1)} % av nettoinntekten din. Dette er for mye. Vurder en rimeligere bil, høyere egenandel eller lengre nedbetalingstid.`;
  }
  const barWidth = Math.max(4, Math.min(100, ((30 - ratio) / 30) * 100));

  /* ——— Update DOM ——— */

  // Advice card
  const adviceCard = $('down-payment-card');
  adviceCard.className = `advice-card advice-card--${advice.status}`;
  $('advice-icon').textContent = advice.icon;
  $('advice-title').textContent = advice.title;
  $('advice-text').textContent  = advice.text;
  $('your-down-payment').textContent   = formatNOK(downPayment);
  $('recommended-dp').textContent      = formatNOK(advice.rec);
  $('loan-amount').textContent         = formatNOK(principal);

  // Breakdown
  $('monthly-loan').textContent      = formatNOK(loanPay);
  $('monthly-insurance').textContent = formatNOK(insurance);
  $('monthly-fuel').textContent      = formatNOK(fuel);
  $('monthly-service').textContent   = formatNOK(service);
  $('monthly-total').textContent     = formatNOK(total);

  // Health
  const bar = $('health-bar');
  bar.style.width = barWidth + '%';
  bar.className   = `health-bar ${healthClass}`;
  const hBadge  = $('health-badge');
  hBadge.textContent = healthLabel;
  hBadge.className   = `badge badge--${ratio <= 15 ? 'good' : ratio <= 22 ? 'ok' : 'bad'}`;
  $('health-msg').textContent = healthMsg;

  // Totals
  $('total-paid').textContent     = formatNOK(totalPaid + downPayment);
  $('total-interest').textContent = formatNOK(totalInterest);

  // Show
  const cr = $('calc-results');
  cr.classList.remove('hidden');
  cr.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===== EVENT WIRING ===== */

// Search form
$('search-form').addEventListener('submit', e => {
  e.preventDefault();
  const val = $('car-input').value.trim();
  if (val.length >= 2) searchCar(val);
});

// Popular tags
document.querySelectorAll('.popular__tag').forEach(btn => {
  btn.addEventListener('click', () => {
    const model = btn.dataset.model;
    $('car-input').value = model;
    searchCar(model);
  });
});

// Car type toggles
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach(b => {
      b.classList.remove('toggle-btn--active');
    });
    btn.classList.add('toggle-btn--active');
    selectedType = btn.dataset.type;
  });
});

// Calculate button
$('calculate-btn').addEventListener('click', calculate);

// Allow Enter in number inputs to trigger calc
['salary','savings','interest-rate'].forEach(id => {
  $(id).addEventListener('keydown', e => { if (e.key === 'Enter') calculate(); });
});

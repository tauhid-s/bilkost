'use strict';

/* ===== STATE ===== */
let carPrice     = 0;       // currently active price for calculator
let carModel     = '';      // display name
let carTypeFixed = null;    // 'ny' | 'brukt' | null (null = let user pick)
let selectedType = 'brukt'; // current toggle selection (model-search mode)
let currentMode  = 'url';   // 'url' | 'search'

/* ===== HELPERS ===== */
const $ = id => document.getElementById(id);

function formatNOK(n) {
  return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Math.round(n));
}

function monthlyPayment(principal, annualPct, years) {
  if (principal <= 0) return 0;
  if (annualPct === 0) return principal / (years * 12);
  const r = annualPct / 100 / 12, n = years * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function estimateInsurance(price) {
  return Math.round(Math.max(1200, Math.min(5500, price * 0.018 / 12)));
}

function estimateFuel(price, name) {
  const m = (name || '').toLowerCase();
  const isEV = /tesla|ioniq|leaf|id\.|ev6|zoe|polestar|enyaq|mach-e|niro ev|i4|e-tron|bz4x|atto|mg4/.test(m);
  return isEV ? 700 : 1600;
}

function estimateService(price) {
  return Math.round(Math.max(350, Math.min(2200, price * 0.015 / 12)));
}

function dpAdvice(price, savings) {
  const rec = Math.round(price * 0.20);
  const min = Math.round(price * 0.15);
  const dp  = Math.min(savings, price);
  if (savings >= price)
    return { status: 'good', icon: '🎉', title: 'Du kan kjøpe bilen kontant!',
             text: `Du har spart nok til å kjøpe bilen uten lån. Kontantkjøp sparer deg for alle rentekostnader.`, dp, rec };
  if (savings >= rec)
    return { status: 'good', icon: '✅', title: 'Utmerket egenandel',
             text: `Du oppfyller anbefalt 20 % egenandel (${formatNOK(rec)}). Dette gir deg de beste lånebetingelsene.`, dp, rec };
  if (savings >= min)
    return { status: 'ok', icon: '⚠️', title: 'Akseptabel egenandel',
             text: `Du har ${formatNOK(savings)} spart. Anbefalt egenandel er ${formatNOK(rec)} (20 %). Spar ${formatNOK(rec - savings)} mer for de beste betingelsene.`, dp, rec };
  return { status: 'bad', icon: '❗', title: 'For lav egenandel',
           text: `De fleste banker krever minst 15 % (${formatNOK(min)}). Du mangler ${formatNOK(min - savings)}. Anbefalt er 20 % (${formatNOK(rec)}).`, dp, rec };
}

/* ===== FINN.NO URL VALIDATION (client-side pre-check) ===== */
function isValidFinnUrl(url) {
  try {
    const u = new URL(url.trim());
    return ['www.finn.no', 'finn.no'].includes(u.hostname) && /\/(car|mobility)\//i.test(u.pathname);
  } catch { return false; }
}

/* ===== UI HELPERS ===== */
function showLoading(msg) {
  $('loading-msg').textContent = msg || 'Henter data…';
  $('loading').classList.remove('hidden');
  $('results').classList.add('hidden');
  hideError();
  $('loading').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function hideLoading() { $('loading').classList.add('hidden'); }

function showError(title, msg, showManual = false) {
  $('error-title').textContent = title;
  $('error-msg').textContent   = msg;
  $('error-banner').classList.remove('hidden');
  $('manual-price-section').classList.toggle('hidden', !showManual);
  $('error-banner').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function hideError() {
  $('error-banner').classList.add('hidden');
  $('manual-price-section').classList.add('hidden');
}

function setCarData(price, model, type) {
  carPrice     = price;
  carModel     = model;
  carTypeFixed = type; // null means user can toggle
  $('calc-results').classList.add('hidden');
  // Show/hide car type toggle
  $('car-type-row').classList.toggle('hidden', type !== null);
  // Show financing CTA as soon as we have a car price
  const cta = $('finance-cta');
  if (price > 0) {
    $('finance-cta-link').href = 'https://www.finn.no/okonomi';
    cta.classList.remove('hidden');
  } else {
    cta.classList.add('hidden');
  }
}

/* ===== MODE TABS ===== */
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => {
      t.classList.remove('mode-tab--active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('mode-tab--active');
    tab.setAttribute('aria-selected', 'true');
    currentMode = tab.dataset.mode;
    $('panel-url').classList.toggle('hidden', currentMode !== 'url');
    $('panel-search').classList.toggle('hidden', currentMode !== 'search');
  });
});

/* ===== URL FETCH ===== */
$('url-form').addEventListener('submit', async e => {
  e.preventDefault();
  const url = $('url-input').value.trim();
  if (!url) return;
  if (!isValidFinnUrl(url)) {
    showError('Ugyldig finn.no-lenke',
      'Lenken ser ikke ut til å peke på en bilannonse. Eksempel: https://www.finn.no/car/used/ad.html?finnkode=XXXXXXX');
    return;
  }
  await fetchFinnUrl(url);
});

async function fetchFinnUrl(url) {
  showLoading('Henter bildata fra finn.no…');
  try {
    const res = await fetch(`/api/finn?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    hideLoading();

    if (!res.ok) {
      const canManual = data.error === 'BLOCKED' || data.error === 'FETCH_FAILED' || data.error === 'NO_PRICE';
      showError(errorTitle(data.error), data.message, canManual);
      return;
    }

    hideError();
    renderFinnListing(data);
  } catch (err) {
    hideLoading();
    showError('Nettverksfeil', 'Kunne ikke nå serveren. Sjekk internettforbindelsen og prøv igjen.', true);
  }
}

function errorTitle(code) {
  return { INVALID_URL: 'Ugyldig lenke', BLOCKED: 'Tilgang nektet av finn.no', NO_PRICE: 'Pris ikke funnet', FETCH_FAILED: 'Henting feilet' }[code] || 'Feil';
}

function renderFinnListing(data) {
  setCarData(data.price, data.title, data.type);

  // Header
  $('results-eyebrow').textContent = 'Annonse fra finn.no';
  $('results-model-name').textContent = data.title;
  const badge = $('data-source-badge');
  badge.textContent = data.type === 'ny' ? 'Ny bil' : 'Brukt bil';
  badge.className   = `badge badge--${data.type}`;

  // Listing card
  $('listing-card').classList.remove('hidden');
  $('price-cards').classList.add('hidden');

  // Meta badges
  const metaEl = $('listing-meta');
  metaEl.innerHTML = '';
  const typeBadge = document.createElement('span');
  typeBadge.className = `badge badge--${data.type}`;
  typeBadge.textContent = data.type === 'ny' ? 'Ny bil' : 'Brukt bil';
  metaEl.appendChild(typeBadge);
  if (data.year) {
    const yb = document.createElement('span');
    yb.className = 'badge badge--estimate'; yb.textContent = data.year;
    metaEl.appendChild(yb);
  }

  $('listing-title').textContent = data.title;
  $('listing-price').textContent = formatNOK(data.price);

  // Stats sidebar
  const statsEl = $('listing-stats');
  statsEl.innerHTML = '';
  const statsData = [];
  if (data.mileage) statsData.push(['Kjørelengde', Number(data.mileage).toLocaleString('nb-NO') + ' km']);
  if (data.year)    statsData.push(['Årsmodell',   data.year]);
  if (data.make)    statsData.push(['Merke',        data.make]);
  if (data.model)   statsData.push(['Modell',       data.model]);
  statsData.forEach(([label, value]) => {
    statsEl.innerHTML += `<div class="listing-stat"><div class="listing-stat__label">${label}</div><div class="listing-stat__value">${value}</div></div>`;
  });
  if (!statsData.length) statsEl.style.display = 'none';

  // Links
  $('listing-finn-link').href = data.url;

  // Finance link in card footer (only for used cars)
  const financeLink = $('listing-finance-link');
  financeLink.classList.toggle('hidden', data.type === 'ny');
  if (data.type === 'brukt') {
    financeLink.href = 'https://www.finn.no/okonomi';
  }

  $('results').classList.remove('hidden');
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===== MODEL SEARCH ===== */
$('search-form').addEventListener('submit', e => {
  e.preventDefault();
  const val = $('car-input').value.trim();
  if (val.length >= 2) searchModel(val);
});

document.querySelectorAll('.popular__tag').forEach(btn => {
  btn.addEventListener('click', () => {
    $('car-input').value = btn.dataset.model;
    // Switch to search tab first
    document.querySelector('[data-mode="search"]').click();
    searchModel(btn.dataset.model);
  });
});

async function searchModel(model) {
  showLoading('Søker etter priser…');
  try {
    const res  = await fetch(`/api/search?model=${encodeURIComponent(model)}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    hideLoading();
    hideError();
    renderModelResults(data);
  } catch {
    hideLoading();
    showError('Søkefeil', 'Kunne ikke hente prisdata akkurat nå. Prøv igjen.');
  }
}

function renderModelResults(data) {
  // In model mode carTypeFixed=null, let user choose
  setCarData(
    selectedType === 'ny' ? data.ny?.avg : data.brukt?.avg,
    data.model,
    null
  );

  $('results-eyebrow').textContent = 'Prisresultater';
  $('results-model-name').textContent = data.model;
  const badge = $('data-source-badge');
  badge.textContent = data.source === 'finn' ? 'Hentet fra finn.no' : 'Estimerte markedspriser';
  badge.className   = `badge badge--${data.source === 'finn' ? 'finn' : 'estimate'}`;

  $('listing-card').classList.add('hidden');
  $('price-cards').classList.remove('hidden');

  if (data.ny) {
    $('new-price-avg').textContent   = formatNOK(data.ny.avg);
    $('new-price-range').textContent = `Fra ${formatNOK(data.ny.min)} til ${formatNOK(data.ny.max)}`;
  }
  if (data.brukt) {
    $('used-price-avg').textContent   = formatNOK(data.brukt.avg);
    $('used-price-range').textContent = `Fra ${formatNOK(data.brukt.min)} til ${formatNOK(data.brukt.max)}`;
  }
  if (data.finnLinks) {
    $('new-finn-link').href  = data.finnLinks.ny;
    $('used-finn-link').href = data.finnLinks.brukt;
  }

  $('results').classList.remove('hidden');
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===== MANUAL PRICE FALLBACK ===== */
let manualType = 'brukt';

document.querySelectorAll('#manual-btn-brukt, #manual-btn-ny').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#manual-btn-brukt, #manual-btn-ny').forEach(b => b.classList.remove('toggle-btn--active'));
    btn.classList.add('toggle-btn--active');
    manualType = btn.dataset.type;
  });
});

$('manual-price-btn').addEventListener('click', () => {
  const val = parseFloat($('manual-price-input').value);
  if (!val || val < 10000) { alert('Skriv inn en gyldig pris (minimum 10 000 kr)'); return; }
  hideError();
  setCarData(val, 'Bil (manuell pris)', manualType);
  $('results-eyebrow').textContent    = 'Manuell pris';
  $('results-model-name').textContent = `Bil – ${formatNOK(val)}`;
  const badge = $('data-source-badge');
  badge.textContent = manualType === 'ny' ? 'Ny bil' : 'Brukt bil';
  badge.className   = `badge badge--${manualType}`;
  $('listing-card').classList.add('hidden');
  $('price-cards').classList.add('hidden');
  $('results').classList.remove('hidden');
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ===== CAR TYPE TOGGLES (model-search mode) ===== */
document.querySelectorAll('.toggle-btn[data-type]').forEach(btn => {
  if (btn.id === 'manual-btn-brukt' || btn.id === 'manual-btn-ny') return;
  btn.addEventListener('click', () => {
    document.querySelectorAll('#btn-brukt, #btn-ny').forEach(b => b.classList.remove('toggle-btn--active'));
    btn.classList.add('toggle-btn--active');
    selectedType = btn.dataset.type;
  });
});

/* ===== CALCULATE ===== */
$('calculate-btn').addEventListener('click', calculate);
['salary', 'savings', 'interest-rate'].forEach(id => {
  $(id).addEventListener('keydown', e => { if (e.key === 'Enter') calculate(); });
});

function getActivePrice() {
  if (carTypeFixed) return carPrice; // fixed from listing
  // model-search: pick from selected toggle
  return carPrice; // already updated on toggle via renderModelResults
}

function calculate() {
  if (!carPrice || carPrice < 1000) { alert('Søk etter eller hent en bil først!'); return; }

  const salary  = parseFloat($('salary').value)        || 0;
  const savings = parseFloat($('savings').value)       || 0;
  const years   = parseInt($('loan-term').value)       || 5;
  const rate    = parseFloat($('interest-rate').value) || 8.5;

  // If model-search mode, re-read price for selected type
  const effectiveType = carTypeFixed || selectedType;

  const advice    = dpAdvice(carPrice, savings);
  const dp        = advice.dp;
  const principal = Math.max(0, carPrice - dp);
  const loanPay   = monthlyPayment(principal, rate, years);

  const insurance = estimateInsurance(carPrice);
  const fuel      = estimateFuel(carPrice, carModel);
  const service   = estimateService(carPrice);
  const total     = loanPay + insurance + fuel + service;

  const totalPaid    = loanPay * years * 12;
  const totalInterest = Math.max(0, totalPaid - principal);

  const netIncome = salary * 0.66;
  const ratio     = netIncome > 0 ? (total / netIncome) * 100 : 999;

  let hClass, hLabel, hMsg;
  if (ratio <= 15)      { hClass = '';             hLabel = 'God økonomi 👍';    hMsg = `Bilkostnaden utgjør ${ratio.toFixed(1)} % av nettoinntekten din – innenfor anbefalt grense på 15 %.`; }
  else if (ratio <= 22) { hClass = 'health-bar--ok';  hLabel = 'Akseptabelt ⚠️';  hMsg = `Bilkostnaden utgjør ${ratio.toFixed(1)} % av nettoinntekten din. Litt høyt – vurder høyere egenandel eller lengre løpetid.`; }
  else                  { hClass = 'health-bar--bad'; hLabel = 'For høyt ❗';       hMsg = `Bilkostnaden utgjør ${ratio.toFixed(1)} % av nettoinntekten din. Vurder en rimeligere bil, høyere egenandel eller lengre nedbetalingstid.`; }

  const barWidth = Math.max(4, Math.min(100, ((30 - ratio) / 30) * 100));

  // Update advice card
  const card = $('down-payment-card');
  card.className = `advice-card advice-card--${advice.status}`;
  $('advice-icon').textContent         = advice.icon;
  $('advice-title').textContent        = advice.title;
  $('advice-text').textContent         = advice.text;
  $('your-down-payment').textContent   = formatNOK(dp);
  $('recommended-dp').textContent      = formatNOK(advice.rec);
  $('loan-amount').textContent         = formatNOK(principal);

  // Breakdown
  $('monthly-loan').textContent      = formatNOK(loanPay);
  $('monthly-insurance').textContent = formatNOK(insurance);
  $('monthly-fuel').textContent      = formatNOK(fuel);
  $('monthly-service').textContent   = formatNOK(service);
  $('monthly-total').textContent     = formatNOK(total);

  // Health
  const bar   = $('health-bar');
  bar.style.width = barWidth + '%';
  bar.className   = `health-bar ${hClass}`;
  const hBadge = $('health-badge');
  hBadge.textContent = hLabel;
  hBadge.className   = `badge badge--${ratio <= 15 ? 'good' : ratio <= 22 ? 'ok' : 'bad'}`;
  $('health-msg').textContent = hMsg;

  // Totals
  $('total-paid').textContent     = formatNOK(totalPaid + dp);
  $('total-interest').textContent = formatNOK(totalInterest);

  const cr = $('calc-results');
  cr.classList.remove('hidden');
  cr.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===== ERROR CLOSE ===== */
$('error-close').addEventListener('click', hideError);

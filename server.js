const express = require('express');
const axios   = require('axios');
const cheerio = require('cheerio');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

/* ─────────────────────────────────────────────
   PRICE DATABASE  (Norwegian market 2024–2025)
───────────────────────────────────────────── */
const PRICE_DB = {
  'toyota corolla':        { ny: { min: 305000, max: 385000, avg: 345000 }, brukt: { min: 165000, max: 280000, avg: 222000 } },
  'toyota rav4':           { ny: { min: 500000, max: 630000, avg: 565000 }, brukt: { min: 295000, max: 470000, avg: 383000 } },
  'toyota yaris':          { ny: { min: 260000, max: 330000, avg: 295000 }, brukt: { min: 140000, max: 230000, avg: 185000 } },
  'volkswagen golf':       { ny: { min: 340000, max: 445000, avg: 392000 }, brukt: { min: 175000, max: 310000, avg: 243000 } },
  'volkswagen id.4':       { ny: { min: 459000, max: 580000, avg: 519000 }, brukt: { min: 350000, max: 460000, avg: 405000 } },
  'volkswagen passat':     { ny: { min: 430000, max: 570000, avg: 500000 }, brukt: { min: 220000, max: 380000, avg: 300000 } },
  'tesla model 3':         { ny: { min: 419000, max: 530000, avg: 474000 }, brukt: { min: 280000, max: 410000, avg: 345000 } },
  'tesla model y':         { ny: { min: 459000, max: 600000, avg: 530000 }, brukt: { min: 395000, max: 510000, avg: 452000 } },
  'tesla model s':         { ny: { min: 900000, max: 1200000, avg: 1050000 }, brukt: { min: 450000, max: 750000, avg: 600000 } },
  'nissan leaf':           { ny: { min: 359000, max: 450000, avg: 405000 }, brukt: { min: 120000, max: 250000, avg: 185000 } },
  'hyundai ioniq 5':       { ny: { min: 540000, max: 680000, avg: 610000 }, brukt: { min: 430000, max: 570000, avg: 500000 } },
  'hyundai ioniq 6':       { ny: { min: 499000, max: 640000, avg: 570000 }, brukt: { min: 420000, max: 550000, avg: 485000 } },
  'hyundai tucson':        { ny: { min: 400000, max: 540000, avg: 470000 }, brukt: { min: 275000, max: 415000, avg: 345000 } },
  'kia ev6':               { ny: { min: 530000, max: 665000, avg: 598000 }, brukt: { min: 430000, max: 555000, avg: 493000 } },
  'kia sportage':          { ny: { min: 390000, max: 520000, avg: 455000 }, brukt: { min: 250000, max: 390000, avg: 320000 } },
  'kia niro':              { ny: { min: 390000, max: 480000, avg: 435000 }, brukt: { min: 240000, max: 360000, avg: 300000 } },
  'volvo xc60':            { ny: { min: 640000, max: 860000, avg: 750000 }, brukt: { min: 390000, max: 600000, avg: 495000 } },
  'volvo xc40':            { ny: { min: 530000, max: 720000, avg: 625000 }, brukt: { min: 310000, max: 490000, avg: 400000 } },
  'volvo v60':             { ny: { min: 600000, max: 810000, avg: 705000 }, brukt: { min: 360000, max: 560000, avg: 460000 } },
  'bmw 3-serie':           { ny: { min: 560000, max: 760000, avg: 660000 }, brukt: { min: 330000, max: 530000, avg: 430000 } },
  'bmw x3':                { ny: { min: 680000, max: 920000, avg: 800000 }, brukt: { min: 430000, max: 660000, avg: 545000 } },
  'bmw i4':                { ny: { min: 640000, max: 810000, avg: 725000 }, brukt: { min: 500000, max: 660000, avg: 580000 } },
  'mercedes c-klasse':     { ny: { min: 600000, max: 820000, avg: 710000 }, brukt: { min: 360000, max: 580000, avg: 470000 } },
  'mercedes a-klasse':     { ny: { min: 440000, max: 590000, avg: 515000 }, brukt: { min: 250000, max: 400000, avg: 325000 } },
  'audi a4':               { ny: { min: 590000, max: 790000, avg: 690000 }, brukt: { min: 340000, max: 550000, avg: 445000 } },
  'audi q5':               { ny: { min: 700000, max: 930000, avg: 815000 }, brukt: { min: 430000, max: 660000, avg: 545000 } },
  'audi e-tron':           { ny: { min: 750000, max: 950000, avg: 850000 }, brukt: { min: 480000, max: 680000, avg: 580000 } },
  'ford puma':             { ny: { min: 350000, max: 445000, avg: 398000 }, brukt: { min: 230000, max: 345000, avg: 288000 } },
  'ford mustang mach-e':   { ny: { min: 520000, max: 680000, avg: 600000 }, brukt: { min: 380000, max: 520000, avg: 450000 } },
  'skoda octavia':         { ny: { min: 330000, max: 450000, avg: 390000 }, brukt: { min: 195000, max: 315000, avg: 255000 } },
  'skoda kodiaq':          { ny: { min: 500000, max: 650000, avg: 575000 }, brukt: { min: 295000, max: 450000, avg: 373000 } },
  'mazda cx-5':            { ny: { min: 430000, max: 560000, avg: 495000 }, brukt: { min: 285000, max: 430000, avg: 358000 } },
  'mazda cx-60':           { ny: { min: 530000, max: 680000, avg: 605000 }, brukt: { min: 390000, max: 530000, avg: 460000 } },
  'peugeot 2008':          { ny: { min: 320000, max: 420000, avg: 370000 }, brukt: { min: 210000, max: 320000, avg: 265000 } },
  'honda hr-v':            { ny: { min: 380000, max: 490000, avg: 435000 }, brukt: { min: 250000, max: 375000, avg: 313000 } },
  'subaru forester':       { ny: { min: 440000, max: 580000, avg: 510000 }, brukt: { min: 275000, max: 420000, avg: 348000 } },
  'polestar 2':            { ny: { min: 500000, max: 660000, avg: 580000 }, brukt: { min: 390000, max: 520000, avg: 455000 } },
  'renault megane e-tech': { ny: { min: 390000, max: 510000, avg: 450000 }, brukt: { min: 300000, max: 420000, avg: 360000 } },
};

function findCarPrices(model) {
  const q = model.toLowerCase().trim();
  if (PRICE_DB[q]) return { ...PRICE_DB[q], found: true };
  for (const [key, value] of Object.entries(PRICE_DB)) {
    if (q.includes(key) || key.includes(q)) return { ...value, found: true };
  }
  let base = 420000;
  if (/tesla|ioniq|leaf|id\.|ev6|e-tron|polestar|mach-e|niro ev/.test(q)) base = 530000;
  else if (/bmw|mercedes|audi|lexus|porsche|volvo/.test(q)) base = 680000;
  else if (/toyota|honda|mazda|subaru|mitsubishi/.test(q)) base = 400000;
  else if (/volkswagen|vw|skoda|seat|ford|peugeot|renault|opel/.test(q)) base = 380000;
  return {
    ny:    { min: Math.round(base * 0.87), max: Math.round(base * 1.15), avg: base },
    brukt: { min: Math.round(base * 0.52), max: Math.round(base * 0.79), avg: Math.round(base * 0.66) },
    found: false,
  };
}

async function tryFetchFromFinn(model) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'nb-NO,nb;q=0.9,en;q=0.8',
    'Referer': 'https://www.finn.no/',
    'Origin': 'https://www.finn.no',
  };
  const q = encodeURIComponent(model);
  const [usedRes, newRes] = await Promise.all([
    axios.get(`https://www.finn.no/api/search-qf?searchkey=CAR_USED&q=${q}&sort=RELEVANCE&filters=%5B%5D&searchView=list&polyData=&includeExtendedFilters=false`, { headers, timeout: 6000 }),
    axios.get(`https://www.finn.no/api/search-qf?searchkey=CAR_NEW&q=${q}&sort=RELEVANCE&filters=%5B%5D&searchView=list&polyData=&includeExtendedFilters=false`,  { headers, timeout: 6000 }),
  ]);
  const extractPrices = (docs = []) =>
    docs.map(d => d.price?.amount).filter(p => p && p > 30000 && p < 5000000);
  const stats = prices => {
    if (!prices.length) return null;
    const s = [...prices].sort((a, b) => a - b);
    return { min: s[0], max: s[s.length - 1], avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length), count: prices.length };
  };
  return {
    brukt: stats(extractPrices(usedRes.data?.docs)),
    ny:    stats(extractPrices(newRes.data?.docs)),
    usedCount: usedRes.data?.metadata?.result_size?.match_count ?? 0,
    newCount:  newRes.data?.metadata?.result_size?.match_count  ?? 0,
  };
}

/* ─────────────────────────────────────────────
   FINN.NO LISTING URL FETCHING
───────────────────────────────────────────── */
function isValidFinnCarUrl(url) {
  try {
    const u = new URL(url);
    if (!['www.finn.no', 'finn.no'].includes(u.hostname)) return false;
    return /\/(car|mobility)\//i.test(u.pathname);
  } catch { return false; }
}

function getFinnCode(url) {
  for (const p of [/[?&]finnkode=(\d+)/i, /[?&]finn_ad_id=(\d+)/i, /\/(\d{7,12})(?:[/?#]|$)/]) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function getCarTypeFromUrl(url) {
  if (/\/car\/new\//i.test(url) || /registration_class=1/.test(url)) return 'ny';
  return 'brukt';
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'nb-NO,nb;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

// Strategy 1: finn.no cache/iad API
async function tryFinnAdApi(finnCode) {
  const endpoints = [
    `https://cache.api.finn.no/iad/api/2.0/ad/${finnCode}`,
    `https://www.finn.no/api/2.0/ad?finn_ad_id=${finnCode}`,
  ];
  for (const url of endpoints) {
    try {
      const res = await axios.get(url, { headers: { ...FETCH_HEADERS, Accept: 'application/json' }, timeout: 5000 });
      const d = res.data;
      if (!d) continue;
      const price = d.price?.amount ?? d.price;
      if (!price) continue;
      const attrs = {};
      (d.attributes || []).forEach(a => { attrs[a.key] = a.value; });
      return {
        title:   d.heading || d.title || 'Bil fra finn.no',
        price:   parseInt(price),
        make:    attrs.make  || d.make  || '',
        model:   attrs.model || d.model || '',
        year:    attrs.year  || d.year  || null,
        mileage: attrs.mileage ?? d.mileage ?? null,
        source:  'finn-api',
      };
    } catch (_) {}
  }
  return null;
}

// Strategy 2: __NEXT_DATA__ JSON embedded in page
function tryNextData($, carType) {
  const raw = $('#__NEXT_DATA__').html();
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const pp = data?.props?.pageProps;
    const ad = pp?.ad || pp?.adData || pp?.listing || pp?.initialProps?.ad;
    if (!ad) return null;
    const price = ad.price?.value ?? ad.price?.amount ?? ad.pricing?.total?.value ?? ad.totalPrice;
    if (!price) return null;
    return {
      title:   ad.heading || ad.title || ad.name || 'Bil fra finn.no',
      price:   parseInt(price),
      make:    ad.make  || ad.brand || '',
      model:   ad.model || '',
      year:    ad.year  || ad.modelYear || null,
      mileage: ad.mileage ?? ad.kilometers ?? null,
      source:  'next-data',
    };
  } catch (_) { return null; }
}

// Strategy 3: JSON-LD Schema.org
function tryJsonLd($) {
  let result = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (result) return;
    try {
      const raw = JSON.parse($(el).html());
      const item = Array.isArray(raw) ? raw[0] : raw;
      if (!['Car', 'Vehicle', 'Product', 'Offer'].includes(item['@type'])) return;
      const price = item.offers?.price ?? item.price;
      if (!price) return;
      result = {
        title:   item.name || 'Bil fra finn.no',
        price:   parseInt(String(price).replace(/\D/g, '')),
        make:    item.brand?.name || item.manufacturer || '',
        model:   item.model || '',
        year:    item.vehicleModelDate || item.modelDate || null,
        mileage: item.mileageFromOdometer?.value ?? null,
        source:  'json-ld',
      };
    } catch (_) {}
  });
  return result;
}

// Strategy 4: OpenGraph / meta tags
function tryMetaTags($) {
  const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
  const desc    = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
  const combined = ogTitle + ' ' + desc;
  const m = combined.match(/(\d[\d\s]{3,8})\s*kr/i);
  if (!m) return null;
  const price = parseInt(m[1].replace(/\s/g, ''));
  if (!price || price < 20000) return null;
  return {
    title:   ogTitle.replace(/\s*[-–|].*finn\.no.*/i, '').trim() || 'Bil fra finn.no',
    price,
    make: '', model: '', year: null, mileage: null,
    source: 'meta',
  };
}

// Strategy 5: Raw text scan
function tryTextScan($) {
  const h1 = $('h1').first().text().trim();
  const bodyText = $('body').text();
  const priceMatches = [...bodyText.matchAll(/(\d[\d\s]{3,8})\s*kr/gi)]
    .map(m => parseInt(m[1].replace(/\s/g, '')))
    .filter(p => p >= 20000 && p <= 5000000);
  if (!priceMatches.length) return null;
  priceMatches.sort((a, b) => a - b);
  const price = priceMatches[Math.floor(priceMatches.length / 2)]; // median
  return {
    title: h1 || 'Bil fra finn.no',
    price,
    make: '', model: '', year: null, mileage: null,
    source: 'text-scan',
  };
}

async function fetchFinnListing(url) {
  const finnCode  = getFinnCode(url);
  const carType   = getCarTypeFromUrl(url);

  // Try direct API first (fastest, most reliable)
  if (finnCode) {
    const apiResult = await tryFinnAdApi(finnCode);
    if (apiResult) return { ...apiResult, type: carType, url };
  }

  // Fall back to HTML parsing
  const res = await axios.get(url, { headers: FETCH_HEADERS, timeout: 10000, maxRedirects: 5 });
  const $   = cheerio.load(res.data);

  const result = tryNextData($, carType)
    || tryJsonLd($)
    || tryMetaTags($)
    || tryTextScan($);

  if (!result) throw new Error('PARSE_FAILED');
  return { ...result, type: carType, url };
}

/* ─────────────────────────────────────────────
   API ROUTES
───────────────────────────────────────────── */
app.get('/api/search', async (req, res) => {
  const { model } = req.query;
  if (!model || model.trim().length < 2)
    return res.status(400).json({ error: 'Ugyldig bilmodell' });

  const clean = model.trim();
  let finnData = null;
  try { finnData = await tryFetchFromFinn(clean); } catch (_) {}

  const local   = findCarPrices(clean);
  const useFinn = finnData && (finnData.brukt?.count > 0 || finnData.ny?.count > 0);

  res.json({
    model: clean,
    source: useFinn ? 'finn' : 'estimate',
    brukt: (useFinn && finnData.brukt?.count > 0) ? { ...finnData.brukt, fromFinn: true } : { ...local.brukt, fromFinn: false },
    ny:    (useFinn && finnData.ny?.count > 0)    ? { ...finnData.ny,    fromFinn: true } : { ...local.ny,    fromFinn: false },
    finnLinks: {
      brukt: `https://www.finn.no/mobility/search/car?q=${encodeURIComponent(clean)}`,
      ny:    `https://www.finn.no/mobility/search/car?q=${encodeURIComponent(clean)}&registration_class=1`,
    },
  });
});

// Fetch a specific finn.no car listing
app.get('/api/finn', async (req, res) => {
  const { url } = req.query;

  if (!url) return res.status(400).json({ error: 'Mangler URL-parameter' });

  if (!isValidFinnCarUrl(url)) {
    return res.status(400).json({
      error: 'INVALID_URL',
      message: 'Lenken er ikke en gyldig finn.no bilannonse. Eksempel: https://www.finn.no/car/used/ad.html?finnkode=XXXXXXX',
    });
  }

  try {
    const data = await fetchFinnListing(url);
    if (!data.price || data.price < 10000) {
      return res.status(422).json({
        error: 'NO_PRICE',
        message: 'Fant ikke prisen i annonsen. Prøv å skrive inn prisen manuelt.',
      });
    }
    res.json(data);
  } catch (err) {
    const blocked = err.response?.status === 403 || err.response?.status === 429 || err.message?.includes('ECONNREFUSED');
    res.status(502).json({
      error: blocked ? 'BLOCKED' : 'FETCH_FAILED',
      message: blocked
        ? 'finn.no blokkerte forespørselen. Åpne annonsen manuelt og skriv inn prisen nedenfor.'
        : 'Kunne ikke hente annonsen. Sjekk at lenken er riktig og prøv igjen.',
    });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Bilkost kjører på http://localhost:${PORT}\n`);
});

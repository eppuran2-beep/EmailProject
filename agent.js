/* ============================================
   DDR5 RAM Bargain Agent — Frontend Logic
   ============================================ */

// ── Market Reference Prices (Feb 2026, EUR) ──
// These are "fair" used prices in the Finnish market.
// Bargains are listings significantly below these.
const MARKET_PRICES = {
  // Key format: "{capacityGB}-{speedTier}"
  // speedTier: "base" (4800-5200), "mid" (5600), "high" (6000+)
  '8-base': 60,
  '8-mid': 75,
  '8-high': 90,
  '16-base': 160,
  '16-mid': 200,
  '16-high': 240,
  '32-base': 300,
  '32-mid': 350,
  '32-high': 420,
  '48-base': 420,
  '48-mid': 500,
  '48-high': 600,
  '64-base': 550,
  '64-mid': 650,
  '64-high': 750,
  '96-base': 800,
  '96-mid': 950,
  '96-high': 1100,
  '128-base': 1100,
  '128-mid': 1300,
  '128-high': 1500,
};

// Fallback: price per GB if we can't determine speed
const FALLBACK_PRICE_PER_GB = 11; // €/GB rough market average

// ── State ──
let allListings = [];
let filteredListings = [];

// ── DOM References ──
const elResults = document.getElementById('results');
const elLoading = document.getElementById('loading');
const elLoadingText = document.getElementById('loadingText');
const elLoadingBar = document.getElementById('loadingBar');
const elStats = document.getElementById('stats');
const elStatTotal = document.getElementById('statTotal');
const elStatBargains = document.getElementById('statBargains');
const elStatAvgPpgb = document.getElementById('statAvgPpgb');
const elBtnScan = document.getElementById('btnScan');
const elFilterCap = document.getElementById('filterCapacity');
const elFilterFF = document.getElementById('filterFormFactor');
const elSortBy = document.getElementById('sortBy');
const elToast = document.getElementById('toast');

// ── Extract RAM Specs from Title ──
function extractRAMSpecs(title) {
  const t = title.toLowerCase();
  const specs = { capacityGB: null, speed: null, speedTier: 'base', sticks: null, type: 'desktop' };

  // Detect if laptop RAM
  if (/so-?dimm|läppäri|laptop|notebook|kannettava/i.test(t)) {
    specs.type = 'laptop';
  }

  // Extract capacity — look for patterns like "32gb", "32 gb", "2x16gb", "2×16 gb"
  // First try kit notation: 2x16, 4x8, etc.
  const kitMatch = t.match(/(\d)\s*[x×]\s*(\d{1,3})\s*(?:gb|gt)/);
  if (kitMatch) {
    specs.sticks = parseInt(kitMatch[1]);
    const perStick = parseInt(kitMatch[2]);
    specs.capacityGB = specs.sticks * perStick;
  }

  // Try total capacity
  if (!specs.capacityGB) {
    const capMatch = t.match(/(\d{1,3})\s*(?:gb|gt)\b/);
    if (capMatch) {
      specs.capacityGB = parseInt(capMatch[1]);
    }
  }

  // Extract speed — DDR5-5600, 5600MHz, 5600 mhz, etc.
  const speedMatch = t.match(/(?:ddr5[\s-]*)?(\d{4})\s*(?:mhz|mt\/s|mt)?/);
  if (speedMatch) {
    const spd = parseInt(speedMatch[1]);
    if (spd >= 4000 && spd <= 9000) {
      specs.speed = spd;
      if (spd >= 6000) specs.speedTier = 'high';
      else if (spd >= 5400) specs.speedTier = 'mid';
      else specs.speedTier = 'base';
    }
  }

  return specs;
}

// ── Calculate Bargain Score ──
// Returns 0-100:
//   80-100 = GREAT bargain
//   60-79  = Good deal
//   40-59  = Fair price
//   0-39   = Overpriced
function calculateBargainScore(price, specs) {
  if (!price || price <= 0) return 0;

  let referencePrice = null;

  if (specs.capacityGB) {
    const key = `${specs.capacityGB}-${specs.speedTier}`;
    referencePrice = MARKET_PRICES[key];

    // Fallback: use per-GB pricing
    if (!referencePrice) {
      referencePrice = specs.capacityGB * FALLBACK_PRICE_PER_GB;
    }

    // Laptop RAM is typically ~15% cheaper than desktop
    if (specs.type === 'laptop') {
      referencePrice *= 0.85;
    }
  }

  if (!referencePrice) {
    // Can't determine specs, give a neutral score
    return 50;
  }

  // Score based on how much below reference price
  const ratio = price / referencePrice;

  if (ratio <= 0.40) return 95;  // 60%+ discount — incredible
  if (ratio <= 0.50) return 90;  // 50%+ discount
  if (ratio <= 0.60) return 85;  // 40%+ discount
  if (ratio <= 0.70) return 78;  // 30% discount — good deal
  if (ratio <= 0.80) return 68;  // 20% discount
  if (ratio <= 0.90) return 55;  // 10% discount — fair
  if (ratio <= 1.00) return 45;  // At market price
  if (ratio <= 1.10) return 35;  // Slightly over
  if (ratio <= 1.25) return 25;  // Overpriced
  return 10;                      // Very overpriced
}

function getScoreClass(score) {
  if (score >= 75) return 'great';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'low';
}

function getScoreLabel(score) {
  if (score >= 80) return 'Great Deal';
  if (score >= 65) return 'Good Price';
  if (score >= 45) return 'Fair';
  return '';
}

// ── Render Listings ──
function renderListings(listings) {
  if (!listings || listings.length === 0) {
    elResults.className = 'results empty-state';
    elResults.innerHTML = `
      <div class="empty-icon">📭</div>
      <div class="empty-title">No listings found</div>
      <div class="empty-text">Try adjusting your filters or run a new scan</div>
    `;
    return;
  }

  elResults.className = 'results';
  elResults.innerHTML = listings.map((listing, i) => {
    const scoreClass = getScoreClass(listing.bargainScore);
    const scoreLabel = getScoreLabel(listing.bargainScore);
    const cardClass = listing.bargainScore >= 75 ? 'bargain-great' :
      listing.bargainScore >= 60 ? 'bargain-good' : '';

    const specTags = [];
    if (listing.specs.capacityGB) {
      specTags.push(`<span class="spec-tag capacity">${listing.specs.capacityGB} GB</span>`);
    }
    if (listing.specs.speed) {
      specTags.push(`<span class="spec-tag speed">DDR5-${listing.specs.speed}</span>`);
    }
    if (listing.specs.sticks) {
      specTags.push(`<span class="spec-tag">${listing.specs.sticks} sticks</span>`);
    }
    if (listing.specs.type === 'laptop') {
      specTags.push(`<span class="spec-tag">SO-DIMM</span>`);
    }

    const pricePerGB = listing.specs.capacityGB && listing.price
      ? (listing.price / listing.specs.capacityGB).toFixed(1)
      : null;

    return `
      <a class="listing-card ${cardClass}" href="${listing.url}" target="_blank" rel="noopener"
         style="animation-delay: ${i * 0.04}s">
        <div class="card__header">
          <div class="card__title">${escapeHTML(listing.title)}</div>
          ${scoreLabel ? `<span class="bargain-badge ${scoreClass}">${scoreLabel}</span>` : ''}
        </div>

        ${specTags.length ? `<div class="card__specs">${specTags.join('')}</div>` : ''}

        <div class="card__score">
          <span>Deal score</span>
          <div class="score-bar">
            <div class="score-bar__fill ${scoreClass}" style="width: ${listing.bargainScore}%"></div>
          </div>
          <span class="score-value ${scoreClass}">${listing.bargainScore}</span>
        </div>

        <div class="card__footer">
          <div>
            <div class="card__price">${listing.price ? listing.price.toLocaleString('fi-FI') : '?'}<span class="currency"> €</span></div>
            ${pricePerGB ? `<div class="card__ppgb"><span class="value">${pricePerGB}</span> €/GB</div>` : ''}
          </div>
          <div class="card__meta">
            <span class="card__location">${escapeHTML(listing.location || '')}</span>
            <span class="card__date">${escapeHTML(listing.date || '')}</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

// ── Update Stats ──
function updateStats(listings) {
  elStats.style.display = 'flex';
  elStatTotal.textContent = listings.length;

  const bargains = listings.filter(l => l.bargainScore >= 65);
  elStatBargains.textContent = bargains.length;

  const withCapacity = listings.filter(l => l.specs.capacityGB && l.price);
  if (withCapacity.length > 0) {
    const avgPpgb = withCapacity.reduce((sum, l) => sum + l.price / l.specs.capacityGB, 0) / withCapacity.length;
    elStatAvgPpgb.textContent = avgPpgb.toFixed(1) + '€';
  }
}

// ── Filtering & Sorting ──
function applyFilters() {
  const capFilter = elFilterCap.value;
  const ffFilter = elFilterFF.value;
  const sortKey = elSortBy.value;

  let list = [...allListings];

  // Filter by capacity
  if (capFilter !== 'all') {
    const cap = parseInt(capFilter);
    list = list.filter(l => l.specs.capacityGB === cap);
  }

  // Filter by form factor (DIMM vs SO-DIMM)
  if (ffFilter === 'dimm') {
    list = list.filter(l => l.specs.type === 'desktop');
  } else if (ffFilter === 'sodimm') {
    list = list.filter(l => l.specs.type === 'laptop');
  }

  // Sort
  switch (sortKey) {
    case 'bargain-desc':
      list.sort((a, b) => b.bargainScore - a.bargainScore);
      break;
    case 'price-asc':
      list.sort((a, b) => (a.price || 9999) - (b.price || 9999));
      break;
    case 'price-desc':
      list.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case 'ppgb-asc':
      list.sort((a, b) => {
        const ppgbA = a.specs.capacityGB ? a.price / a.specs.capacityGB : 9999;
        const ppgbB = b.specs.capacityGB ? b.price / b.specs.capacityGB : 9999;
        return ppgbA - ppgbB;
      });
      break;
    case 'date-desc':
      // No reliable date parsing, keep original order (newest from scraper)
      break;
  }

  filteredListings = list;
  renderListings(list);
  updateStats(list);
  showOfferToggle();
}

// ── Load Results from JSON File ──
async function loadResults() {
  try {
    const resp = await fetch('results.json');
    if (!resp.ok) return false;
    const data = await resp.json();
    if (data && data.listings && data.listings.length > 0) {
      allListings = data.listings;
      applyFilters();
      showToast(`Loaded ${allListings.length} listings (scanned: ${data.scannedAt || 'unknown'})`, 'success');
      return true;
    }
  } catch (e) {
    // No results file yet, that's fine
  }
  return false;
}

// ── Run Scan (triggers scraper) ──
async function runScan() {
  elBtnScan.disabled = true;
  elBtnScan.classList.add('scanning');
  elBtnScan.querySelector('.label').textContent = 'Scanning…';
  elLoading.classList.add('active');
  elResults.style.display = 'none';

  const steps = [
    'Connecting to Tori.fi…',
    'Searching for DDR5 RAM listings…',
    'Parsing page 1…',
    'Parsing page 2…',
    'Analyzing prices & specs…',
    'Detecting bargains…',
    'Finalizing results…'
  ];

  let stepIndex = 0;
  const progressInterval = setInterval(() => {
    if (stepIndex < steps.length) {
      elLoadingText.textContent = steps[stepIndex];
      elLoadingBar.style.width = ((stepIndex + 1) / steps.length * 100) + '%';
      stepIndex++;
    }
  }, 1500);

  try {
    // Try to run the scraper as a child process via a local endpoint
    // In practice, the user runs `node scraper.js` manually
    // Then we reload results
    const resp = await fetch('results.json?t=' + Date.now());
    if (resp.ok) {
      const data = await resp.json();
      allListings = data.listings || [];
    }
  } catch (e) {
    // If no results.json, show message
    showToast('Run "node scraper.js" in the terminal first, then click Scan again', 'error');
  }

  clearInterval(progressInterval);
  elLoadingBar.style.width = '100%';
  elLoadingText.textContent = 'Done!';

  setTimeout(() => {
    elLoading.classList.remove('active');
    elResults.style.display = '';
    elBtnScan.disabled = false;
    elBtnScan.classList.remove('scanning');
    elBtnScan.querySelector('.label').textContent = 'Scan Tori.fi';

    if (allListings.length > 0) {
      applyFilters();
      showToast(`Found ${allListings.length} DDR5 RAM listings!`, 'success');
    }
  }, 600);
}

// ── Toast Notification ──
function showToast(message, type = 'success') {
  elToast.textContent = message;
  elToast.className = `toast ${type} show`;
  setTimeout(() => {
    elToast.classList.remove('show');
  }, 4000);
}

// ── Utility ──
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Initialization ──
document.addEventListener('DOMContentLoaded', () => {
  loadResults();
});

// ============================================
// Auto-Offer System
// ============================================

// Helsinki metro area regions
const TARGET_REGIONS = ['helsinki', 'espoo', 'vantaa', 'kauniainen'];

// Offer queue state
let offerQueue = [];

// Check if listing is in target region
function isInTargetRegion(listing) {
  const loc = (listing.location || '').toLowerCase();
  return TARGET_REGIONS.some(region => loc.includes(region));
}

// Check if listing has ToriDiili badge (ships anywhere)
function isToriDiili(listing) {
  return listing.toridiili === true;
}

// Check if listing is eligible for offers (in region OR ToriDiili)
function isOfferEligible(listing) {
  return isInTargetRegion(listing) || isToriDiili(listing);
}

// Calculate discount % based on bargain score
function getDiscountPercent(bargainScore) {
  if (bargainScore >= 80) return 10;  // Great deal — gentle 10% nudge
  if (bargainScore >= 65) return 20;  // Good price — 20% off
  return 30;                           // Fair/overpriced — 30% off
}

// Calculate offer price
function calcOfferPrice(askingPrice, discountPercent) {
  const offer = Math.round(askingPrice * (1 - discountPercent / 100));
  // Round to nearest 5€ for cleaner offers
  return Math.round(offer / 5) * 5;
}

// Toggle offer panel visibility
function toggleOfferPanel() {
  const panel = document.getElementById('offerPanel');
  const toggle = document.getElementById('btnOfferToggle');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    toggle.style.display = 'none';
    panel.scrollIntoView({ behavior: 'smooth' });
  } else {
    panel.style.display = 'none';
    toggle.style.display = 'block';
  }
}

// Generate offers from current listings
function generateOffers() {
  const template = document.getElementById('offerTemplate').value;

  // Filter: must have price, in target region OR ToriDiili, must be DDR5 RAM
  const eligible = allListings.filter(l =>
    l.price && l.price > 0 && isOfferEligible(l) && l.bargainScore > 0
  );

  // Sort by bargain score (best deals first)
  eligible.sort((a, b) => b.bargainScore - a.bargainScore);

  offerQueue = eligible.map(listing => {
    const discount = getDiscountPercent(listing.bargainScore);
    const offerPrice = calcOfferPrice(listing.price, discount);
    const message = template
      .replace('{offer_price}', offerPrice)
      .replace('{title}', listing.title);

    return {
      id: listing.url.split('/').pop(),
      title: listing.title,
      url: listing.url,
      location: listing.location || '',
      toridiili: listing.toridiili || false,
      askingPrice: listing.price,
      offerPrice,
      discount,
      message,
      status: 'pending',
      selected: true,
    };
  });

  // Update UI
  const infoEl = document.getElementById('offerInfo');
  const localCount = offerQueue.filter(o => isInTargetRegion({ location: o.location })).length;
  const diiliCount = offerQueue.length - localCount;
  infoEl.textContent = `${offerQueue.length} eligible (${localCount} local + ${diiliCount} ToriDiili)`;

  renderOfferTable();
  document.getElementById('offerTableWrap').style.display = 'block';

  showToast(`Generated ${offerQueue.length} offers for Helsinki metro area`, 'success');
}

// Render the offer preview table
function renderOfferTable() {
  const tbody = document.getElementById('offerTableBody');
  tbody.innerHTML = offerQueue.map((offer, i) => {
    const diiliBadge = offer.toridiili ? ' <span style="color:var(--accent-amber);font-size:0.7rem;font-weight:600;">ToriDiili</span>' : '';
    return `
    <tr>
      <td><input type="checkbox" class="offer-check" data-index="${i}" ${offer.selected ? 'checked' : ''} onchange="toggleOffer(${i}, this.checked)"></td>
      <td><div class="listing-title" title="${escapeHTML(offer.title)}">${escapeHTML(offer.title)}</div></td>
      <td>${escapeHTML(offer.location)}${diiliBadge}</td>
      <td><span class="price-ask">${offer.askingPrice}€</span></td>
      <td><span class="price-offer">${offer.offerPrice}€</span></td>
      <td><span class="discount">-${offer.discount}%</span></td>
      <td><span class="status status-${offer.status}">${offer.status === 'pending' ? '⏳ Pending' : offer.status === 'sent' ? '✅ Sent' : '❌ Error'}</span></td>
    </tr>
  `;
  }).join('');

  updateOfferCount();
}

// Toggle individual offer
function toggleOffer(index, checked) {
  offerQueue[index].selected = checked;
  updateOfferCount();
}

// Toggle all offers
function toggleAllOffers(checked) {
  offerQueue.forEach(o => o.selected = checked);
  document.querySelectorAll('.offer-check').forEach(cb => cb.checked = checked);
  updateOfferCount();
}

// Update selected count
function updateOfferCount() {
  const selected = offerQueue.filter(o => o.selected).length;
  document.getElementById('offerCount').textContent = `${selected} of ${offerQueue.length} offers selected`;
}

// Download offer queue as JSON (for browser automation)
function downloadOffers() {
  const selected = offerQueue.filter(o => o.selected);
  if (selected.length === 0) {
    showToast('No offers selected!', 'error');
    return;
  }

  const data = {
    generatedAt: new Date().toISOString(),
    totalOffers: selected.length,
    targetRegions: TARGET_REGIONS,
    offers: selected.map(o => ({
      id: o.id,
      title: o.title,
      url: o.url,
      location: o.location,
      askingPrice: o.askingPrice,
      offerPrice: o.offerPrice,
      discount: o.discount,
      message: o.message,
      status: o.status,
    })),
  };

  // Save as downloadable JSON
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'offers.json';
  a.click();
  URL.revokeObjectURL(url);

  showToast(`Downloaded ${selected.length} offers — use send_offers.js or ask the agent to send them`, 'success');
}

// Show the offer toggle button once listings are loaded
function showOfferToggle() {
  document.getElementById('btnOfferToggle').style.display = 'block';
}

// ── Save Offers and Send via Server ──
async function saveOffersAndSend() {
  const selected = offerQueue.filter(o => o.selected);
  if (selected.length === 0) {
    showToast('No offers selected!', 'error');
    return;
  }

  const logEl = document.getElementById('sendingLog');
  const entriesEl = document.getElementById('sendingEntries');
  const statusEl = document.getElementById('sendingStatus');
  logEl.style.display = 'block';
  entriesEl.innerHTML = '';
  statusEl.textContent = 'Connecting to server...';

  const offersPayload = selected.map(o => ({
    id: o.id, title: o.title, url: o.url, location: o.location,
    toridiili: o.toridiili, askingPrice: o.askingPrice,
    offerPrice: o.offerPrice, discount: o.discount,
    message: o.message, status: 'pending',
  }));

  // Save to server first
  try {
    await fetch('/api/save-offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offers: offersPayload, generatedAt: new Date().toISOString() }),
    });
  } catch (e) { /* continue */ }

  addLogEntry(entriesEl, '\u2705 ' + selected.length + ' offers queued', 'log-ok');

  // Call SSE endpoint
  try {
    const resp = await fetch('/api/send-offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offers: offersPayload }),
    });

    if (!resp.ok) {
      addLogEntry(entriesEl, '\u274c Server error: ' + resp.status + '. Run "node server.js" instead of "npx serve"', 'log-err');
      statusEl.textContent = 'Error';
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.substring(6));
          handleSendEvent(ev, entriesEl, statusEl);
        } catch (e) { /* skip */ }
      }
    }
  } catch (err) {
    addLogEntry(entriesEl, '\u274c Connection error: ' + err.message, 'log-err');
    addLogEntry(entriesEl, '\u26a0\ufe0f Run: node server.js  (not npx serve)', 'log-err');
    statusEl.textContent = 'Error \u2014 is server.js running?';
  }
}

function handleSendEvent(ev, entriesEl, statusEl, isApi = false) {
  const targetQueue = isApi ? apiSearchResults : offerQueue;
  const renderFn = isApi ? renderApiResults : renderOfferTable;

  if (ev.type === 'start') {
    statusEl.textContent = 'Sending 0/' + ev.total + '...';
    addLogEntry(entriesEl, '\ud83d\ude80 Starting to send ' + ev.total + ' messages...', 'log-ok');
  } else if (ev.type === 'progress') {
    if (ev.status === 'sending') {
      statusEl.textContent = 'Sending ' + (ev.index + 1) + '/' + ev.total + '...';
      const priceTxt = ev.offerPrice ? ' \u2014 ' + ev.offerPrice + '\u20ac' : '';
      addLogEntry(entriesEl, '\ud83d\udce8 [' + (ev.index + 1) + '/' + ev.total + '] ' + ev.title.substring(0, 40) + priceTxt, '');
    } else if (ev.status === 'sent') {
      addLogEntry(entriesEl, '  \u2705 Sent!', 'log-ok');
      const idx = targetQueue.findIndex(o => o.id === ev.id);
      if (idx >= 0) {
        if (isApi) targetQueue[idx].time = '✅ Sent';
        else targetQueue[idx].status = 'sent';
        renderFn();
      }
    } else if (ev.status === 'error') {
      addLogEntry(entriesEl, '  \u274c Error: ' + ev.error, 'log-err');
      const idx = targetQueue.findIndex(o => o.id === ev.id);
      if (idx >= 0) {
        if (isApi) targetQueue[idx].time = '❌ Error';
        else targetQueue[idx].status = 'error';
        renderFn();
      }
    }
  } else if (ev.type === 'waiting') {
    addLogEntry(entriesEl, '  \u23f3 Waiting ' + ev.seconds + 's...', 'log-wait');
  } else if (ev.type === 'done') {
    statusEl.textContent = 'Done! ' + ev.sent + ' sent, ' + ev.errors + ' errors';
    addLogEntry(entriesEl, '\ud83c\udf89 Complete! ' + ev.sent + ' sent, ' + ev.errors + ' errors', 'log-ok');
    showToast('Sent ' + ev.sent + ' messages!', 'success');
  } else if (ev.type === 'error') {
    statusEl.textContent = 'Error';
    addLogEntry(entriesEl, '\u274c ' + ev.message, 'log-err');
  }
}

function addLogEntry(container, text, className) {
  const entry = document.createElement('div');
  entry.className = className || '';
  entry.textContent = text;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

// ============================================
// Mass Message API System
// ============================================
let apiSearchResults = [];
let apiSearchQueryCache = '';

async function loadApiConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.userId) document.getElementById('apiUserId').value = data.userId;
    if (data.hasCookie) document.getElementById('apiCookie').placeholder = 'Cookie is set. Paste new cookie to update.';
  } catch (e) { }
}

async function saveApiConfigForm() {
  const userId = document.getElementById('apiUserId').value;
  const cookie = document.getElementById('apiCookie').value;
  const payload = { userId };
  if (cookie) payload.cookie = cookie;

  try {
    const res = await fetch('/api/update-cookies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      document.getElementById('apiConfigStatus').textContent = 'Saved!';
      setTimeout(() => document.getElementById('apiConfigStatus').textContent = '', 2000);
      document.getElementById('apiCookie').value = '';
      document.getElementById('apiCookie').placeholder = 'Cookie is set. Paste new cookie to update.';
      loadApiConfig();
    }
  } catch (e) {
    showToast('Failed to save settings: ' + e.message, 'error');
  }
}

function toggleApiPanel() {
  const panel = document.getElementById('apiPanel');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth' });
    loadApiConfig();
  } else {
    panel.style.display = 'none';
  }
}

async function runApiSearch() {
  const q = document.getElementById('apiSearchQuery').value;
  const loc = document.getElementById('apiSearchLocation').value;
  const limit = document.getElementById('apiSearchLimit').value;

  if (!q) {
    showToast('Please enter a search query', 'error');
    return;
  }

  apiSearchQueryCache = q;
  const btn = document.getElementById('btnApiSearch');
  btn.disabled = true;
  btn.querySelector('.label').textContent = 'Searching...';

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&location=${encodeURIComponent(loc)}&limit=${limit}`);
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    apiSearchResults = (data.results || []).map(r => ({ ...r, selected: true }));
    renderApiResults();
    document.getElementById('apiResultsWrap').style.display = 'block';
    showToast(`Found ${apiSearchResults.length} results`, 'success');
  } catch (e) {
    showToast('Search failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('.label').textContent = 'Search Tori.fi';
  }
}

function renderApiResults() {
  const tbody = document.getElementById('apiResultsBody');
  tbody.innerHTML = apiSearchResults.map((r, i) => `
    <tr>
      <td><input type="checkbox" class="api-check" data-index="${i}" ${r.selected ? 'checked' : ''} onchange="toggleApiResult(${i}, this.checked)"></td>
      <td><div class="listing-title" title="${escapeHTML(r.title)}"><a href="https://www.tori.fi/recommerce/forsale/item/${r.id}" target="_blank" style="color:var(--text-primary);text-decoration:none;">${escapeHTML(r.title)}</a></div></td>
      <td><span class="price-offer">${r.price}€</span></td>
      <td>${escapeHTML(r.location)}</td>
      <td><span class="status ${r.time && r.time.includes('Sent') ? 'status-sent' : r.time && r.time.includes('Error') ? 'status-error' : 'status-pending'}">${escapeHTML(r.time)}</span></td>
    </tr>
  `).join('');
  updateApiSelectedCount();
}

function toggleApiResult(index, checked) {
  apiSearchResults[index].selected = checked;
  updateApiSelectedCount();
}

function toggleAllApiResults(checked) {
  apiSearchResults.forEach(r => r.selected = checked);
  document.querySelectorAll('.api-check').forEach(cb => cb.checked = checked);
  updateApiSelectedCount();
}

function updateApiSelectedCount() {
  const selected = apiSearchResults.filter(r => r.selected).length;
  document.getElementById('apiSelectedCount').textContent = `${selected} items selected`;
}

async function sendApiMessages() {
  const selected = apiSearchResults.filter(r => r.selected);
  if (selected.length === 0) {
    showToast('No items selected!', 'error');
    return;
  }

  const logEl = document.getElementById('apiSendingLog');
  const entriesEl = document.getElementById('apiSendingEntries');
  const statusEl = document.getElementById('apiSendingStatus');
  logEl.style.display = 'block';
  entriesEl.innerHTML = '';
  statusEl.textContent = 'Connecting via API...';

  const template = document.getElementById('apiMessageTemplate').value;

  const offersPayload = selected.map(r => {
    const message = template.replace(/{query}/gi, apiSearchQueryCache).replace(/{title}/gi, r.title);
    return {
      id: r.id,
      title: r.title,
      offerPrice: r.price,
      message: message,
      status: 'pending',
    };
  });

  try {
    const resp = await fetch('/api/send-offers-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offers: offersPayload }),
    });

    if (!resp.ok) {
      addLogEntry(entriesEl, '❌ Server error: ' + resp.status, 'log-err');
      statusEl.textContent = 'Error';
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // last partial line
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.substring(6));
          handleSendEvent(ev, entriesEl, statusEl, true);
        } catch (e) { /* skip */ }
      }
    }
  } catch (err) {
    addLogEntry(entriesEl, '❌ Connection error: ' + err.message, 'log-err');
    statusEl.textContent = 'Error';
  }
}

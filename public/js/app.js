/* Trade Up — Equity Mining Dashboard */

let currentOrgId = null;
let currentOrg = null;
let currentBrand = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Bootstrap ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadOrgs();
  $('#org-select').addEventListener('change', (e) => {
    const id = e.target.value;
    if (id) {
      loadDashboard(id);
    } else {
      $('#welcome-panel').classList.remove('hidden');
      $('#dashboard').classList.add('hidden');
    }
  });
  $('#batch-analyze-btn').addEventListener('click', runBatchAnalysis);
  $('#modal-close').addEventListener('click', closeModal);
  $('#offer-modal').addEventListener('click', (e) => {
    if (e.target === $('#offer-modal')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
});

// ── API Helpers ──────────────────────────────────────────────────

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Load Orgs ────────────────────────────────────────────────────

async function loadOrgs() {
  const orgs = await api('/api/orgs');
  const sel = $('#org-select');
  orgs.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.id;
    opt.textContent = o.name;
    sel.appendChild(opt);
  });
}

// ── Load Dashboard ───────────────────────────────────────────────

async function loadDashboard(orgId) {
  currentOrgId = orgId;
  $('#welcome-panel').classList.add('hidden');
  $('#dashboard').classList.remove('hidden');

  const [orgDetail, assets, pipeline, summary] = await Promise.all([
    api(`/api/orgs/${orgId}`),
    api(`/api/orgs/${orgId}/assets`),
    api(`/api/orgs/${orgId}/pipeline`),
    api(`/api/orgs/${orgId}/equity-summary`),
  ]);

  currentOrg = orgDetail;
  currentBrand = orgDetail.brand;

  if (currentBrand) applyBrandColors(currentBrand);
  renderDealerHeader(orgDetail);
  renderSummaryCards(summary);
  renderPipeline(pipeline);
  renderVehicleTable(assets);
}

// ── Brand Colors ─────────────────────────────────────────────────

function applyBrandColors(brand) {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', brand.colors?.primary || '#333');
  root.style.setProperty('--brand-secondary', brand.colors?.secondary || '#555');
  root.style.setProperty('--brand-accent', brand.colors?.accent || '#666');
  root.style.setProperty('--brand-bg', brand.colors?.background || '#f5f7fa');
}

// ── Renderers ────────────────────────────────────────────────────

function renderDealerHeader(org) {
  $('#dealer-name').textContent = org.name;
  $('#dealer-tagline').textContent = org.brand?.tagline || '';
}

function renderSummaryCards(summary) {
  const fmt = (n) => typeof n === 'number' ? n.toLocaleString() : n;
  const fmtCurrency = (n) => {
    const num = Number(n) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  };

  const cards = [
    { label: 'Total Analyzed', value: fmt(Number(summary.total)), cls: '' },
    { label: 'Positive Equity', value: fmt(Number(summary.positive_count)), cls: 'positive' },
    { label: 'Negative Equity', value: fmt(Number(summary.negative_count)), cls: 'negative' },
    { label: 'Breakeven', value: fmt(Number(summary.breakeven_count)), cls: 'breakeven' },
    { label: 'Total Equity', value: fmtCurrency(summary.total_equity), cls: '' },
  ];

  $('#summary-cards').innerHTML = cards.map((c) =>
    `<div class="summary-card ${c.cls}">
       <div class="label">${c.label}</div>
       <div class="value">${c.value}</div>
     </div>`
  ).join('');
}

function renderPipeline(stages) {
  $('#pipeline').innerHTML = stages.map((s) =>
    `<div class="pipeline-stage">
       <div class="stage-name">${s.stage_name.replace(/_/g, ' ')}</div>
       <div class="stage-count">${Number(s.record_count)}</div>
     </div>`
  ).join('');
}

function renderVehicleTable(assets) {
  const tbody = $('#vehicle-tbody');
  if (assets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:#888;">No vehicles found</td></tr>';
    return;
  }

  tbody.innerHTML = assets.map((a) => {
    const equity = a.equity_amount != null ? Number(a.equity_amount) : null;
    const eqType = a.equity_type || 'none';
    const badgeCls = `badge-${eqType}`;
    const eqCls = equity != null ? (equity >= 0 ? 'equity-positive' : 'equity-negative') : '';
    const fmtMoney = (v) => v != null ? `$${Number(v).toLocaleString()}` : '—';

    return `<tr>
      <td><strong>${a.year} ${a.make} ${a.model}</strong><br><small style="color:#888">${a.trim || ''}</small></td>
      <td><code style="font-size:12px">${a.vin || '—'}</code></td>
      <td>${a.mileage ? a.mileage.toLocaleString() + ' mi' : '—'}</td>
      <td>${a.first_name || ''} ${a.last_name || ''}</td>
      <td>${fmtMoney(a.market_value)}</td>
      <td>${fmtMoney(a.payoff_amount)}</td>
      <td class="equity-value ${eqCls}">${equity != null ? fmtMoney(equity) : '—'}</td>
      <td><span class="badge ${badgeCls}">${eqType}</span></td>
      <td>${a.analysis_id ? `<button class="btn btn-primary btn-sm" onclick="openOfferPreview('${a.analysis_id}')">Preview Offer</button>` : ''}</td>
    </tr>`;
  }).join('');
}

// ── Batch Analysis ───────────────────────────────────────────────

async function runBatchAnalysis() {
  const btn = $('#batch-analyze-btn');
  const btnText = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.spinner');

  btn.disabled = true;
  btnText.textContent = 'Analyzing...';
  spinner.classList.remove('hidden');

  try {
    const result = await api(`/api/orgs/${currentOrgId}/batch-analyze`, { method: 'POST' });
    showToast(`${result.processed} processed, ${result.opportunities} opportunities found`);
    await loadDashboard(currentOrgId);
  } catch (err) {
    showToast('Analysis failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Run Batch Analysis';
    spinner.classList.add('hidden');
  }
}

// ── Offer Preview ────────────────────────────────────────────────

async function openOfferPreview(analysisId) {
  try {
    const { html } = await api('/api/offers/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId }),
    });

    const iframe = $('#offer-iframe');
    $('#offer-modal').classList.remove('hidden');
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
  } catch (err) {
    showToast('Could not load preview: ' + err.message);
  }
}

function closeModal() {
  $('#offer-modal').classList.add('hidden');
  const iframe = $('#offer-iframe');
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write('');
  doc.close();
}

// ── Toast ────────────────────────────────────────────────────────

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 4000);
}

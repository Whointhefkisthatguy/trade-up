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
  $('#deal-sheet-modal-close').addEventListener('click', closeDealSheetModal);
  $('#deal-sheet-modal').addEventListener('click', (e) => {
    if (e.target === $('#deal-sheet-modal')) closeDealSheetModal();
  });
  $('#client-offer-modal-close').addEventListener('click', closeClientOfferModal);
  $('#client-offer-modal').addEventListener('click', (e) => {
    if (e.target === $('#client-offer-modal')) closeClientOfferModal();
  });
  $('#stage-modal-close').addEventListener('click', closeStageModal);
  $('#stage-modal').addEventListener('click', (e) => {
    if (e.target === $('#stage-modal')) closeStageModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeDealSheetModal(); closeClientOfferModal(); closeStageModal(); }
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

  const [orgDetail, assets, pipeline, summary, pipelineValue] = await Promise.all([
    api(`/api/orgs/${orgId}`),
    api(`/api/orgs/${orgId}/assets`),
    api(`/api/orgs/${orgId}/pipeline`),
    api(`/api/orgs/${orgId}/equity-summary`),
    api(`/api/orgs/${orgId}/pipeline-value`).catch(() => null),
  ]);

  currentOrg = orgDetail;
  currentBrand = orgDetail.brand;

  if (currentBrand) applyBrandColors(currentBrand);
  renderDealerHeader(orgDetail);
  renderSummaryCards(summary);
  renderPipelineValueBanner(pipelineValue);
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
  $('#pipeline').innerHTML = stages.map((s) => {
    const count = Number(s.record_count);
    const hasRecords = count > 0;
    const clickAttr = hasRecords
      ? `onclick="openStageModal('${s.id}', '${s.stage_name.replace(/_/g, ' ')}')" data-stage-id="${s.id}"`
      : '';
    const cls = hasRecords ? 'pipeline-stage has-records' : 'pipeline-stage';
    const hint = hasRecords ? '<div class="stage-hint">click to view</div>' : '';
    return `<div class="${cls}" ${clickAttr}>
       <div class="stage-name">${s.stage_name.replace(/_/g, ' ')}</div>
       <div class="stage-count">${count}</div>
       ${hint}
     </div>`;
  }).join('');
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

    let actionBtn = '';
    if (a.analysis_id) {
      if (!a.deal_sheet_id) {
        actionBtn = `<button class="btn btn-primary btn-sm" onclick="generateDealSheet('${a.analysis_id}')">Deal Sheet</button>`;
      } else if (a.deal_sheet_status === 'client_offer_sent') {
        actionBtn = `<button class="btn btn-primary btn-sm" onclick="viewDealSheet('${a.deal_sheet_id}')">View Deal Sheet</button> <span class="badge badge-client_offer_sent" style="font-size:10px">Offer Sent</span>`;
      } else {
        actionBtn = `<button class="btn btn-primary btn-sm" onclick="viewDealSheet('${a.deal_sheet_id}')">View Deal Sheet</button>`;
      }
    }

    return `<tr>
      <td><strong>${a.year} ${a.make} ${a.model}</strong><br><small style="color:#888">${a.trim || ''}</small></td>
      <td><code style="font-size:12px">${a.vin || '—'}</code></td>
      <td>${a.mileage ? a.mileage.toLocaleString() + ' mi' : '—'}</td>
      <td>${a.first_name || ''} ${a.last_name || ''}</td>
      <td>${fmtMoney(a.market_value)}</td>
      <td>${fmtMoney(a.payoff_amount)}</td>
      <td class="equity-value ${eqCls}">${equity != null ? fmtMoney(equity) : '—'}</td>
      <td><span class="badge ${badgeCls}">${eqType}</span></td>
      <td>${actionBtn}</td>
    </tr>`;
  }).join('');
}

// ── Pipeline Value Banner ────────────────────────────────────────

function renderPipelineValueBanner(pv) {
  const banner = $('#pipeline-value-banner');
  if (!pv) { banner.classList.add('hidden'); return; }
  const fmtCurrency = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  banner.classList.remove('hidden');
  banner.innerHTML = `
    <div class="pv-stat">
      <div class="pv-label">Total Pipeline Equity</div>
      <div class="pv-value">${fmtCurrency(pv.totalPipelineEquity)}</div>
    </div>
    <div class="pv-stat">
      <div class="pv-label">Expected Conversions</div>
      <div class="pv-value">${pv.totalExpectedDeals}</div>
    </div>
    <div class="pv-stat pv-gross">
      <div class="pv-label">Projected Gross</div>
      <div class="pv-value">${fmtCurrency(pv.totalExpectedGross)}</div>
    </div>
    <div class="pv-note">Based on stage conversion rates &times; $${pv.averageGrossPerDeal.toLocaleString()} avg gross per deal</div>
  `;
}

// ── Stage Drill-Down ─────────────────────────────────────────────

async function openStageModal(stageId, stageName) {
  const modal = $('#stage-modal');
  const body = $('#stage-modal-body');
  $('#stage-modal-title').textContent = stageName.replace(/\b\w/g, (c) => c.toUpperCase());
  $('#stage-modal-subtitle').textContent = 'Loading...';
  body.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">Loading records...</div>';
  modal.classList.remove('hidden');

  try {
    const records = await api(`/api/orgs/${currentOrgId}/pipeline/${stageId}/records`);
    $('#stage-modal-subtitle').textContent = `${records.length} record${records.length !== 1 ? 's' : ''}`;
    if (records.length === 0) {
      body.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">No records in this stage</div>';
    } else {
      body.innerHTML = renderStageTable(records, stageId);
    }
  } catch (err) {
    body.innerHTML = `<div style="text-align:center;padding:40px;color:#c62828;">Error loading records: ${err.message}</div>`;
  }
}

function renderStageTable(records, stageId) {
  const stageNum = parseInt(stageId.replace('ps-eq-', ''), 10);
  const fmtMoney = (v) => v != null ? `$${Number(v).toLocaleString()}` : '—';

  function timeInStage(enteredAt) {
    if (!enteredAt) return { text: '—', cls: '' };
    const ms = Date.now() - new Date(enteredAt).getTime();
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const cls = days >= 14 ? 'time-warn' : 'time-ok';
    const text = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
    return { text, cls };
  }

  let headers = '<th>Customer</th><th>Vehicle</th><th>Equity</th><th>Time in Stage</th>';
  if (stageNum >= 4) headers += '<th>Market Value</th><th>Payoff</th><th>Type</th>';
  if (stageNum >= 5) headers += '<th>Deal Sheet</th>';
  if (stageNum >= 6) headers += '<th>Token</th>';
  if (stageNum >= 7) headers += '<th>Accessed</th>';

  const rows = records.map((r) => {
    const time = timeInStage(r.entered_stage_at);
    const eqCls = r.equity_amount != null ? (Number(r.equity_amount) >= 0 ? 'equity-positive' : 'equity-negative') : '';
    let cols = `
      <td><div class="customer-name">${r.first_name || ''} ${r.last_name || ''}</div><div class="customer-email">${r.email || ''}</div></td>
      <td class="vehicle-info">${r.year || ''} ${r.make || ''} ${r.model || ''}</td>
      <td class="equity-value ${eqCls}">${fmtMoney(r.equity_amount)}</td>
      <td><span class="time-badge ${time.cls}">${time.text}</span></td>`;
    if (stageNum >= 4) {
      const typeBadge = r.equity_type ? `<span class="badge badge-${r.equity_type}">${r.equity_type}</span>` : '—';
      cols += `<td>${fmtMoney(r.market_value)}</td><td>${fmtMoney(r.payoff_amount)}</td><td>${typeBadge}</td>`;
    }
    if (stageNum >= 5) {
      const dsStatus = r.deal_sheet_status ? `<span class="badge badge-${r.deal_sheet_status}">${r.deal_sheet_status.replace(/_/g, ' ')}</span>` : '—';
      const dsDate = r.presented_at ? `<div style="font-size:11px;color:#888;margin-top:2px">${new Date(r.presented_at).toLocaleDateString()}</div>` : '';
      cols += `<td>${dsStatus}${dsDate}</td>`;
    }
    if (stageNum >= 6) {
      let tokenInfo = '—';
      if (r.token_status) {
        const tokenCls = r.token_status === 'active' ? 'badge-active' : r.token_status === 'expired' ? 'badge-expired' : 'badge-revoked';
        const expiry = r.expires_at ? `<div style="font-size:11px;color:#888;margin-top:2px">Exp: ${new Date(r.expires_at).toLocaleDateString()}</div>` : '';
        tokenInfo = `<span class="badge ${tokenCls}">${r.token_status}</span>${expiry}`;
      }
      cols += `<td>${tokenInfo}</td>`;
    }
    if (stageNum >= 7) {
      const accessCount = r.access_count != null ? Number(r.access_count) : 0;
      const firstAccess = r.first_accessed_at ? new Date(r.first_accessed_at).toLocaleDateString() : '—';
      cols += `<td>${accessCount} view${accessCount !== 1 ? 's' : ''}<div style="font-size:11px;color:#888;margin-top:2px">${firstAccess}</div></td>`;
    }
    return `<tr>${cols}</tr>`;
  }).join('');

  return `<table class="stage-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}

function closeStageModal() {
  $('#stage-modal').classList.add('hidden');
  $('#stage-modal-body').innerHTML = '';
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

// ── Deal Sheet Workflow ─────────────────────────────────────────

let currentDealSheetId = null;

async function generateDealSheet(analysisId) {
  try {
    showToast('Generating deal sheet...');
    const result = await api('/api/deal-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId }),
    });
    currentDealSheetId = result.id;
    openDealSheetModal(result.html, 'generated');
    showToast('Deal sheet generated');
    loadDashboard(currentOrgId);
  } catch (err) {
    showToast('Could not generate deal sheet: ' + err.message);
  }
}

async function viewDealSheet(dealSheetId) {
  try {
    const result = await api(`/api/deal-sheets/${dealSheetId}`);
    currentDealSheetId = dealSheetId;
    openDealSheetModal(result.html, result.dealSheet.status);
  } catch (err) {
    showToast('Could not load deal sheet: ' + err.message);
  }
}

function openDealSheetModal(html, status) {
  const iframe = $('#deal-sheet-iframe');
  $('#deal-sheet-modal').classList.remove('hidden');
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  updateDealSheetActions(status);
}

function updateDealSheetActions(status) {
  const actions = $('#deal-sheet-actions');
  if (status === 'generated' || status === 'viewed') {
    actions.innerHTML = `<button class="btn btn-success btn-sm" onclick="markAsPresented('${currentDealSheetId}')">Mark as Presented</button>`;
  } else if (status === 'presented') {
    actions.innerHTML = `<span class="badge badge-presented">Presented</span> <button class="btn btn-primary btn-sm" onclick="sendClientOffer('${currentDealSheetId}')">Send Client Offer</button>`;
  } else if (status === 'client_offer_sent') {
    actions.innerHTML = `<span class="badge badge-client_offer_sent">Client Offer Sent</span>`;
  } else {
    actions.innerHTML = '';
  }
}

async function markAsPresented(dealSheetId) {
  try {
    const result = await api(`/api/deal-sheets/${dealSheetId}/present`, { method: 'POST' });
    updateDealSheetActions('presented');
    showToast('Deal sheet marked as presented');
    loadDashboard(currentOrgId);
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

async function sendClientOffer(dealSheetId) {
  try {
    const result = await api(`/api/deal-sheets/${dealSheetId}/client-offer`, { method: 'POST' });
    updateDealSheetActions('client_offer_sent');
    showToast('Client offer generated');

    // Show client offer preview
    const iframe = $('#client-offer-iframe');
    $('#client-offer-modal').classList.remove('hidden');
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(result.html);
    doc.close();

    const offerUrl = window.location.origin + result.url;
    $('#client-offer-actions').innerHTML = `<div class="offer-url-box">${offerUrl}</div>`;

    loadDashboard(currentOrgId);
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

function closeDealSheetModal() {
  $('#deal-sheet-modal').classList.add('hidden');
  const iframe = $('#deal-sheet-iframe');
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write('');
  doc.close();
}

function closeClientOfferModal() {
  $('#client-offer-modal').classList.add('hidden');
  const iframe = $('#client-offer-iframe');
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

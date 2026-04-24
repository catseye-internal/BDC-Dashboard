/**
 * BDC Dashboard Cache Refresh — Standalone Apps Script
 *
 * Runs on a 10-minute time-based trigger.
 * 1. Calls WorkWave API directly to fetch booked + sales data
 * 2. Pushes cache.json to GitHub Pages for instant dashboard loading
 * 3. Also writes to Google Sheet as backup
 *
 * SETUP:
 *   1. Go to script.google.com → New project
 *   2. Paste this entire file
 *   3. Add Script Properties (Project Settings → Script Properties):
 *        GITHUB_TOKEN = <fine-grained PAT with Contents write on catseye-internal.github.io>
 *   4. Click Run → refreshCache (authorize when prompted)
 *   5. Set up trigger: Triggers (clock icon) → Add Trigger →
 *      Function: refreshCache, Event: Time-driven,
 *      Minutes timer, Every 10 minutes
 */

// ── Configuration ──
const WW_API_URL = 'https://api.marketing.workwave.com/public/searchOpportunity';
const WW_TENANT = '103012';
const WW_USER = '3146189e-5446-4523-8106-a03f32c11b65';
const CACHE_SHEET_ID = '1LoJHJ8aryr-W6O-6H4J0WL19QuBDBfEVbw-aZI1B0tg';
const LEADS_SHEET_ID = '17oIiQSafUmay67MI99EJtnZDq6hZDXJcB0UPWk0di-A';

// ── PestPac Operational API Configuration ──
const PP_CLIENT_ID     = 'OjCMV6522ip62LlhU08LrG5U61oa';
const PP_CLIENT_SECRET = 'MicEfYLkplnarU18fHLH3VCfxhMa';
const PP_USERNAME      = 'jdingwall@catseyepest.com';
const PP_PASSWORD      = 'C@ts3y3!!';
const PP_API_KEY       = 'IJ4Goon7ZW9EbvAvPdO33Q6Vtnt5oysT';
const PP_TENANT_ID     = '103012';
const PP_TOKEN_URL     = 'https://is.workwave.com/oauth2/token?scope=openid';
const PP_API_BASE      = 'https://api.workwave.com/pestpac/v1';

// GitHub config
const GITHUB_OWNER = 'catseye-internal';
const GITHUB_REPO = 'BDC-Dashboard';
const GITHUB_PATH = 'cache.json';
const GITHUB_BRANCH = 'main';

// ── Helper: call WorkWave API directly (bypasses proxy — no redirect issues) ──
function callWorkWave(params) {
  const resp = UrlFetchApp.fetch(WW_API_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(params),
    headers: {
      'apikey': WW_USER,
      'tenant-id': WW_TENANT
    },
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  const text = resp.getContentText();

  if (code !== 200) {
    Logger.log('    WorkWave HTTP ' + code + ': ' + text.substring(0, 300));
    throw new Error('WorkWave HTTP ' + code);
  }

  return JSON.parse(text);
}

// ── Helper: fetch all opportunities with pagination ──
function fetchAllOpps(params) {
  const results = [];
  let skip = 0;
  const take = 500;
  let hasMore = true;

  while (hasMore) {
    const reqParams = Object.assign({}, params, { take: take, skip: skip });
    const json = callWorkWave(reqParams);

    if (!json || !json.items) {
      Logger.log('    Page error at skip=' + skip + ': no items in response');
      break;
    }

    const items = json.items || [];
    results.push(...items);
    skip += take;
    hasMore = items.length === take && skip < (json.count || 0);
    Logger.log('    Page skip=' + skip + ': got ' + items.length + ' items (total so far: ' + results.length + ')');
  }

  return results;
}

// ── Process a raw opportunity into a slim object ──
function processOpp(opp, isBooked) {
  const branch = opp.branch || '';

  if (isBooked) {
    const created = (opp.createdDate || '').split('T')[0];
    let countAsLead = true;
    if (opp.countAsLeadRun === false || opp.countAsLeadRun === 'No' || opp.countAsLeadRun === 'no') countAsLead = false;
    if (Array.isArray(opp.customFields)) {
      opp.customFields.forEach(function(cf) {
        var name = (cf.name || cf.label || cf.key || '').toLowerCase().replace(/[^a-z]/g, '');
        if (name.indexOf('countaslead') > -1) {
          var v = String(cf.value || cf.answer || '').toLowerCase();
          if (v === 'no' || v === 'false') countAsLead = false;
        }
      });
    }
    if (!countAsLead) return null;
    return { branch: branch, date: created, datetime: opp.createdDate || '' };
  } else {
    var stage = (opp.salesFunnelStage || '').toLowerCase();
    // Explicitly reject lost/open/other stages
    if (stage.indexOf('lost') > -1) return null;
    if (stage !== 'closed/won' && stage !== 'closed won' && stage !== 'closedwon' && stage !== 'won') return null;
    var closedDate = opp.closedDate ? opp.closedDate.split('T')[0] : null;
    if (!closedDate) return null;

    // Extract custom fields for Sales view
    var techSoldName = '', countAsLeadRun = '', bdcSold = '';
    if (Array.isArray(opp.customFields)) {
      opp.customFields.forEach(function(cf) {
        var cfName = (cf.name || cf.label || cf.key || '');
        var cfVal  = String(cf.value || cf.answer || '');
        if (cfName === 'Technician SOLD Name') techSoldName = cfVal;
        else if (cfName === 'Count as Lead Run?') countAsLeadRun = cfVal;
        else if (cfName === 'BDC SOLD?') bdcSold = cfVal;
      });
    }

    // Extract services list + per-service pricing from locations
    var services = '';
    var serviceDetails = [];
    try {
      if (Array.isArray(opp.locations) && opp.locations.length > 0 && Array.isArray(opp.locations[0].services)) {
        var svcs = opp.locations[0].services;
        services = svcs.map(function(s) { return s.name || ''; }).filter(Boolean).join(', ');
        serviceDetails = svcs.map(function(s) {
          return {
            name: s.name || '',
            description: s.description || '',
            initialPrice: s.initialPrice || 0,
            recurringPrice: s.recurringPrice || 0,
            annualOccurrences: s.annualOccurrences || 0,
            quantity: s.quantity || 1
          };
        });
      }
    } catch(e) {}

    // Primary contact name and city
    var contactName = '', city = '';
    var pc = opp.primaryContact || {};
    contactName = ((pc.firstName || '') + ' ' + (pc.lastName || '')).trim();
    city = pc.city || '';

    return {
      branch: branch, date: closedDate, datetime: opp.closedDate || '',
      stage: opp.salesFunnelStage || '',
      initialValue: opp.initialValue || 0,
      annualValue: opp.annualValue || 0,
      totalValue: opp.totalValue || 0,
      owner: opp.owner || '',
      city: city,
      services: services,
      serviceDetails: serviceDetails,
      contactName: contactName,
      createdBy: opp.opportunityCreatedBy || '',
      techSoldName: techSoldName,
      countAsLeadRun: countAsLeadRun,
      bdcSold: bdcSold
    };
  }
}

// ── Read leads from the BDC Lead Sheet (same format as proxy doGet) ──
function fetchLeadsFromSheet() {
  try {
    const ss = SpreadsheetApp.openById(LEADS_SHEET_ID);
    const sheet = ss.getSheetByName('Sheet1');
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const headers = data[0];
    const rows = [];
    for (var i = 1; i < data.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        var val = data[i][j];
        if (val instanceof Date) {
          if (val.getFullYear() < 1900) {
            val = Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), 'h:mma');
          } else {
            val = Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), 'M/d/yyyy');
          }
        }
        row[headers[j]] = val !== null && val !== undefined ? String(val) : '';
      }
      rows.push(row);
    }
    Logger.log('  Leads from sheet: ' + rows.length + ' rows');
    return rows;
  } catch (err) {
    Logger.log('  ⚠️ Could not read leads sheet: ' + err.message);
    return [];
  }
}

// ── PestPac OAuth2 token ──
function getPestPacToken_() {
  var creds = Utilities.base64Encode(PP_CLIENT_ID + ':' + PP_CLIENT_SECRET);
  var resp = UrlFetchApp.fetch(PP_TOKEN_URL, {
    method: 'post',
    headers: { 'Authorization': 'Basic ' + creds },
    contentType: 'application/x-www-form-urlencoded',
    payload: 'grant_type=password&username=' + encodeURIComponent(PP_USERNAME) +
             '&password=' + encodeURIComponent(PP_PASSWORD),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) {
    throw new Error('PestPac token failed: ' + resp.getResponseCode() + ' - ' + resp.getContentText().substring(0, 200));
  }
  return JSON.parse(resp.getContentText()).access_token;
}

// ── Fetch ESTIMATE work orders from PestPac operational API ──
function fetchLeadsRun(startDate, endDate) {
  var token = getPestPacToken_();
  var url = PP_API_BASE + '/ServiceOrders?orderType=Estimate&startWorkDate=' + startDate + '&endWorkDate=' + endDate;
  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + token,
      'apikey': PP_API_KEY,
      'tenant-id': PP_TENANT_ID
    },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) {
    Logger.log('  ⚠️ PestPac ServiceOrders failed: HTTP ' + resp.getResponseCode());
    Logger.log('    ' + resp.getContentText().substring(0, 300));
    return [];
  }
  var orders = JSON.parse(resp.getContentText());
  // Exclude specific techs (these are non-sales estimates)
  var EXCLUDE_TECHS = ['ABG', 'ABG2', 'LAM', 'LAM2', 'SLM', 'KJA'];
  // Only include sales-related Origins (matches PestPac Service Order List report)
  var ALLOWED_ORIGINS = ['OneTime', 'Initial', 'OrderLink', 'Generated', 'FollowUp'];
  return orders.filter(function(o) {
    var tech = (o.Tech1 || '').toUpperCase();
    var origin = o.Origin || '';
    return EXCLUDE_TECHS.indexOf(tech) === -1 && ALLOWED_ORIGINS.indexOf(origin) !== -1;
  }).map(function(o) {
    var fullWd = o.WorkDate || '';
    var wd = fullWd.split('T')[0];
    return { branch: o.Branch || '', date: wd, datetime: fullWd };
  }).filter(function(o) { return o.branch && o.date; });
}

// ── Date helpers ──
function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

// ── Write cache.json to GitHub Pages via Git Data API ──
// Uses blob → tree → commit → update-ref to handle files of any size
function writeToGitHub(jsonStr) {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    Logger.log('  ⚠️ GITHUB_TOKEN not set in Script Properties — skipping GitHub write');
    return false;
  }

  var apiBase = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO;
  var headers = {
    'Authorization': 'token ' + token,
    'Accept': 'application/vnd.github.v3+json'
  };

  try {
    // Step 1: Create blob with cache content
    var blobResp = UrlFetchApp.fetch(apiBase + '/git/blobs', {
      method: 'post',
      headers: headers,
      contentType: 'application/json',
      payload: JSON.stringify({
        content: Utilities.base64Encode(jsonStr, Utilities.Charset.UTF_8),
        encoding: 'base64'
      }),
      muteHttpExceptions: true
    });
    if (blobResp.getResponseCode() !== 201) {
      Logger.log('  ⚠️ GitHub blob create failed: HTTP ' + blobResp.getResponseCode());
      Logger.log('    ' + blobResp.getContentText().substring(0, 300));
      return false;
    }
    var blobSha = JSON.parse(blobResp.getContentText()).sha;
    Logger.log('  GitHub blob created: ' + blobSha.substring(0, 7));

    // Step 2: Get current commit SHA for the branch
    var refResp = UrlFetchApp.fetch(apiBase + '/git/ref/heads/' + GITHUB_BRANCH, {
      headers: headers,
      muteHttpExceptions: true
    });
    if (refResp.getResponseCode() !== 200) {
      Logger.log('  ⚠️ GitHub ref lookup failed: HTTP ' + refResp.getResponseCode());
      return false;
    }
    var currentCommitSha = JSON.parse(refResp.getContentText()).object.sha;

    // Step 3: Get tree SHA of current commit
    var commitResp = UrlFetchApp.fetch(apiBase + '/git/commits/' + currentCommitSha, {
      headers: headers,
      muteHttpExceptions: true
    });
    var currentTreeSha = JSON.parse(commitResp.getContentText()).tree.sha;

    // Step 4: Create new tree with updated cache.json
    var treeResp = UrlFetchApp.fetch(apiBase + '/git/trees', {
      method: 'post',
      headers: headers,
      contentType: 'application/json',
      payload: JSON.stringify({
        base_tree: currentTreeSha,
        tree: [{
          path: GITHUB_PATH,
          mode: '100644',
          type: 'blob',
          sha: blobSha
        }]
      }),
      muteHttpExceptions: true
    });
    var newTreeSha = JSON.parse(treeResp.getContentText()).sha;

    // Step 5: Create new commit
    var newCommitResp = UrlFetchApp.fetch(apiBase + '/git/commits', {
      method: 'post',
      headers: headers,
      contentType: 'application/json',
      payload: JSON.stringify({
        message: 'Update BDC cache ' + new Date().toISOString(),
        tree: newTreeSha,
        parents: [currentCommitSha]
      }),
      muteHttpExceptions: true
    });
    var newCommitSha = JSON.parse(newCommitResp.getContentText()).sha;

    // Step 6: Update branch ref to point to new commit
    var updateResp = UrlFetchApp.fetch(apiBase + '/git/refs/heads/' + GITHUB_BRANCH, {
      method: 'patch',
      headers: headers,
      contentType: 'application/json',
      payload: JSON.stringify({ sha: newCommitSha }),
      muteHttpExceptions: true
    });

    if (updateResp.getResponseCode() === 200) {
      Logger.log('  ✅ GitHub cache.json updated (commit: ' + newCommitSha.substring(0, 7) + ')');
      return true;
    } else {
      Logger.log('  ⚠️ GitHub ref update failed: HTTP ' + updateResp.getResponseCode());
      return false;
    }

  } catch (err) {
    Logger.log('  ⚠️ GitHub write error: ' + err.message);
    return false;
  }
}

// ════════════════════════════════════════════
// MAIN: refreshCache — called by time trigger
// ════════════════════════════════════════════
function refreshCache() {
  var t0 = new Date();
  Logger.log('🔄 Cache refresh started at ' + t0.toISOString());

  try {
    // Build date ranges
    var now = new Date();
    var ytdStart = now.getFullYear() + '-01-01';
    var mtdStart = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-01';
    var tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    var tomorrowStr = fmtDate(tomorrow);

    // Pre-MTD end date: day BEFORE mtdStart to avoid overlap
    // (deals on the 1st were appearing in both MTD and pre-MTD)
    var preMtdEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
    var preMtdEndStr = fmtDate(preMtdEnd);

    // ── Fetch WorkWave data ──
    Logger.log('  Fetching MTD booked...');
    var mtdCreated = fetchAllOpps({ fromCreatedTime: mtdStart + 'T00:00:00Z', toCreatedTime: tomorrowStr + 'T00:00:00Z' });

    Logger.log('  Fetching MTD sales...');
    var mtdClosed = fetchAllOpps({ fromDateClosed: mtdStart + 'T00:00:00Z', toDateClosed: tomorrowStr + 'T00:00:00Z' });

    Logger.log('  Fetching YTD booked (pre-MTD)...');
    var preMtdCreated = fetchAllOpps({ fromCreatedTime: ytdStart + 'T00:00:00Z', toCreatedTime: preMtdEndStr + 'T23:59:59Z' });

    Logger.log('  Fetching YTD sales (pre-MTD)...');
    var preMtdClosed = fetchAllOpps({ fromDateClosed: ytdStart + 'T00:00:00Z', toDateClosed: preMtdEndStr + 'T23:59:59Z' });

    // ── Process into slim objects ──
    var bookedMtd = mtdCreated.map(function(o) { return processOpp(o, true); }).filter(Boolean);
    var salesMtd = mtdClosed.map(function(o) { return processOpp(o, false); }).filter(Boolean);
    var bookedPre = preMtdCreated.map(function(o) { return processOpp(o, true); }).filter(Boolean);
    var salesPre = preMtdClosed.map(function(o) { return processOpp(o, false); }).filter(Boolean);

    Logger.log('  Processed: ' + bookedMtd.length + ' booked MTD, ' + salesMtd.length + ' sales MTD, ' +
               bookedPre.length + ' booked pre-MTD, ' + salesPre.length + ' sales pre-MTD');

    // ── Fetch leads from the BDC Lead Sheet ──
    Logger.log('  Fetching leads from Google Sheet...');
    var leads = fetchLeadsFromSheet();

    // ── Fetch Leads Run (ESTIMATE work orders) from PestPac ──
    // Use today (not tomorrow) as end date so we don't pick up future-scheduled estimates
    var todayStr = fmtDate(now);
    Logger.log('  Fetching Leads Run (PestPac ESTIMATE orders)...');
    var runMtd = [], runPre = [];
    try {
      runMtd = fetchLeadsRun(mtdStart, todayStr);
      // Pre-MTD: chunk into 31-day segments (PestPac API limit)
      var chunkStart = new Date(now.getFullYear(), 0, 1); // Jan 1
      var chunkEnd;
      var preEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day prev month
      while (chunkStart <= preEnd) {
        chunkEnd = new Date(chunkStart);
        chunkEnd.setDate(chunkEnd.getDate() + 30); // 31-day window
        if (chunkEnd > preEnd) chunkEnd = preEnd;
        var chunk = fetchLeadsRun(fmtDate(chunkStart), fmtDate(chunkEnd));
        for (var ci = 0; ci < chunk.length; ci++) runPre.push(chunk[ci]);
        chunkStart = new Date(chunkEnd);
        chunkStart.setDate(chunkStart.getDate() + 1);
      }
      Logger.log('  Leads Run: ' + runMtd.length + ' MTD, ' + runPre.length + ' pre-MTD');
    } catch (err) {
      Logger.log('  ⚠️ Leads Run fetch error (non-fatal): ' + err.message);
    }

    // ── Build cache payload ──
    var cacheData = {
      updated: new Date().toISOString(),
      mtdStart: mtdStart,
      ytdStart: ytdStart,
      booked: { mtd: bookedMtd, preMtd: bookedPre },
      sales: { mtd: salesMtd, preMtd: salesPre },
      leadsRun: { mtd: runMtd, preMtd: runPre },
      leads: leads
    };

    var jsonStr = JSON.stringify(cacheData);
    Logger.log('  Cache payload size: ' + jsonStr.length + ' chars (' + Math.round(jsonStr.length / 1024) + ' KB)');

    // ── Write to GitHub Pages (primary — instant loading) ──
    Logger.log('  Writing to GitHub...');
    var githubOk = writeToGitHub(jsonStr);

    // ── Write to Google Sheet (backup) ──
    Logger.log('  Writing to Google Sheet (backup)...');
    var ss = SpreadsheetApp.openById(CACHE_SHEET_ID);
    var sheet = ss.getSheetByName('Cache');
    if (!sheet) { sheet = ss.insertSheet('Cache'); }
    sheet.clear();

    var CHUNK_SIZE = 45000;
    if (jsonStr.length <= CHUNK_SIZE) {
      sheet.getRange('A1').setValue(jsonStr);
      sheet.getRange('B1').setValue(new Date().toISOString());
    } else {
      var chunks = [];
      for (var i = 0; i < jsonStr.length; i += CHUNK_SIZE) {
        chunks.push(jsonStr.substring(i, i + CHUNK_SIZE));
      }
      for (var c = 0; c < chunks.length; c++) {
        sheet.getRange(1, c + 1).setValue(chunks[c]);
      }
      sheet.getRange(2, 1).setValue('__chunks__:' + chunks.length);
      sheet.getRange(2, 2).setValue(new Date().toISOString());
    }

    var elapsed = ((new Date() - t0) / 1000).toFixed(1);
    Logger.log('✅ Cache refresh complete in ' + elapsed + 's (GitHub: ' + (githubOk ? 'OK' : 'SKIPPED') + ')');

  } catch (err) {
    Logger.log('❌ Cache refresh error: ' + err.message);
    Logger.log(err.stack);
  }
}

// ── Manual test: verify cache can be read back ──
function testCacheRead() {
  var ss = SpreadsheetApp.openById(CACHE_SHEET_ID);
  var sheet = ss.getSheetByName('Cache');
  if (!sheet) { Logger.log('No Cache sheet found'); return; }

  var a1 = sheet.getRange('A1').getValue();
  if (!a1) { Logger.log('Cache is empty'); return; }

  var a2 = sheet.getRange('A2').getValue();
  var jsonStr;
  if (typeof a2 === 'string' && a2.startsWith('__chunks__:')) {
    var numChunks = parseInt(a2.split(':')[1]);
    jsonStr = '';
    for (var c = 0; c < numChunks; c++) {
      jsonStr += sheet.getRange(1, c + 1).getValue();
    }
  } else {
    jsonStr = a1;
  }

  var data = JSON.parse(jsonStr);
  Logger.log('Cache updated: ' + data.updated);
  Logger.log('Booked MTD: ' + data.booked.mtd.length + ' items');
  Logger.log('Sales MTD: ' + data.sales.mtd.length + ' items');
  Logger.log('Booked pre-MTD: ' + data.booked.preMtd.length + ' items');
  Logger.log('Sales pre-MTD: ' + data.sales.preMtd.length + ' items');
  Logger.log('Leads Run MTD: ' + (data.leadsRun ? data.leadsRun.mtd.length : 0) + ' items');
  Logger.log('Leads Run pre-MTD: ' + (data.leadsRun ? data.leadsRun.preMtd.length : 0) + ' items');
  Logger.log('Leads: ' + (data.leads ? data.leads.length : 0) + ' rows');
}

// ── Manual test: verify GitHub write works ──
function testGitHubWrite() {
  var testData = JSON.stringify({ test: true, updated: new Date().toISOString() });
  var result = writeToGitHub(testData);
  Logger.log('GitHub write test: ' + (result ? 'SUCCESS' : 'FAILED'));
}

// ── Diagnostic: inspect what fields searchOpportunity actually returns ──
function inspectSalesFields() {
  var now = new Date();
  var mtdStart = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-01';
  var tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  var tomorrowStr = fmtDate(tomorrow);

  var opps = fetchAllOpps({ fromDateClosed: mtdStart + 'T00:00:00Z', toDateClosed: tomorrowStr + 'T00:00:00Z' });
  Logger.log('Total closed opps: ' + opps.length);

  // Show ALL top-level keys from first 3 closed/won opps
  var count = 0;
  for (var i = 0; i < opps.length && count < 3; i++) {
    var stage = (opps[i].salesFunnelStage || '').toLowerCase();
    if (stage.indexOf('won') === -1 && stage.indexOf('closed') === -1) continue;
    count++;
    var opp = opps[i];
    Logger.log('\n═══ OPP #' + count + ' ═══');
    Logger.log('Keys: ' + Object.keys(opp).join(', '));
    Logger.log('owner: ' + JSON.stringify(opp.owner));
    Logger.log('primaryContact: ' + JSON.stringify(opp.primaryContact));
    Logger.log('locations: ' + JSON.stringify(opp.locations));
    Logger.log('opportunityCreatedBy: ' + JSON.stringify(opp.opportunityCreatedBy));
    Logger.log('customFields: ' + JSON.stringify(opp.customFields));
    Logger.log('opportunityName: ' + JSON.stringify(opp.opportunityName));
    Logger.log('branch: ' + JSON.stringify(opp.branch));
    Logger.log('salesFunnelStage: ' + JSON.stringify(opp.salesFunnelStage));
  }
}

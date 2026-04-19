/**
 * BDC Lead Dashboard — Private Data Proxy + Write API
 *
 * REDEPLOY AFTER UPDATING:
 * 1. Open the BDC Lead Aggregator Google Sheet
 * 2. Extensions → Apps Script
 * 3. Paste this entire file into Code.gs (replace everything)
 * 4. Click Deploy → Manage deployments → Edit → New version → Deploy
 *
 * SCRIPT PROPERTIES REQUIRED (Project Settings → Script Properties):
 *   WW_TENANT        — Sales Center tenant-id
 *   WW_USER          — Sales Center marketingUserId
 *   PP_API_KEY       — PestPac API key
 *   PP_CLIENT_ID     — PestPac OAuth Client ID
 *   PP_CLIENT_SECRET — PestPac OAuth Client Secret
 *   PP_USERNAME      — WorkWave developer account username
 *   PP_PASSWORD      — WorkWave developer account password
 */

const VALID_TOKEN = 'catseye-bdc-2026';
const SHEET_NAME = 'Sheet1';

// ── GET: Read all data ──
function doGet(e) {
  const token = (e && e.parameter && e.parameter.token) || '';
  if (token !== VALID_TOKEN) {
    return _json({ error: 'Unauthorized' });
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) return _json([]);

    const headers = data[0];
    const rows = [];

    for (let i = 1; i < data.length; i++) {
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        let val = data[i][j];
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

    return _json(rows);
  } catch (err) {
    return _json({ error: err.message });
  }
}

// ── POST: Write data ──
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const token = body.token || '';
    if (token !== VALID_TOKEN) {
      return _json({ error: 'Unauthorized' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const action = body.action || '';

    // ── Action: append rows ──
    if (action === 'append') {
      const rows = body.rows || [];
      if (rows.length === 0) return _json({ error: 'No rows provided' });

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const existingHeaders = new Set(headers.filter(h => h !== ''));
      const allKeys = new Set();
      rows.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));

      let currentLastCol = headers.filter(h => h !== '').length;
      allKeys.forEach(key => {
        if (!existingHeaders.has(key)) {
          currentLastCol++;
          sheet.getRange(1, currentLastCol).setValue(key);
          headers.push(key);
          existingHeaders.add(key);
        }
      });

      const finalHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const rowArrays = rows.map(row => {
        return finalHeaders.map(h => row[h] !== undefined ? row[h] : '');
      });

      const startRow = sheet.getLastRow() + 1;
      if (rowArrays.length > 0 && rowArrays[0].length > 0) {
        sheet.getRange(startRow, 1, rowArrays.length, rowArrays[0].length).setValues(rowArrays);
      }

      return _json({ success: true, rowsAdded: rowArrays.length });
    }

    // ── Action: add_columns ──
    if (action === 'add_columns') {
      const columns = body.columns || [];
      if (columns.length === 0) return _json({ error: 'No columns provided' });

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const existingHeaders = new Set(headers.filter(h => h !== ''));
      let lastCol = headers.filter(h => h !== '').length;
      const added = [];

      columns.forEach(col => {
        if (!existingHeaders.has(col)) {
          lastCol++;
          sheet.getRange(1, lastCol).setValue(col);
          existingHeaders.add(col);
          added.push(col);
        }
      });

      return _json({ success: true, added: added });
    }

    // ── Action: fix_time_column ──
    if (action === 'fix_time_column') {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const timeCol = headers.indexOf('TIME_RECEIVED');
      if (timeCol === -1) return _json({ error: 'TIME_RECEIVED column not found' });

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return _json({ success: true, fixed: 0 });

      const colNum = timeCol + 1;
      const range = sheet.getRange(2, colNum, lastRow - 1, 1);
      const vals = range.getValues();
      const tz = ss.getSpreadsheetTimeZone();
      let fixed = 0;

      for (let i = 0; i < vals.length; i++) {
        if (vals[i][0] instanceof Date) {
          vals[i][0] = Utilities.formatDate(vals[i][0], tz, 'h:mma');
          fixed++;
        }
      }

      range.setNumberFormat('@');
      range.setValues(vals);
      return _json({ success: true, fixed: fixed });
    }

    // ── Action: fix_zip_codes ──
    if (action === 'fix_zip_codes') {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const zipCol = headers.indexOf('CITY_STATE');
      if (zipCol === -1) return _json({ error: 'CITY_STATE column not found' });

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return _json({ success: true, fixed: 0 });

      const colNum = zipCol + 1;
      const range = sheet.getRange(2, colNum, lastRow - 1, 1);
      range.setNumberFormat('@');

      const vals = range.getValues();
      let fixed = 0;

      for (let i = 0; i < vals.length; i++) {
        let v = vals[i][0];
        if (v === null || v === undefined || v === '') continue;
        v = String(v).trim();
        if (/^\d{4}$/.test(v)) {
          vals[i][0] = '0' + v;
          fixed++;
        } else {
          vals[i][0] = v;
        }
      }

      range.setValues(vals);
      return _json({ success: true, fixed: fixed });
    }

    // ── Action: workwave_opportunities (proxy to WorkWave Sales Center API) ──
    if (action === 'workwave_opportunities') {
      return _workwaveSearch(body);
    }

    return _json({ error: 'Unknown action: ' + action });
  } catch (err) {
    return _json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════
// WorkWave OAuth2 + Sales Center API
// ══════════════════════════════════════════════════════════════

// ── Get OAuth2 access token from WorkWave Identity Server ──
// Uses password grant: client_id + client_secret + username + password → access_token
function _getAccessToken() {
  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty('PP_CLIENT_ID');
  var clientSecret = props.getProperty('PP_CLIENT_SECRET');
  var username = props.getProperty('PP_USERNAME');
  var password = props.getProperty('PP_PASSWORD');

  // Basic auth header: base64(client_id:client_secret)
  var authHeader = Utilities.base64Encode(clientId + ':' + clientSecret);

  var response = UrlFetchApp.fetch('https://is.workwave.com/oauth2/token?scope=openid', {
    method: 'post',
    headers: {
      'Authorization': 'Basic ' + authHeader
    },
    payload: {
      'grant_type': 'password',
      'username': username,
      'password': password
    },
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  var text = response.getContentText();

  if (code !== 200) {
    throw new Error('OAuth token request failed (' + code + '): ' + text.substring(0, 300));
  }

  var data = JSON.parse(text);
  return data.access_token;
}

// ── WorkWave Sales Center API Proxy ──
// 1. Gets OAuth2 access token
// 2. Calls POST /public/searchOpportunity with all four required headers
function _workwaveSearch(body) {
  var props = PropertiesService.getScriptProperties();
  var WW_BASE = 'https://api.marketing.workwave.com';
  var WW_TENANT = props.getProperty('WW_TENANT');
  var WW_USER = props.getProperty('WW_USER');
  var API_KEY = props.getProperty('PP_API_KEY');

  // Step 1: Get OAuth2 access token
  var accessToken = _getAccessToken();

  // Step 2: Build the search payload
  var searchPayload = {};
  var ALLOWED_FIELDS = [
    'fromCreatedTime', 'toCreatedTime',
    'fromDateClosed', 'toDateClosed',
    'fromUpdatedTime', 'toUpdatedTime',
    'lastUpdatedTime',
    'status', 'salesFunnelName',
    'skip', 'take', 'customFields',
    'isAdOnly', 'useTenantLocaleDateFormat'
  ];
  ALLOWED_FIELDS.forEach(function(f) {
    if (body[f] !== undefined) searchPayload[f] = body[f];
  });

  if (!searchPayload.take) searchPayload.take = 500;
  if (searchPayload.skip === undefined) searchPayload.skip = 0;

  try {
    // Step 3: Call Sales Center API with all four required headers
    var response = UrlFetchApp.fetch(WW_BASE + '/public/searchOpportunity', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'apikey': API_KEY,
        'Authorization': 'Bearer ' + accessToken,
        'tenant-id': WW_TENANT,
        'marketingUserId': WW_USER
      },
      payload: JSON.stringify(searchPayload),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    var text = response.getContentText();

    if (code !== 200) {
      return _json({ error: 'WorkWave API returned ' + code, details: text.substring(0, 500) });
    }

    var data = JSON.parse(text);
    return _json({ success: true, data: data, _requestPayload: searchPayload });
  } catch (err) {
    return _json({ error: 'WorkWave fetch failed: ' + err.message });
  }
}

// ── Test function: tries 3 auth combos to find what works ──
function testWorkWaveAuth() {
  var accessToken = _getAccessToken();
  Logger.log('Access token obtained: ' + accessToken.substring(0, 20) + '...');

  var props = PropertiesService.getScriptProperties();

  // Try 1: Bearer + tenant-id + marketingUserId (no apikey)
  var response = UrlFetchApp.fetch('https://api.marketing.workwave.com/public/searchOpportunity', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'tenant-id': props.getProperty('WW_TENANT'),
      'marketingUserId': props.getProperty('WW_USER')
    },
    payload: JSON.stringify({ take: 1, skip: 0 }),
    muteHttpExceptions: true
  });
  Logger.log('Try 1 (Bearer+tenant+user): ' + response.getResponseCode());
  Logger.log('Body: ' + response.getContentText().substring(0, 500));

  // Try 2: Bearer + tenant-id + marketingUserId + apikey
  var response2 = UrlFetchApp.fetch('https://api.marketing.workwave.com/public/searchOpportunity', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': props.getProperty('PP_API_KEY'),
      'Authorization': 'Bearer ' + accessToken,
      'tenant-id': props.getProperty('WW_TENANT'),
      'marketingUserId': props.getProperty('WW_USER')
    },
    payload: JSON.stringify({ take: 1, skip: 0 }),
    muteHttpExceptions: true
  });
  Logger.log('Try 2 (Bearer+tenant+user+apikey): ' + response2.getResponseCode());
  Logger.log('Body: ' + response2.getContentText().substring(0, 500));

  // Try 3: marketingUserId AS the Bearer token
  var response3 = UrlFetchApp.fetch('https://api.marketing.workwave.com/public/searchOpportunity', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + props.getProperty('WW_USER'),
      'tenant-id': props.getProperty('WW_TENANT')
    },
    payload: JSON.stringify({ take: 1, skip: 0 }),
    muteHttpExceptions: true
  });
  Logger.log('Try 3 (marketingUserId as Bearer): ' + response3.getResponseCode());
  Logger.log('Body: ' + response3.getContentText().substring(0, 500));
}

// ══════════════════════════════════════════════════════════════
// Sales Center YTD Cache
function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

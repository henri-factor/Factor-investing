/**
 * Factor Desk — Drive & Sheet saver (Google Apps Script)
 * --------------------------------------------------------
 * Receives a "save quarter" payload from the Factor Desk tool and:
 *   1. Saves the data CSV and basket CSV into a Drive folder you choose.
 *   2. Appends the quarter's account value + deposits into your XIRR sheet.
 *
 * ONE-TIME SETUP (only if you want AUTOMATIC sync — the tool works without it):
 *   1. Open your XIRR Google Sheet.
 *   2. Extensions -> Apps Script. Delete any code there, paste THIS file.
 *   3. You do NOT need to edit anything below — the defaults auto-create a
 *      "Factor Desk Saves" folder and write to the sheet you opened.
 *   4. Deploy -> New deployment -> type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone       <-- THIS is the step people miss.
 *      Copy the Web app URL it gives you (it ends in /exec).
 *   5. The FIRST time, Google shows "Google hasn't verified this app" — this is
 *      normal for your own script. Click "Advanced", then
 *      "Go to <project> (unsafe)", then "Allow". It is your own code.
 *   6. Paste the /exec URL into the tool (step 4 -> Google Drive sync), then
 *      click "Test connection". It should say "Connected".
 *
 * Keep the Web app URL private — treat it like a password.
 *
 * MULTIPLE PORTFOLIOS: deploy ONE copy of this script per portfolio, each
 * bound to that portfolio's own XIRR Sheet and its own DRIVE_FOLDER_ID. You
 * get one /exec URL per portfolio; paste each into the matching portfolio in
 * the tool (step 4 → Active portfolio → Google Drive sync). Separate URLs +
 * separate folders are what keep portfolios fully isolated.
 */

// ====================== CONFIG ======================
// The Drive folder ID where CSVs are saved. To get it: open the folder in
// Drive, the URL ends with /folders/XXXXXXXX — paste XXXXXXXX between the quotes.
// Leave as "" to auto-create a folder named "Factor Desk Saves" in My Drive.
var DRIVE_FOLDER_ID = "";

// Name of the tab in this spreadsheet to append quarter values into.
// Must match your XIRR template tab. Leave "" to skip sheet writing.
var QUARTER_VALUES_TAB = "Quarter Values";
var CASH_FLOWS_TAB     = "Cash Flows";

// A shared secret so only your tool can write. Make up any string, put the
// SAME string in the tool's settings. Leave "" to disable the check.
var SHARED_SECRET = "";
// ====================================================


function doPost(e) {
  // Serialize runs: an Apps Script web-app POST can be replayed (302 redirect
  // quirk), causing two near-simultaneous executions. A lock makes the second
  // one wait, so the overwrite logic sees the first one's file and replaces it
  // instead of both writing in parallel and leaving duplicates.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (le) { return _json({ ok: false, error: "busy, try again" }); }
  try {
    // The tool posts via a hidden form (field "payload") so it works from a
    // local file. Also accept a raw JSON body for flexibility.
    var raw;
    if (e && e.parameter && e.parameter.payload) {
      raw = e.parameter.payload;
    } else if (e && e.postData && e.postData.contents) {
      raw = e.postData.contents;
    } else {
      return _json({ ok: false, error: "no payload received" });
    }
    var body = JSON.parse(raw);

    if (SHARED_SECRET && body.secret !== SHARED_SECRET) {
      return _json({ ok: false, error: "bad secret" });
    }

    var folder = _getFolder();
    var label = _safe(body.label || "");
    if (!label) return _json({ ok: false, error: "missing label — set a Quarter label in the tool" });
    var saved = [];

    // Stable filenames per quarter label (no timestamp) so a re-save overwrites.
    if (body.dataCSV) {
      _writeOrReplace(folder, label + "_data.csv", body.dataCSV);
      saved.push(label + "_data.csv");
    }
    if (body.basketCSV) {
      _writeOrReplace(folder, label + "_basket.csv", body.basketCSV);
      saved.push(label + "_basket.csv");
    }

    // Update the quarter's row in the sheet (overwrite if the label already exists).
    if (QUARTER_VALUES_TAB && body.quarterValue) {
      _upsertQuarterValue(body.label, body.quarterValue);
    }
    if (CASH_FLOWS_TAB && body.cashFlows && body.cashFlows.length) {
      _appendCashFlows(body.cashFlows);
    }

    Logger.log("Saved (overwrite by label '" + label + "'): " + saved.join(", "));
    return _json({ ok: true, saved: saved });

  } catch (err) {
    Logger.log("ERROR: " + err);
    return _json({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (le2) {}
  }
}

// Delete any existing files with this exact name in the folder, then create fresh.
function _writeOrReplace(folder, name, content) {
  // Trash EVERY existing file with this name (handles duplicates from rapid
  // double-saves), then write exactly one fresh copy.
  var existing = folder.getFilesByName(name);
  while (existing.hasNext()) { existing.next().setTrashed(true); }
  Utilities.sleep(300); // let Drive settle so the new file is the only one
  // re-check in case another near-simultaneous run created one
  var again = folder.getFilesByName(name);
  while (again.hasNext()) { again.next().setTrashed(true); }
  folder.createFile(name, content, MimeType.CSV);
}

// Lightweight health check so you can open the URL in a browser and see it's live.
function doGet() {
  return _json({ ok: true, service: "Factor Desk saver", time: new Date().toISOString() });
}

function _getFolder() {
  if (DRIVE_FOLDER_ID) return DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var it = DriveApp.getFoldersByName("Factor Desk Saves");
  return it.hasNext() ? it.next() : DriveApp.createFolder("Factor Desk Saves");
}

function _upsertQuarterValue(label, qv) {
  // Overwrite the row whose Note (col F) matches this quarter label; else append.
  // qv = { date:"2026-06-15", invested:141000, cash:2500, note:"2026 Q2" }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(QUARTER_VALUES_TAB);
  if (!sh) return;
  var key = String(label).trim();
  var notes = sh.getRange("F2:F").getValues();   // col F = Note
  var dates = sh.getRange("A2:A").getValues();   // col A = date
  var row = 0;
  // 1) try to find an existing row with the same label in Note
  for (var i = 0; i < notes.length; i++) {
    if (String(notes[i][0]).trim() === key && key !== "") { row = i + 2; break; }
  }
  // 2) otherwise use the first empty row (by col A)
  if (!row) {
    row = 2;
    for (var j = 0; j < dates.length; j++) {
      if (dates[j][0] === "" || dates[j][0] === null) { row = j + 2; break; }
      row = j + 3;
    }
  }
  sh.getRange(row, 1).setValue(new Date(qv.date));
  sh.getRange(row, 2).setValue(qv.invested);
  sh.getRange(row, 3).setValue(qv.cash || 0);
  // cols D (total) and E (SPY) hold template formulas; only fill D if no formula present.
  if (!sh.getRange(row, 4).getFormula()) sh.getRange(row, 4).setValue((qv.invested||0)+(qv.cash||0));
  sh.getRange(row, 6).setValue(key);  // store the label as the match key
}

function _appendCashFlows(flows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CASH_FLOWS_TAB);
  if (!sh) return;
  var existing = sh.getRange("A2:B").getValues();
  var seen = {};
  existing.forEach(function(r){ if (r[0]) seen[_key(r[0], r[1])] = true; });
  var row = 2;
  for (var i = 0; i < existing.length; i++) { if (!existing[i][0]) { row = i + 2; break; } row = i + 3; }
  flows.forEach(function(cf){
    var d = new Date(cf.date);
    if (seen[_key(d, cf.amount)]) return; // skip duplicates
    sh.getRange(row, 1).setValue(d);
    sh.getRange(row, 2).setValue(cf.amount);
    sh.getRange(row, 3).setValue(cf.type || "Deposit");
    sh.getRange(row, 4).setValue(cf.note || "");
    row++;
  });
}

function _key(d, a) {
  var t = (d instanceof Date) ? d.toISOString().slice(0,10) : String(d);
  return t + "|" + a;
}
function _safe(s){ return String(s).replace(/[^A-Za-z0-9_\- ]/g,"").replace(/\s+/g,"_"); }
function _json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Habit Tracker -> Google Drive backup
// secret token : bd3e4ebf5e044cd6b8cc69775c379faa93cbd9b5c5114b4181d94183798b5225
// Deployment id : AKfycbzs0IE6rT8ymNmD3cc23u3b7de7PANAz0ktfAgPMwbJB_K9jExe3weuGjPIrUjyFh0
//URL:  https://script.google.com/macros/s/AKfycbzs0IE6rT8ymNmD3cc23u3b7de7PANAz0ktfAgPMwbJB_K9jExe3weuGjPIrUjyFh0/exec


const FOLDER_NAME = 'HabitBackup';
const LATEST = 'latest.json';
const KEEP_DAILY = 14; // rollback copies kept

function setup() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('TOKEN')) {
    p.setProperty('TOKEN', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  }
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('monthlySnapshot').timeBased().onMonthDay(1).atHour(3).create();
  folder_();
  Logger.log('YOUR SECRET TOKEN: ' + p.getProperty('TOKEN'));
}

function folder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function find_(f, name) {
  const it = f.getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function ok_(t) {
  return t && t === PropertiesService.getScriptProperties().getProperty('TOKEN');
}

// Page -> Drive
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!ok_(body.token)) return out_({ ok: false, err: 'bad token' });
    const d = body.data;
    if (!d || !Array.isArray(d.h) || !d.d) return out_({ ok: false, err: 'bad data' });

    const f = folder_();
    const cur = find_(f, LATEST);
    const tz = Session.getScriptTimeZone();

    // One rollback copy per day, made before the first overwrite of that day
    if (cur) {
      const dn = 'daily-' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd') + '.json';
      if (!find_(f, dn)) cur.makeCopy(dn, f);
      prune_(f);
    }

    const txt = JSON.stringify(d);
    if (cur) cur.setContent(txt); else f.createFile(LATEST, txt, MimeType.PLAIN_TEXT);
    return out_({ ok: true, t: new Date().toISOString() });
  } catch (err) {
    return out_({ ok: false, err: String(err) });
  }
}

// Drive -> page (Restore button)
function doGet(e) {
  if (!ok_(e.parameter.token)) return out_({ ok: false, err: 'bad token' });
  const cur = find_(folder_(), LATEST);
  if (!cur) return out_({ ok: false, err: 'no backup yet' });
  return out_({ ok: true, data: JSON.parse(cur.getBlob().getDataAsString()) });
}

// Keep only the newest KEEP_DAILY rollback copies
function prune_(f) {
  const names = [];
  const it = f.getFiles();
  while (it.hasNext()) {
    const x = it.next();
    if (/^daily-\d{4}-\d{2}-\d{2}\.json$/.test(x.getName())) names.push(x);
  }
  names.sort((a, b) => a.getName() < b.getName() ? 1 : -1);
  names.slice(KEEP_DAILY).forEach(x => x.setTrashed(true));
}

// Runs on the 1st of every month: copy latest.json as habit-backup-YYYY-MM.json (previous month)
function monthlySnapshot() {
  const f = folder_();
  const cur = find_(f, LATEST);
  if (!cur) return;
  const prev = new Date();
  prev.setDate(0); // last day of previous month
  const name = 'habit-backup-' + Utilities.formatDate(prev, Session.getScriptTimeZone(), 'yyyy-MM') + '.json';
  const old = find_(f, name);
  if (old) old.setTrashed(true);
  cur.makeCopy(name, f);
}

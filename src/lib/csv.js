// Download rows as a CSV file (opens in Excel / Google Sheets).
export function downloadCsv(filename, rows) {
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // stop spreadsheet formula injection
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const text = '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

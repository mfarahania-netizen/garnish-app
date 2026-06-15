// GARNISH-DASHBOARD-L4-17 — client-side CSV export (no backend change).
// If a view is awaiting-pilot, callers pass that note so the export is honest about empty data.

function escapeCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** rows: array of plain objects. Columns inferred from the first row (or `columns` override). */
export function downloadCsv(filename, rows, columns) {
  const list = Array.isArray(rows) ? rows : [];
  const cols = columns || (list[0] ? Object.keys(list[0]) : []);
  const header = cols.map(escapeCell).join(',');
  const body = list.map((r) => cols.map((c) => escapeCell(r[c])).join(',')).join('\n');
  const csv = '﻿' + [header, body].filter(Boolean).join('\n'); // BOM for Excel + Persian
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

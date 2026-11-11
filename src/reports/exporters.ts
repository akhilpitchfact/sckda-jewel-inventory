// PDF (jsPDF + autotable) and Excel (ExcelJS) exporters for every report.
// Libraries are loaded on demand so the main app stays light on tablets.
import { api, photoUrl } from '../api';
import { dateTime, grams } from '../format';
import type { Article, ArticleItem, AuditEntry, Photo } from '../types';

export interface Column { key: string; label: string; align?: 'left' | 'right' | 'center'; num?: number }
export interface Section { heading?: string; columns: Column[]; rows: Record<string, unknown>[]; totals?: Record<string, unknown> }
export interface ReportDoc { title: string; titleKn?: string; period: string; sections: Section[]; summary?: [string, string][]; landscape?: boolean; fileName: string }

const AUTHORITY = 'Sri Chamundeshwari Kshetra Development Authority, Mysuru';
const MAROON: [number, number, number] = [90, 21, 25];
const GOLD: [number, number, number] = [200, 150, 42];

export const cell = (v: unknown, c: Column) => {
  if (v == null || v === '') return c.num != null ? '' : '—';
  if (c.num != null && typeof v === 'number') return v.toLocaleString('en-IN', { minimumFractionDigits: c.num, maximumFractionDigits: c.num });
  return String(v);
};

async function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); });
}

let fontCache: string | null = null;
async function loadFont(): Promise<string | null> {
  if (fontCache) return fontCache;
  try {
    const buf = await (await fetch('/fonts/NotoSansKannada-Regular.ttf')).arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    fontCache = btoa(bin);
    return fontCache;
  } catch { return null; }
}

let logoCache: string | null = null;
async function loadLogo() {
  if (logoCache) return logoCache;
  try { logoCache = await blobToDataUrl(await (await fetch('/logo-sckda.png')).blob()); } catch { logoCache = null; }
  return logoCache;
}

async function newPdf(landscape: boolean) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const font = await loadFont();
  if (font) {
    doc.addFileToVFS('NotoSansKannada.ttf', font);
    doc.addFont('NotoSansKannada.ttf', 'Noto', 'normal');
    doc.addFont('NotoSansKannada.ttf', 'Noto', 'bold');
    doc.setFont('Noto');
  }
  return { doc, autoTable, fontName: font ? 'Noto' : 'helvetica' };
}

function header(doc: import('jspdf').jsPDF, title: string, period: string, logo: string | null) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...MAROON);
  doc.rect(0, 0, w, 24, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 24, w, 1.2, 'F');
  if (logo) { doc.setFillColor(255, 255, 255); doc.circle(16, 12, 8.5, 'F'); doc.addImage(logo, 'PNG', 8.5, 4.5, 15, 15); }
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(AUTHORITY, 28, 9);
  doc.setFontSize(14);
  doc.setTextColor(245, 225, 164);
  doc.text(title, 28, 16.5);
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(period, w - 10, 16.5, { align: 'right' });
  doc.setTextColor(43, 43, 43);
}

function footers(doc: import('jspdf').jsPDF, generatedBy: string) {
  const n = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated ${dateTime(new Date().toISOString())} by ${generatedBy} · SCKDA Gold & Silver Inventory`, 10, h - 6);
    doc.text(`Page ${i} of ${n}`, w - 10, h - 6, { align: 'right' });
  }
}

export async function exportPdf(r: ReportDoc, generatedBy: string) {
  const { doc, autoTable, fontName } = await newPdf(r.landscape ?? true);
  const logo = await loadLogo();
  header(doc, r.title, r.period, logo);
  let y = 32;
  if (r.summary?.length) {
    autoTable(doc, {
      startY: y, theme: 'plain', styles: { font: fontName, fontSize: 9, cellPadding: 1.2 },
      body: r.summary.map(([k, v]) => [k, v]), columnStyles: { 0: { textColor: [110, 110, 110], cellWidth: 60 }, 1: { fontStyle: 'bold' } },
      margin: { left: 10, right: 10 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }
  for (const s of r.sections) {
    if (s.heading) {
      if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 14; }
      doc.setFontSize(11); doc.setTextColor(...MAROON); doc.text(s.heading, 10, y + 2); doc.setTextColor(43, 43, 43);
      y += 5;
    }
    autoTable(doc, {
      startY: y,
      head: [s.columns.map((c) => c.label)],
      body: s.rows.length ? s.rows.map((row) => s.columns.map((c) => cell(row[c.key], c))) : [[{ content: 'No records', colSpan: s.columns.length, styles: { halign: 'center', textColor: [140, 140, 140] } }]],
      foot: s.totals ? [s.columns.map((c) => ({ content: cell(s.totals![c.key], c), styles: { halign: c.align || (c.num != null ? 'right' : 'left') } }))] : undefined,
      styles: { font: fontName, fontSize: 8, cellPadding: 1.6, lineColor: [226, 214, 189], lineWidth: 0.1, overflow: 'linebreak' },
      headStyles: { fillColor: MAROON, textColor: [245, 225, 164], fontStyle: 'bold' },
      footStyles: { fillColor: [251, 241, 211], textColor: [43, 43, 43], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [253, 251, 247] },
      columnStyles: Object.fromEntries(s.columns.map((c, i) => [i, { halign: c.align || (c.num != null ? 'right' : 'left') }])),
      margin: { left: 10, right: 10, top: 14, bottom: 14 },
      showFoot: 'lastPage',
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }
  footers(doc, generatedBy);
  doc.save(`${r.fileName}.pdf`);
}

export async function exportExcel(r: ReportDoc, generatedBy: string) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SCKDA Gold & Silver Inventory';
  wb.created = new Date();
  const ws = wb.addWorksheet(r.title.slice(0, 31).replace(/[\\/?*[\]:]/g, '-'), { views: [{ state: 'frozen', ySplit: 0 }] });
  const width = Math.max(...r.sections.map((s) => s.columns.length));
  const title = ws.addRow([AUTHORITY]);
  title.font = { bold: true, size: 12, color: { argb: 'FF5A1519' } };
  ws.mergeCells(1, 1, 1, width);
  const t2 = ws.addRow([r.title]);
  t2.font = { bold: true, size: 14, color: { argb: 'FFA8791C' } };
  ws.mergeCells(2, 1, 2, width);
  ws.addRow([`Period: ${r.period}`]);
  ws.addRow([`Generated ${dateTime(new Date().toISOString())} by ${generatedBy}`]).font = { italic: true, color: { argb: 'FF777777' } };
  ws.addRow([]);
  for (const [k, v] of r.summary || []) { const row = ws.addRow([k, v]); row.getCell(1).font = { color: { argb: 'FF777777' } }; row.getCell(2).font = { bold: true }; }
  if (r.summary?.length) ws.addRow([]);
  for (const s of r.sections) {
    if (s.heading) ws.addRow([s.heading]).font = { bold: true, size: 12, color: { argb: 'FF5A1519' } };
    const h = ws.addRow(s.columns.map((c) => c.label));
    h.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFF5E1A4' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5A1519' } };
      c.alignment = { vertical: 'middle', wrapText: true };
    });
    for (const row of s.rows) {
      const xr = ws.addRow(s.columns.map((c) => (c.num != null && typeof row[c.key] === 'number' ? row[c.key] : row[c.key] ?? '')));
      s.columns.forEach((c, i) => { if (c.num != null) xr.getCell(i + 1).numFmt = c.num ? `#,##0.${'0'.repeat(c.num)}` : '#,##0'; });
    }
    if (s.totals) {
      const tr = ws.addRow(s.columns.map((c) => s.totals![c.key] ?? ''));
      tr.font = { bold: true };
      tr.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBF1D3' } }; });
      s.columns.forEach((c, i) => { if (c.num != null) tr.getCell(i + 1).numFmt = c.num ? `#,##0.${'0'.repeat(c.num)}` : '#,##0'; });
    }
    ws.addRow([]);
  }
  ws.columns.forEach((col, i) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (c) => { if (Number(c.row) > 5) max = Math.max(max, String(c.value ?? '').length); });
    ws.getColumn(i + 1).width = Math.min(45, max + 2);
  });
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${r.fileName}.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Individual Article Register with photographs: one page per article. */
export async function articleRegisterPdf(
  list: { article: Article; items: ArticleItem[]; photos: Photo[]; history?: AuditEntry[] }[],
  generatedBy = '',
  period?: string,
  onProgress?: (done: number, total: number) => void,
) {
  const { doc, autoTable, fontName } = await newPdf(false);
  const logo = await loadLogo();
  const w = doc.internal.pageSize.getWidth();
  for (let idx = 0; idx < list.length; idx++) {
    const { article: a, items, photos } = list[idx];
    if (idx > 0) doc.addPage();
    header(doc, 'Individual Article Register', period || a.article_no, logo);
    doc.setFontSize(18); doc.setTextColor(...MAROON); doc.text(a.article_no, 10, 36);
    doc.setFontSize(10); doc.setTextColor(43, 43, 43);
    doc.text(`${a.metal === 'gold' ? 'GOLD' : 'SILVER'} · ${a.status.toUpperCase()}`, w - 10, 36, { align: 'right' });
    const rows: [string, string][] = [
      ['Category', `${a.category_name}${a.article_type ? ' · ' + a.article_type : ''}`],
      ['Description', a.description],
      ['Quantity', String(a.quantity)],
      ['Gross weight', grams(a.gross_weight)],
      ['Net weight', a.net_weight != null ? grams(a.net_weight) : '—'],
      ['Purity', [a.purity, a.purity_remarks].filter(Boolean).join(' · ') || 'Not assessed'],
      ['Source', `${a.source === 'hundi' ? 'Hundi' : 'Seva'}${a.receipt_ref ? ' · ' + a.receipt_ref : ''}`],
      ['Received', dateTime(a.received_at)],
      ['Donor', a.donor_hidden ? 'Restricted' : [a.donor_name, a.donor_mobile, a.donor_address].filter(Boolean).join(' · ') || (a.source === 'hundi' ? 'Anonymous (Hundi)' : '—')],
      ['Weighed by', a.weighed_by || '—'],
      ['Registered by', `${a.created_by_name}, ${dateTime(a.created_at)}`],
      ['Verified by', a.verified_by_name ? `${a.verified_by_name}, ${dateTime(a.verified_at)}` : '—'],
      ['Remarks', a.remarks || '—'],
    ];
    autoTable(doc, {
      startY: 40, theme: 'grid', body: rows,
      styles: { font: fontName, fontSize: 9, cellPadding: 1.8, lineColor: [226, 214, 189], lineWidth: 0.1 },
      columnStyles: { 0: { cellWidth: 35, textColor: [110, 110, 110] } }, margin: { left: 10, right: 10 },
    });
    let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    if (items.length) {
      autoTable(doc, {
        startY: y, head: [['#', 'Piece', 'Weight (g)']],
        body: items.map((i) => [String(i.line_no), i.description || '—', i.weight.toFixed(3)]),
        styles: { font: fontName, fontSize: 8, cellPadding: 1.4 }, headStyles: { fillColor: MAROON, textColor: [245, 225, 164] },
        columnStyles: { 2: { halign: 'right' } }, margin: { left: 10, right: 10 },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    }
    // Photos: up to 6 per page in a 3-column grid.
    const size = (w - 20 - 8) / 3;
    let col = 0;
    for (const p of photos) {
      try {
        const blob = await (await fetch(photoUrl(p.id), { credentials: 'same-origin' })).blob();
        const url = await blobToDataUrl(blob);
        const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        if (y + size > doc.internal.pageSize.getHeight() - 14) { doc.addPage(); header(doc, 'Individual Article Register (photos continued)', a.article_no, logo); y = 32; col = 0; }
        const ratio = img.width / img.height;
        const iw = ratio >= 1 ? size : size * ratio;
        const ih = ratio >= 1 ? size / ratio : size;
        const x = 10 + col * (size + 4);
        doc.setDrawColor(...GOLD); doc.rect(x, y, size, size);
        doc.addImage(url, blob.type.includes('png') ? 'PNG' : 'JPEG', x + (size - iw) / 2, y + (size - ih) / 2, iw, ih);
        col += 1;
        if (col === 3) { col = 0; y += size + 4; }
      } catch { /* skip unreadable photo */ }
    }
    if (!photos.length) { doc.setFontSize(9); doc.setTextColor(170, 100, 0); doc.text('No photograph attached.', 10, y + 4); }
    onProgress?.(idx + 1, list.length);
  }
  footers(doc, generatedBy || 'SCKDA');
  doc.save(list.length === 1 ? `${list[0].article.article_no}-register.pdf` : `article-register-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function loadDetails(articles: Article[]) {
  const out = [];
  for (const a of articles) out.push(await api.get<{ article: Article; items: ArticleItem[]; photos: Photo[] }>(`/articles/${a.id}`));
  return out;
}

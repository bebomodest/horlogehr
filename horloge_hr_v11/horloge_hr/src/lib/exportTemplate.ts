/**
 * Unified Export Template
 * Supports Arabic, Logo (base64), Statistics
 * Print-optimized with forced colors
 */

const LOGO_URL = 'https://up6.cc/2026/03/177489580765681.png';

// Convert logo to base64 - try fetch first, then canvas
const getLogoBase64 = async (): Promise<string> => {
  // Strategy 1: fetch with CORS
  try {
    const res = await fetch(LOGO_URL, { mode: 'cors', cache: 'no-cache' });
    if (res.ok) {
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
    }
  } catch { /* try next */ }

  // Strategy 2: canvas drawImage
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timeout = setTimeout(() => resolve(''), 4000);
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 400;
          canvas.height = img.naturalHeight || 200;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(''); return; }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch { resolve(''); }
      };
      img.onerror = () => { clearTimeout(timeout); resolve(''); };
      img.src = LOGO_URL;
    });
  } catch { return ''; }
};

// ===================================================
// SHARED HTML TEMPLATE
// ===================================================
export const buildReportHTML = async (
  title: string,
  subtitle: string,
  extractorName: string,
  extractorRole: string,
  tableHeaders: string[],
  tableData: any[][],
  statsRows: { label: string; value: string }[],
  orientation: 'portrait' | 'landscape' = 'landscape'
): Promise<string> => {
  const logoBase64 = await getLogoBase64();
  const now = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const rowsHTML = tableData.map((row, i) => `
    <tr class="${i % 2 === 1 ? 'alt' : ''}">
      ${row.map(cell => `<td>${cell ?? '-'}</td>`).join('')}
    </tr>
  `).join('');

  const headersHTML = tableHeaders.map(h => `<th>${h}</th>`).join('');

  const statsHTML = statsRows.length > 0 ? `
    <div class="stats-section">
      <div class="stats-title">الإحصائيات</div>
      <div class="stats-grid">
        ${statsRows.map(s => `
          <div class="stat-card">
            <div class="stat-label">${s.label}</div>
            <div class="stat-value">${s.value}</div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const logoHTML = logoBase64
    ? `<img src="${logoBase64}" alt="Horloge HR" style="height:65px;object-fit:contain;margin-bottom:8px;" />`
    : `<div style="font-size:22px;font-weight:900;color:#76151e;font-family:serif;letter-spacing:2px;margin-bottom:8px;">HORLOGE HR</div>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Cairo', Arial, sans-serif;
      background: #ffffff;
      color: #3a2a1f;
      direction: rtl;
      padding: 14mm 12mm;
    }

    /* ─── HEADER ─── */
    .header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding-bottom: 12px;
      border-bottom: 3px solid #76151e;
      margin-bottom: 12px;
    }
    .extractor-info {
      font-size: 11px;
      color: #5a4a3f;
      background-color: #f9f5f0;
      padding: 4px 18px;
      border-radius: 20px;
      display: inline-block;
      border: 1px solid #e6dfd3;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .extractor-info b { color: #76151e; }

    /* ─── TITLES ─── */
    .report-title {
      text-align: center;
      font-size: 16px;
      font-weight: 900;
      color: #76151e;
      margin: 10px 0 4px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .report-subtitle {
      text-align: center;
      font-size: 10px;
      color: #5a4a3f;
      font-weight: 600;
      margin-bottom: 3px;
    }
    .date-info {
      text-align: center;
      font-size: 9px;
      color: #9a8a7f;
      margin-bottom: 12px;
    }

    /* ─── TABLE ─── */
    table { width: 100%; border-collapse: collapse; font-size: 9.5px; }

    thead tr {
      background-color: #76151e !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    thead th {
      padding: 7px 8px;
      text-align: center;
      font-weight: 700;
      color: #ffffff !important;
      border: 1px solid #8a1923;
      white-space: nowrap;
      background-color: #76151e !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    tbody td {
      padding: 6px 8px;
      text-align: center;
      border: 1px solid #e6dfd3;
      color: #3a2a1f;
    }
    tr.alt td {
      background-color: #faf7f3 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ─── STATS ─── */
    .stats-section {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 2px solid #e6dfd3;
    }
    .stats-title {
      font-size: 13px;
      font-weight: 900;
      color: #76151e;
      margin-bottom: 10px;
      text-align: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 8px;
    }
    .stat-card {
      background-color: #f9f5f0 !important;
      border: 1px solid #e6dfd3;
      border-radius: 8px;
      padding: 8px 10px;
      text-align: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .stat-label { font-size: 9px; color: #7a6a5f; margin-bottom: 4px; font-weight: 600; }
    .stat-value { font-size: 16px; font-weight: 900; color: #76151e; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* ─── FOOTER ─── */
    .footer {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #d6cfc3;
      text-align: center;
    }
    .footer-main { font-size: 9px; font-weight: 700; color: #5a4a3f; }
    .footer-sub { font-size: 7px; color: #9a8a7f; margin-top: 2px; }

    /* ─── PRINT ─── */
    @media print {
      body { padding: 8mm; }
      @page {
        size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
        margin: 8mm;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoHTML}
    <div class="extractor-info">
      مستخرج التقرير: <b>${extractorName}</b>
      &nbsp;·&nbsp;
      الوظيفة: <b>${extractorRole}</b>
    </div>
  </div>

  <div class="report-title">${title}</div>
  ${subtitle ? `<div class="report-subtitle">${subtitle}</div>` : ''}
  <div class="date-info">تاريخ الاستخراج: ${now}</div>

  <table>
    <thead><tr>${headersHTML}</tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table>

  ${statsHTML}

  <div class="footer">
    <div class="footer-main">Copyright © 2026, Horloge HR</div>
    <div class="footer-sub">POWERED BY NOBA AI TECHNOLOGY</div>
  </div>

  <script>
    // Auto-print after fonts and logo load
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 1200);
    };
  </script>
</body>
</html>`;
};

// ===================================================
// PDF / PRINT EXPORT
// ===================================================
export const exportAsPDF = (html: string, _filename: string, _autoPrint = false) => {
  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) {
    alert('يرجى السماح بالنوافذ المنبثقة لتصدير التقرير');
    return;
  }
  win.document.write(html);
  win.document.close();
};

// ===================================================
// EXCEL EXPORT
// ===================================================
export const exportAsExcel = async (
  ExcelJS: any,
  title: string,
  subtitle: string,
  extractorName: string,
  extractorRole: string,
  tableHeaders: string[],
  tableData: any[][],
  statsRows: { label: string; value: string }[],
  filename: string
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('تقرير');
  worksheet.views = [{ rightToLeft: true }];
  const totalCols = Math.max(tableHeaders.length, 1);
  let rowIdx = 1;

  // Logo
  try {
    const logoBase64 = await getLogoBase64();
    if (logoBase64) {
      const base64Data = logoBase64.split(',')[1];
      const logoId = workbook.addImage({ base64: base64Data, extension: 'png' });
      worksheet.addImage(logoId, {
        tl: { col: Math.max(0, Math.floor(totalCols / 2) - 1), row: 0 },
        ext: { width: 120, height: 65 }
      });
    }
  } catch (e) { /* skip */ }

  for (let i = 0; i < 4; i++) { worksheet.addRow([]); rowIdx++; }

  const addMergedRow = (value: string, fontSize: number, bold: boolean, color: string, bg?: string) => {
    worksheet.mergeCells(rowIdx, 1, rowIdx, totalCols);
    const cell = worksheet.getCell(rowIdx, 1);
    cell.value = value;
    cell.font = { name: 'Cairo', bold, size: fontSize, color: { argb: color } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    worksheet.getRow(rowIdx).height = fontSize + 10;
    rowIdx++;
  };

  addMergedRow(title, 16, true, 'FF76151E');
  if (subtitle) addMergedRow(subtitle, 11, false, 'FF5A4A3F');
  addMergedRow(`مستخرج التقرير: ${extractorName}  ·  الوظيفة: ${extractorRole}`, 10, false, 'FF7A6A5F');
  addMergedRow(`تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}`, 9, false, 'FF9A8A7F');
  worksheet.addRow([]); rowIdx++;

  // Headers
  const headerRow = worksheet.getRow(rowIdx);
  tableHeaders.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Cairo', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF76151E' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });
  worksheet.getRow(rowIdx).height = 25;
  rowIdx++;

  // Data
  tableData.forEach((row, rIdx) => {
    const dataRow = worksheet.getRow(rowIdx);
    row.forEach((val, cIdx) => {
      const cell = dataRow.getCell(cIdx + 1);
      cell.value = val ?? '-';
      cell.font = { name: 'Cairo', size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rIdx % 2 === 0 ? 'FFFFFFFF' : 'FFFAF7F3' } };
      cell.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
    });
    worksheet.getRow(rowIdx).height = 20;
    rowIdx++;
  });

  worksheet.columns.forEach((col: any, i: number) => {
    col.width = Math.min(40, Math.max(tableHeaders[i]?.length + 4 || 15, ...tableData.map(row => String(row[i] ?? '').length + 2)));
  });

  if (statsRows.length > 0) {
    worksheet.addRow([]); rowIdx++;
    addMergedRow('الإحصائيات', 14, true, 'FF76151E', 'FFF9F5F0');
    statsRows.forEach(stat => {
      worksheet.mergeCells(rowIdx, 1, rowIdx, totalCols);
      const cell = worksheet.getCell(rowIdx, 1);
      cell.value = `${stat.label}:  ${stat.value}`;
      cell.font = { name: 'Cairo', size: 11, bold: true };
      cell.alignment = { horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF7F3' } };
      worksheet.getRow(rowIdx).height = 22;
      rowIdx++;
    });
  }

  worksheet.addRow([]); rowIdx++;
  addMergedRow('Copyright © 2026, Horloge HR  |  POWERED BY NOBA AI TECHNOLOGY', 9, false, 'FF9A8A7F');

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

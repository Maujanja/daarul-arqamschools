import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import dasLogo from '@/assets/das-logo.png';

export type ReportRow = Record<string, string | number>;

async function loadImageData(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export async function exportReportPdf(title: string, subtitle: string, rows: ReportRow[]) {
  const doc = new jsPDF({ orientation: rows[0] && Object.keys(rows[0]).length > 6 ? 'landscape' : 'portrait' });
  const w = doc.internal.pageSize.getWidth();
  const logo = await loadImageData(dasLogo);
  if (logo) doc.addImage(logo, 'PNG', w / 2 - 9, 8, 18, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('DAARUL-ARQAM SCHOOLS', w / 2, 32, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text("Qur'an, Taaluma na Maadili", w / 2, 37, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title.toUpperCase(), w / 2, 45, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(subtitle, w / 2, 50, { align: 'center' });
  const head = rows[0] ? Object.keys(rows[0]) : ['No data'];
  autoTable(doc, {
    startY: 55,
    head: [head],
    body: rows.length ? rows.map((r) => head.map((k) => String(r[k] ?? ''))) : [['No records']],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [14, 116, 144] },
  });
  doc.save(`${slug(title)}.pdf`);
}

export function exportReportExcel(title: string, rows: ReportRow[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'No records' }]), 'Report');
  XLSX.writeFile(wb, `${slug(title)}.xlsx`);
}

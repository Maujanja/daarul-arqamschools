import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

interface SeriesData {
  [series: string]: number | null;
}

interface RowData {
  sn: number;
  name: string; // Subject name for student/teacher, Class name for admin
  seriesData: SeriesData;
  average: number;
  grade: string;
  position?: number;
}

interface SeriesSummaryTableProps {
  title: string;
  subtitle?: string;
  data: RowData[];
  seriesLabels: string[]; // S1, S2, S3, etc.
  showPosition?: boolean;
  showAveragePerSeries?: boolean;
  averagePerSeries?: { [series: string]: number };
  onDownloadPDF?: () => void;
  pdfFileName?: string;
  className?: string;
}

export function SeriesSummaryTable({
  title,
  subtitle,
  data,
  seriesLabels,
  showPosition = true,
  showAveragePerSeries = false,
  averagePerSeries = {},
  pdfFileName = 'series_summary',
  className = '',
}: SeriesSummaryTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-success font-bold';
      case 'B': return 'text-primary font-bold';
      case 'C': return 'text-warning font-bold';
      case 'D': return 'text-orange-500 font-bold';
      case 'F': return 'text-destructive font-bold';
      default: return 'text-muted-foreground';
    }
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    
    if (subtitle) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(subtitle, doc.internal.pageSize.getWidth() / 2, 23, { align: 'center' });
    }

    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 32);

    // Prepare table data
    const headers = ['SN', 'Name', ...seriesLabels, 'AVER', 'GRADE'];
    if (showPosition) headers.push('POS');

    const tableData = data.map(row => {
      const rowData: (string | number)[] = [
        row.sn,
        row.name,
        ...seriesLabels.map(series => row.seriesData[series] ?? '-'),
        row.average.toFixed(2),
        row.grade,
      ];
      if (showPosition) rowData.push(row.position ?? '-');
      return rowData;
    });

    // Add average per series row if enabled
    if (showAveragePerSeries && Object.keys(averagePerSeries).length > 0) {
      const avgRow: (string | number)[] = [
        '',
        'AVERAGE PER SERIES',
        ...seriesLabels.map(series => averagePerSeries[series]?.toFixed(1) ?? '-'),
        '',
        '',
      ];
      if (showPosition) avgRow.push('');
      tableData.push(avgRow);
    }

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 38,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 35 },
      },
    });

    doc.save(`${pdfFileName}.pdf`);
  };

  return (
    <div className={`card-elevated p-6 animate-fade-in ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-lg text-card-foreground">{title}</h3>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
          <Download className="w-4 h-4 mr-2" />
          Download PDF
        </Button>
      </div>

      <div ref={tableRef} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-primary/20 bg-muted/50">
              <th className="py-3 px-2 text-left font-semibold text-muted-foreground">SN</th>
              <th className="py-3 px-2 text-left font-semibold text-muted-foreground min-w-[120px]">
                {data[0]?.name ? 'Name' : 'Subject/Class'}
              </th>
              {seriesLabels.map(series => (
                <th key={series} className="py-3 px-2 text-center font-semibold text-muted-foreground min-w-[40px]">
                  {series}
                </th>
              ))}
              <th className="py-3 px-2 text-center font-semibold text-muted-foreground">AVER</th>
              <th className="py-3 px-2 text-center font-semibold text-muted-foreground">GRADE</th>
              {showPosition && (
                <th className="py-3 px-2 text-center font-semibold text-muted-foreground">POS</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr 
                key={index} 
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                <td className="py-2 px-2 text-card-foreground">{row.sn}</td>
                <td className="py-2 px-2 font-medium text-card-foreground">{row.name}</td>
                {seriesLabels.map(series => (
                  <td key={series} className="py-2 px-2 text-center text-card-foreground">
                    {row.seriesData[series] !== null ? row.seriesData[series] : '-'}
                  </td>
                ))}
                <td className="py-2 px-2 text-center font-semibold text-primary">
                  {row.average.toFixed(2)}
                </td>
                <td className={`py-2 px-2 text-center ${getGradeColor(row.grade)}`}>
                  {row.grade}
                </td>
                {showPosition && (
                  <td className="py-2 px-2 text-center font-medium text-card-foreground">
                    {row.position}
                  </td>
                )}
              </tr>
            ))}
            {showAveragePerSeries && Object.keys(averagePerSeries).length > 0 && (
              <tr className="border-t-2 border-primary/30 bg-primary/5 font-bold">
                <td className="py-3 px-2"></td>
                <td className="py-3 px-2 text-primary">AVERAGE PER SERIES</td>
                {seriesLabels.map(series => (
                  <td key={series} className="py-3 px-2 text-center text-primary">
                    {averagePerSeries[series]?.toFixed(1) ?? '-'}
                  </td>
                ))}
                <td className="py-3 px-2"></td>
                <td className="py-3 px-2"></td>
                {showPosition && <td className="py-3 px-2"></td>}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SeriesData {
  [series: string]: number | null;
}

interface RowData {
  sn: number;
  name: string; // Subject name for student/teacher, Class name for admin
  seriesData: SeriesData;
  average: number | null;
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
  showSeriesSelector?: boolean; // Enable series selection for PDF download
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
  showSeriesSelector = false,
}: SeriesSummaryTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [selectedSeries, setSelectedSeries] = useState<Set<string>>(new Set(seriesLabels));

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

  const toggleSeriesSelection = (series: string) => {
    setSelectedSeries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(series)) {
        newSet.delete(series);
      } else {
        newSet.add(series);
      }
      return newSet;
    });
  };

  const selectAllSeries = () => {
    setSelectedSeries(new Set(seriesLabels));
  };

  const deselectAllSeries = () => {
    setSelectedSeries(new Set());
  };

  const handleDownloadPDF = async () => {
    const seriesToInclude = showSeriesSelector 
      ? seriesLabels.filter(s => selectedSeries.has(s))
      : seriesLabels;
    
    if (seriesToInclude.length === 0) {
      return;
    }
    
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
    
    if (showSeriesSelector && seriesToInclude.length < seriesLabels.length) {
      doc.text(`Selected Series: ${seriesToInclude.join(', ')}`, 14, 38);
    }

    // Prepare table data using selected series
    const headers = ['SN', 'Name', ...seriesToInclude, 'AVER', 'GRADE'];
    if (showPosition) headers.push('POS');

    const tableData = data.map(row => {
      // Recalculate average based on selected series only
      const selectedValues = seriesToInclude
        .map(series => row.seriesData[series])
        .filter((v): v is number => v !== null);
      const recalcAverage = selectedValues.length > 0
        ? selectedValues.reduce((a, b) => a + b, 0) / selectedValues.length
        : null;
      
      const rowData: (string | number)[] = [
        row.sn,
        row.name,
        ...seriesToInclude.map(series => row.seriesData[series] ?? '-'),
        recalcAverage !== null ? recalcAverage.toFixed(2) : '-',
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
        ...seriesToInclude.map(series => averagePerSeries[series]?.toFixed(1) ?? '-'),
        '',
        '',
      ];
      if (showPosition) avgRow.push('');
      tableData.push(avgRow);
    }

    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: showSeriesSelector && seriesToInclude.length < seriesLabels.length ? 44 : 38,
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
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold text-lg text-card-foreground">{title}</h3>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {showSeriesSelector && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  Select Series
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Select Series for PDF</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={selectAllSeries}>
                        All
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={deselectAllSeries}>
                        None
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {seriesLabels.map(series => (
                      <label key={series} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedSeries.has(series)}
                          onCheckedChange={() => toggleSeriesSelection(series)}
                        />
                        {series}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedSeries.size} of {seriesLabels.length} selected
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDownloadPDF}
            disabled={showSeriesSelector && selectedSeries.size === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
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
                  {row.average !== null ? row.average.toFixed(2) : '-'}
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

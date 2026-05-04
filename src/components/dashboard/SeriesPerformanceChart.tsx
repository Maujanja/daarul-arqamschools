import { useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

interface SeriesData {
  name: string;
  [key: string]: number | string | null;
}

interface SeriesPerformanceChartProps {
  data: SeriesData[];
  title: string;
  subtitle?: string;
  seriesKeys: string[]; // e.g., ['Class 1', 'Class 2'] or ['Math', 'Science']
  colors?: string[];
  pdfFileName?: string;
}

const DEFAULT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function SeriesPerformanceChart({ 
  data, 
  title, 
  subtitle,
  seriesKeys,
  colors = DEFAULT_COLORS,
  pdfFileName = 'performance_chart'
}: SeriesPerformanceChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    try {
      console.log('Starting chart PDF download (image capture)...');
      const node = chartRef.current;
      if (!node) {
        toast.error('Chart not ready. Please try again.');
        return;
      }

      toast.info('Preparing chart PDF...');

      // Capture the chart container as a high-DPI canvas
      const canvas = await html2canvas(node, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');

      // Landscape A4 fits wide line charts better
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;

      // Title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, margin + 4);

      let cursorY = margin + 8;
      if (subtitle) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(90);
        doc.text(subtitle, margin, cursorY + 4);
        cursorY += 6;
        doc.setTextColor(0);
      }

      // Compute image dimensions while preserving aspect ratio
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - cursorY - margin - 10; // leave space for footer
      const imgRatio = canvas.width / canvas.height;
      let imgWidth = availableWidth;
      let imgHeight = imgWidth / imgRatio;
      if (imgHeight > availableHeight) {
        imgHeight = availableHeight;
        imgWidth = imgHeight * imgRatio;
      }
      const imgX = margin + (availableWidth - imgWidth) / 2;
      const imgY = cursorY + 4;
      doc.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight);

      // Footer with timestamp
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, pageHeight - 6);

      doc.save(`${pdfFileName}.pdf`);
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Chart PDF generation error:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  if (data.length === 0 || seriesKeys.length === 0) {
    return (
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-2 text-card-foreground">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>}
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
        <div>
          <h3 className="font-display font-semibold text-lg text-card-foreground">{title}</h3>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Download PDF
        </Button>
      </div>
      <div ref={chartRef} className={data.length >= 6 ? "h-[420px] bg-card p-2 rounded" : "h-[350px] bg-card p-2 rounded"}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: data.length >= 6 ? 70 : 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="name" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={data.length > 10 ? 9 : 11}
              tickLine={false}
              axisLine={false}
              padding={{ left: 20, right: 20 }}
              interval={0}
              angle={data.length >= 6 ? -35 : 0}
              textAnchor={data.length >= 6 ? 'end' : 'middle'}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              labelStyle={{ color: 'hsl(var(--card-foreground))', fontWeight: 600 }}
              formatter={(value: number) => [`${Math.round(value)}%`, '']}
            />
            <Legend wrapperStyle={{ paddingTop: '10px', position: 'relative', bottom: 0 }} verticalAlign="top" />
            {seriesKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

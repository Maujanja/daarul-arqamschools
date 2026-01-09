import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 20);
    
    // Subtitle
    if (subtitle) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(subtitle, 14, 28);
    }
    
    // Create table headers: Series | Key1 | Key2 | ...
    const headers = ['Series', ...seriesKeys];
    
    // Create table rows
    const tableData = data.map(item => {
      const row = [item.name];
      seriesKeys.forEach(key => {
        const value = item[key];
        row.push(value !== undefined && value !== null ? `${Math.round(Number(value))}%` : '-');
      });
      return row;
    });
    
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: subtitle ? 35 : 30,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 30 }
      }
    });
    
    // Add timestamp
    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, finalY + 10);
    
    doc.save(`${pdfFileName}.pdf`);
    toast.success('PDF downloaded successfully!');
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
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="name" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
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
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
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

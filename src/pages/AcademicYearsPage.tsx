import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Calendar, Star, Trash2 } from 'lucide-react';

interface AcademicYear {
  id: string;
  year_name: string;
  is_current: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export default function AcademicYearsPage() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newYear, setNewYear] = useState({
    year_name: '',
    start_date: '',
    end_date: '',
  });

  const fetchAcademicYears = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .order('year_name', { ascending: false });

    if (error) {
      toast.error('Failed to fetch academic years');
      console.error(error);
    } else {
      setAcademicYears(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAcademicYears();
  }, []);

  const handleAddYear = async () => {
    if (!newYear.year_name.trim()) {
      toast.error('Please enter a year name (e.g., 2025-2026)');
      return;
    }

    // Validate format
    const yearPattern = /^\d{4}-\d{4}$/;
    if (!yearPattern.test(newYear.year_name)) {
      toast.error('Year must be in format YYYY-YYYY (e.g., 2025-2026)');
      return;
    }

    const { error } = await supabase.from('academic_years').insert({
      year_name: newYear.year_name,
      start_date: newYear.start_date || null,
      end_date: newYear.end_date || null,
      is_current: false,
    });

    if (error) {
      if (error.code === '23505') {
        toast.error('This academic year already exists');
      } else {
        toast.error('Failed to add academic year');
      }
      console.error(error);
    } else {
      toast.success('Academic year added successfully');
      setNewYear({ year_name: '', start_date: '', end_date: '' });
      setIsDialogOpen(false);
      fetchAcademicYears();
    }
  };

  const handleSetCurrent = async (yearId: string) => {
    // First, unset all current years
    await supabase.from('academic_years').update({ is_current: false }).neq('id', '');
    
    // Then set the selected year as current
    const { error } = await supabase
      .from('academic_years')
      .update({ is_current: true })
      .eq('id', yearId);

    if (error) {
      toast.error('Failed to set current year');
      console.error(error);
    } else {
      toast.success('Current academic year updated');
      fetchAcademicYears();
    }
  };

  const handleDelete = async (yearId: string, yearName: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete ${yearName}?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('academic_years')
      .delete()
      .eq('id', yearId);

    if (error) {
      toast.error('Failed to delete academic year');
      console.error(error);
    } else {
      toast.success('Academic year deleted');
      fetchAcademicYears();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Academic Years</h1>
            <p className="text-muted-foreground">Manage academic years for the school system</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add New Year
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Academic Year</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="year_name">Year Name *</Label>
                  <Input
                    id="year_name"
                    placeholder="e.g., 2025-2026"
                    value={newYear.year_name}
                    onChange={(e) => setNewYear({ ...newYear, year_name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={newYear.start_date}
                      onChange={(e) => setNewYear({ ...newYear, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={newYear.end_date}
                      onChange={(e) => setNewYear({ ...newYear, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleAddYear} className="w-full">
                  Add Academic Year
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              All Academic Years
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading...</p>
              </div>
            ) : academicYears.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No academic years found. Add one to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {academicYears.map((year) => (
                    <TableRow key={year.id}>
                      <TableCell className="font-medium">{year.year_name}</TableCell>
                      <TableCell>
                        {year.is_current ? (
                          <Badge className="bg-primary">
                            <Star className="w-3 h-3 mr-1" />
                            Current
                          </Badge>
                        ) : (
                          <Badge variant="outline">Archived</Badge>
                        )}
                      </TableCell>
                      <TableCell>{year.start_date || '-'}</TableCell>
                      <TableCell>{year.end_date || '-'}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {!year.is_current && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetCurrent(year.id)}
                          >
                            Set as Current
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(year.id, year.year_name)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

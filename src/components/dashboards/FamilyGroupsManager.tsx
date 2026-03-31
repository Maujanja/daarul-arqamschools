import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useSecureQuery } from '@/hooks/useSecureQuery';
import { useSecureData } from '@/hooks/useSecureData';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Users, Edit, ChevronDown, ChevronUp, Loader2, Calendar, Search, CheckCircle, XCircle } from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  class: string;
  roll_number: string;
}

interface FamilyGroup {
  id: string;
  parent_name: string;
  academic_year: string;
  notes: string | null;
  created_at: string;
}

interface FamilyGroupMember {
  id: string;
  family_group_id: string;
  student_id: string;
  academic_year: string;
}

interface FamilyGroupInstallment {
  id: string;
  family_group_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  academic_year: string;
}

interface Props {
  selectedYear: string;
  students: Student[];
  onDataChanged: () => void;
}

// Fuzzy matching: calculate similarity between two strings (0-1)
function fuzzyScore(input: string, target: string): number {
  const a = input.toLowerCase().trim();
  const b = target.toLowerCase().trim();
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.9;
  
  // Levenshtein-based similarity
  const len = Math.max(a.length, b.length);
  if (len === 0) return 1;
  
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) { matrix[i][j] = j; continue; }
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return 1 - matrix[a.length][b.length] / len;
}

function findBestMatch(input: string, students: Student[], threshold = 0.45): Student | null {
  if (!input.trim()) return null;
  let best: Student | null = null;
  let bestScore = 0;
  for (const s of students) {
    const score = fuzzyScore(input, s.full_name);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

interface MemberEntry {
  typedName: string;
  matchedStudentId: string | null;
  matchedName: string | null;
  matchedClass: string | null;
  score: number;
}

function getUniqueMatchedStudentIds(entries: MemberEntry[]): string[] {
  return Array.from(
    new Set(entries.flatMap((entry) => (entry.matchedStudentId ? [entry.matchedStudentId] : [])))
  );
}

export function FamilyGroupsManager({ selectedYear, students, onDataChanged }: Props) {
  const { toast } = useToast();
  const { fetchTable } = useSecureQuery();
  const { insert, update, remove } = useSecureData();

  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [members, setMembers] = useState<FamilyGroupMember[]>([]);
  const [installments, setInstallments] = useState<FamilyGroupInstallment[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create/Edit dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FamilyGroup | null>(null);
  const [parentName, setParentName] = useState('');
  const [groupNotes, setGroupNotes] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberEntries, setMemberEntries] = useState<MemberEntry[]>([]);

  // Installments dialog
  const [showInstDialog, setShowInstDialog] = useState(false);
  const [instGroupId, setInstGroupId] = useState('');
  const [instRows, setInstRows] = useState<{ amount: string; due_date: string }[]>([]);

  const fetchFamilyData = useCallback(async () => {
    if (!selectedYear) return;
    setIsLoading(true);
    try {
      const [groups, mems, insts] = await Promise.all([
        fetchTable<FamilyGroup>('family_groups', { academic_year: selectedYear }),
        fetchTable<FamilyGroupMember>('family_group_members', { academic_year: selectedYear }),
        fetchTable<FamilyGroupInstallment>('family_group_installments', { academic_year: selectedYear }),
      ]);
      setFamilyGroups(groups || []);
      setMembers(mems || []);
      setInstallments(insts || []);
    } catch (error) {
      console.error('Error fetching family groups:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, fetchTable]);

  useEffect(() => { fetchFamilyData(); }, [fetchFamilyData]);

  const getGroupMembers = (groupId: string) => members.filter(m => m.family_group_id === groupId);
  const getGroupInstallments = (groupId: string) => installments
    .filter(i => i.family_group_id === groupId)
    .sort((a, b) => a.installment_number - b.installment_number);

  const getStudentName = (studentId: string) => students.find(s => s.id === studentId)?.full_name || 'Unknown';
  const getStudentClass = (studentId: string) => students.find(s => s.id === studentId)?.class || '';

  // Students already in a family group for this year
  const assignedStudentIds = new Set(members.map(m => m.student_id));

  const ensureSuccess = <T,>(result: { success: boolean; error?: string; data?: T }) => {
    if (!result.success) {
      throw new Error(result.error || 'Operation failed');
    }

    return result;
  };

  const updateMemberMatch = (index: number, typedName: string) => {
    const updated = [...memberEntries];
    const otherMatchedStudentIds = new Set(
      memberEntries
        .filter((_, entryIndex) => entryIndex !== index)
        .flatMap((entry) => (entry.matchedStudentId ? [entry.matchedStudentId] : []))
    );

    const match = findBestMatch(typedName, students.filter(s => 
      (!assignedStudentIds.has(s.id) || selectedMembers.includes(s.id)) &&
      !otherMatchedStudentIds.has(s.id)
    ));

    updated[index] = {
      typedName,
      matchedStudentId: match?.id || null,
      matchedName: match?.full_name || null,
      matchedClass: match?.class || null,
      score: match ? fuzzyScore(typedName, match.full_name) : 0,
    };
    setMemberEntries(updated);
    setSelectedMembers(getUniqueMatchedStudentIds(updated));
  };

  const addMemberEntry = () => {
    setMemberEntries([...memberEntries, { typedName: '', matchedStudentId: null, matchedName: null, matchedClass: null, score: 0 }]);
  };

  const removeMemberEntry = (index: number) => {
    const updated = memberEntries.filter((_, i) => i !== index);
    setMemberEntries(updated);
    setSelectedMembers(getUniqueMatchedStudentIds(updated));
  };

  const openCreateDialog = () => {
    setEditingGroup(null);
    setParentName('');
    setGroupNotes('');
    setSelectedMembers([]);
    setMemberEntries([{ typedName: '', matchedStudentId: null, matchedName: null, matchedClass: null, score: 0 }]);
    setShowDialog(true);
  };

  const openEditDialog = (group: FamilyGroup) => {
    setEditingGroup(group);
    setParentName(group.parent_name);
    setGroupNotes(group.notes || '');
    const gMembers = getGroupMembers(group.id);
    setSelectedMembers(gMembers.map(m => m.student_id));
    setMemberEntries(gMembers.map(m => {
      const student = students.find(s => s.id === m.student_id);
      return {
        typedName: student?.full_name || '',
        matchedStudentId: m.student_id,
        matchedName: student?.full_name || null,
        matchedClass: student?.class || null,
        score: 1,
      };
    }));
    setShowDialog(true);
  };

  const handleSaveGroup = async () => {
    const uniqueSelectedMembers = Array.from(new Set(selectedMembers));

    if (!parentName.trim()) {
      toast({ title: "Error", description: "Parent name is required", variant: "destructive" });
      return;
    }
    if (uniqueSelectedMembers.length === 0) {
      toast({ title: "Error", description: "Add at least one student to the family group", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      let groupId: string;

      if (editingGroup) {
        // Update group
        ensureSuccess(await update('family_groups', { parent_name: parentName.trim(), notes: groupNotes.trim() || null }, { id: editingGroup.id }));
        groupId = editingGroup.id;

        // Remove old members and re-insert
        const oldMembers = getGroupMembers(groupId);
        for (const m of oldMembers) {
          ensureSuccess(await remove('family_group_members', { id: m.id }));
        }
      } else {
        // Create group
        const result = ensureSuccess(await insert<{ id: string }>('family_groups', {
          parent_name: parentName.trim(),
          academic_year: selectedYear,
          notes: groupNotes.trim() || null,
        }));
        if (!result.data) throw new Error('Failed to create group');
        groupId = Array.isArray(result.data) ? result.data[0].id : (result.data as any).id;
      }

      // Remove any existing memberships for these students in this academic year (one group only rule)
      for (const studentId of uniqueSelectedMembers) {
        ensureSuccess(await remove('family_group_members', { student_id: studentId, academic_year: selectedYear }));
      }

      // Insert members
      for (const studentId of uniqueSelectedMembers) {
        ensureSuccess(await insert('family_group_members', {
          family_group_id: groupId,
          student_id: studentId,
          academic_year: selectedYear,
        }));
      }

      toast({ title: "Success", description: editingGroup ? "Family group updated" : "Family group created" });
      setShowDialog(false);
      fetchFamilyData();
      onDataChanged();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Delete this family group? This will remove all members and installments.')) return;
    setIsSubmitting(true);
    try {
      await remove('family_groups', { id: groupId });
      toast({ title: "Success", description: "Family group deleted" });
      fetchFamilyData();
      onDataChanged();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateForInput = (dateStr: string): string => {
    // Ensure the date is in YYYY-MM-DD format for <input type="date">
    try {
      const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  const openInstDialog = (groupId: string) => {
    const [startYearText, endYearText] = selectedYear.split('-');
    const defaultYear = endYearText || startYearText || String(new Date().getFullYear());

    setInstGroupId(groupId);
    const existing = getGroupInstallments(groupId);
    if (existing.length > 0) {
      setInstRows(existing.map(i => ({
        amount: String(i.amount),
        due_date: formatDateForInput(i.due_date),
      })));
    } else {
      setInstRows([
        { amount: '', due_date: `${defaultYear}-01-01` },
        { amount: '', due_date: `${defaultYear}-03-30` },
        { amount: '', due_date: `${defaultYear}-06-30` },
        { amount: '', due_date: `${defaultYear}-09-15` },
      ]);
    }
    setShowInstDialog(true);
  };

  const handleSaveInstallments = async () => {
    const preparedInstallments: {
      family_group_id: string;
      installment_number: number;
      amount: number;
      due_date: string;
      academic_year: string;
    }[] = [];
    

    for (let i = 0; i < instRows.length; i++) {
      const row = instRows[i];
      const amount = Number.parseFloat(row.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const rawDate = row.due_date?.trim();
      if (!rawDate) {
        toast({
          title: "Error",
          description: `Installment #${i + 1} has no date set`,
          variant: "destructive",
        });
        return;
      }

      // Parse the date - accept YYYY-MM-DD or any parseable date format
      let parsedDate: Date;
      const strictMatch = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (strictMatch) {
        parsedDate = new Date(
          Number.parseInt(strictMatch[1], 10),
          Number.parseInt(strictMatch[2], 10) - 1,
          Number.parseInt(strictMatch[3], 10)
        );
      } else {
        parsedDate = new Date(rawDate + 'T00:00:00');
      }

      if (isNaN(parsedDate.getTime())) {
        toast({
          title: "Error",
          description: `Installment #${i + 1} has an invalid date`,
          variant: "destructive",
        });
        return;
      }

      const year = parsedDate.getFullYear();
      const month = parsedDate.getMonth() + 1;
      const day = parsedDate.getDate();

      preparedInstallments.push({
        family_group_id: instGroupId,
        installment_number: preparedInstallments.length + 1,
        amount,
        due_date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        academic_year: selectedYear,
      });
    }

    if (preparedInstallments.length === 0) {
      toast({
        title: "Error",
        description: "Enter at least one valid installment amount",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Remove existing installments
      const existing = getGroupInstallments(instGroupId);
      for (const inst of existing) {
        ensureSuccess(await remove('family_group_installments', { id: inst.id }));
      }

      // Insert new
      for (const installment of preparedInstallments) {
        ensureSuccess(await insert('family_group_installments', installment));
      }

      toast({
        title: "Success",
        description: "Family installments saved",
      });
      setShowInstDialog(false);
      fetchFamilyData();
      onDataChanged();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };


  if (isLoading) {
    return (
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card-elevated p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold text-lg text-card-foreground">Family Fee Groups</h3>
          </div>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-1" /> New Group
          </Button>
        </div>

        {familyGroups.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No family groups yet. Create one to combine fees for siblings.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {familyGroups.map(group => {
              const groupMembers = getGroupMembers(group.id);
              const groupInsts = getGroupInstallments(group.id);
              const isExpanded = expandedGroups.has(group.id);
              const totalFamilyFee = groupInsts.reduce((sum, i) => sum + Number(i.amount), 0);

              return (
                <div key={group.id} className="border border-border rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <div>
                        <p className="font-semibold text-card-foreground">{group.parent_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {groupMembers.length} student{groupMembers.length !== 1 ? 's' : ''} •
                          {groupInsts.length > 0
                            ? ` ${groupInsts.length} installments • Total: TZS ${totalFamilyFee.toLocaleString()}`
                            : ' No installments set'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => openInstDialog(group.id)}>
                        <Calendar className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(group)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteGroup(group.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-border p-4 bg-muted/10">
                      <div className="grid gap-2">
                        {groupMembers.map(m => (
                          <div key={m.id} className="flex justify-between items-center py-1 px-3 rounded bg-background">
                            <span className="font-medium text-sm text-card-foreground">{getStudentName(m.student_id)}</span>
                            <span className="text-xs text-muted-foreground">{getStudentClass(m.student_id)}</span>
                          </div>
                        ))}
                      </div>
                      {groupInsts.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Installment Schedule:</p>
                          <div className="grid gap-1">
                            {groupInsts.map(inst => (
                              <div key={inst.id} className="flex justify-between text-xs py-1 px-3 rounded bg-background">
                                <span>#{inst.installment_number} - Due: {new Date(inst.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                <span className="font-medium">TZS {Number(inst.amount).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Family Group Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Family Group' : 'Create Family Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Parent Name</Label>
              <Input value={parentName} onChange={e => setParentName(e.target.value)} placeholder="e.g. Mr. & Mrs. Hassan" />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={groupNotes} onChange={e => setGroupNotes(e.target.value)} placeholder="Additional notes..." />
            </div>
            <div>
              <Label>Students (type name to match)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Type each student's name. The system will automatically match even with minor spelling errors.
              </p>
              <div className="space-y-2">
                {memberEntries.map((entry, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="flex-1">
                      <Input
                        value={entry.typedName}
                        onChange={e => updateMemberMatch(index, e.target.value)}
                        placeholder="Type student name..."
                        className={entry.matchedStudentId ? 'border-success' : entry.typedName.length > 2 ? 'border-destructive' : ''}
                      />
                      {entry.typedName.length > 0 && (
                        <div className="mt-1 flex items-center gap-1">
                          {entry.matchedStudentId ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-success" />
                              <span className="text-xs text-success">
                                Matched: <strong>{entry.matchedName}</strong> ({entry.matchedClass})
                                {entry.score < 1 && <span className="text-muted-foreground ml-1">({Math.round(entry.score * 100)}% match)</span>}
                              </span>
                            </>
                          ) : entry.typedName.length > 2 ? (
                            <>
                              <XCircle className="w-3 h-3 text-destructive" />
                              <span className="text-xs text-destructive">No matching student found</span>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1"
                      onClick={() => removeMemberEntry(index)}
                      disabled={memberEntries.length <= 1}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-2" onClick={addMemberEntry}>
                <Plus className="w-3 h-3 mr-1" /> Add Another Student
              </Button>
              {selectedMembers.length > 0 && (
                <p className="text-xs text-success mt-2 font-medium">
                  {selectedMembers.length} student{selectedMembers.length !== 1 ? 's' : ''} matched successfully
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveGroup} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingGroup ? 'Update' : 'Create'} Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Installments Dialog */}
      <Dialog open={showInstDialog} onOpenChange={setShowInstDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Family Group Installments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Set installments for this family group. These replace individual class installments for all members.
              Academic Year: <strong>{selectedYear}</strong>
            </p>
            {instRows.map((row, index) => (
              <div key={index} className="flex items-end gap-2 p-3 border rounded-lg">
                <div className="flex-1">
                  <Label className="text-xs">Amount (TZS)</Label>
                  <Input
                    type="number"
                    value={row.amount}
                    onChange={e => {
                      const updated = [...instRows];
                      updated[index].amount = e.target.value;
                      setInstRows(updated);
                    }}
                    placeholder="Amount"
                  />
                </div>
                <div className="w-44">
                  <Label className="text-xs">Due Date</Label>
                  <Input
                    type="date"
                    value={row.due_date}
                    onChange={e => {
                      const updated = [...instRows];
                      updated[index].due_date = e.target.value;
                      setInstRows(updated);
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInstRows(instRows.filter((_, i) => i !== index))}
                  disabled={instRows.length <= 1}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const [startYearText, endYearText] = selectedYear.split('-');
                const defaultYear = endYearText || startYearText || String(new Date().getFullYear());
                setInstRows([...instRows, { amount: '', due_date: `${defaultYear}-01-01` }]);
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> Add Installment
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInstDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveInstallments} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Installments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

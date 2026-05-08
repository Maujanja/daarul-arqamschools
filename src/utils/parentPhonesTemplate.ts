import * as XLSX from 'xlsx';
import { CLASS_STREAMS } from './classStreams';

interface StudentRow {
  full_name: string;
  class: string;
  roll_number?: string | null;
  parent_phone?: string | null;
}

const CLASS_ORDER = Object.keys(CLASS_STREAMS);

function sortClasses(a: string, b: string) {
  const ia = CLASS_ORDER.indexOf(a);
  const ib = CLASS_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

function safeSheetName(name: string) {
  // Excel sheet names: max 31 chars, no : \ / ? * [ ]
  return name.replace(/[:\\\/\?\*\[\]]/g, '').slice(0, 31);
}

export function generateParentPhonesTemplate(students: StudentRow[]) {
  const wb = XLSX.utils.book_new();

  // Group students by class (ignore stream)
  const byClass = new Map<string, StudentRow[]>();
  students.forEach((s) => {
    if (!s.class) return;
    const list = byClass.get(s.class) || [];
    list.push(s);
    byClass.set(s.class, list);
  });

  const classes = Array.from(byClass.keys()).sort(sortClasses);

  if (classes.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['No students found']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Empty');
  } else {
    classes.forEach((cls) => {
      const list = (byClass.get(cls) || []).slice().sort((a, b) => {
        const ra = (a.roll_number || '').toString();
        const rb = (b.roll_number || '').toString();
        if (ra && rb) return ra.localeCompare(rb, undefined, { numeric: true });
        return (a.full_name || '').localeCompare(b.full_name || '');
      });

      const aoa: (string | number)[][] = [
        ['DAARUL-ARQAM SCHOOLS — PARENT PHONE NUMBERS TEMPLATE'],
        [`Class: ${cls}`],
        [],
        ['#', 'Roll Number', 'Student Name', 'Parent Phone (e.g. 0712345678)'],
      ];
      list.forEach((s, idx) => {
        aoa.push([idx + 1, s.roll_number || '', s.full_name || '', s.parent_phone || '']);
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 32 }, { wch: 28 }];
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName(cls));
    });
  }

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Parent_Phone_Template_${date}.xlsx`);
}
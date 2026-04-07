export interface SubjectOption {
  id: string;
  name: string;
}

export interface SubjectMarkReference {
  subject_id: string;
  subject_name?: string | null;
}

export const createSubjectNameLookup = (subjects: SubjectOption[]) =>
  new Map(subjects.map((subject) => [subject.id, subject.name]));

export const resolveSubjectName = (
  mark: SubjectMarkReference,
  subjectLookup: Map<string, string>
) => {
  const matchedName = subjectLookup.get(mark.subject_id);
  if (matchedName) return matchedName;

  const storedName = typeof mark.subject_name === 'string' ? mark.subject_name.trim() : '';
  return storedName || `Archived Subject (${mark.subject_id.slice(0, 8)})`;
};

export const resolveSubjectsFromMarks = (
  marks: SubjectMarkReference[],
  subjects: SubjectOption[]
) => {
  const subjectLookup = createSubjectNameLookup(subjects);

  return Array.from(
    new Map(
      marks.map((mark) => [
        mark.subject_id,
        {
          id: mark.subject_id,
          name: resolveSubjectName(mark, subjectLookup),
        },
      ])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
};
# Teacher Performance Tape Letters

## Goal
Create three automatic teacher performance letters for every series test:
- **Green Tape** — average grade A or B; congratulations.
- **Yellow Tape** — average grade C; increase effort.
- **Red Tape** — average grade D, E, or F; formal warning.

Teachers will see and download their own letters. Admin will see every teacher’s letters, while each Head of School will see only teachers assigned to their section.

## What will be built
- Add a **Performance Letters** area accessible from the sidebar for Teacher, Admin, and Heads of School.
- Show filters for academic year and series, plus a clear status for each letter.
- Show the teacher’s average, grade, assigned class/subject context, and the matching Green/Yellow/Red Tape.
- Let users preview each letter and download it as a PDF.
- Add a latest-letter summary on the Teacher Dashboard with a direct view/download action.
- Admin and Heads of School can review and download the letters available within their permitted scope.

## Letter design
- Follow the uploaded warning-letter structure and school branding.
- Include the school logo, school name, contacts, date, teacher name, selected series, academic year, average, and grade.
- Use English letter wording consistent with the existing English-only interface.
- Green letter: congratulations and encouragement to maintain performance.
- Yellow letter: improvement guidance, based on the supplied template.
- Red letter: warning and immediate corrective-action guidance.
- Add a strong colored strip along the bottom matching the tape type.
- Include the Manager’s name/title from the supplied template.

## Performance calculation
- Use only marks belonging to the teacher’s assigned class, stream, and subject for the selected academic year and series.
- Normalize scores against the class maximum before combining results, so classes marked out of 50 and 100 are compared fairly.
- Exclude subjects already excluded by the school’s existing average rules.
- Determine the letter from the resulting school grade: A–B Green, C Yellow, D–F Red.
- Include up to four lowest-performing students taught by that teacher in Yellow and Red letters; Green letters focus on achievement.
- Do not create a letter when no valid marks exist for that teacher and series.

## Access and security
- Calculate and return letter data through the secure backend gateway.
- Teacher: own letters only.
- Head of School: teachers whose assignments belong to their Nursery, Primary, or Secondary section only.
- Admin: all teachers.
- PDF generation remains in the app and uses only the letter data allowed for the logged-in role.

## Technical details
- Add a dedicated backend function for scoped teacher-performance calculations, avoiding unrestricted marks exposure.
- Add reusable calculation/types and a PDF generator with the school logo and tape-specific content.
- Add the new page, route, sidebar entry, and Teacher Dashboard summary.
- Verify role scoping, grade/tape boundaries, mixed 50/100-mark classes, empty states, PDF output, desktop/mobile layout, and the final build.

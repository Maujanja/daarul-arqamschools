# Improved Dormitory & Boarding Management

Rebuild the dormitory section according to the requirements document. Matron/Supervisor features are **excluded**, as requested.

## 1. Dormitory structure (starting setup)
| Dormitory | Section | Gender | Rooms | Bunk beds/room | Spaces |
|---|---|---|---|---|---|
| Lower Primary Apartment – Boys (LPA-B) | Primary | Boys | 8 | 6 | 96 |
| Lower Primary Apartment – Girls (LPA-G) | Primary | Girls | 10 | 4 | 80 |
| Pro Maliki (PM) | Senior | Boys | 8 | 6 | 96 |
| A.H. Msuya (AHM) | Senior | Boys | 8 | 6 | 96 |
| Hajat Rizik (HR) | Senior | Girls | 4 | 4 | 32 |
| Bi Khadija (BK) | Senior | Girls | 4 | 4 | 32 |
| Madinah (MAD) | Senior | Girls | 12 | 4 | 96 |

- Every bunk bed has an Upper and a Lower space. Bed codes are created automatically, e.g. `PM-R01-B01-U`.
- The existing two dormitories are converted to LPA-B and LPA-G. The 157 students already placed are moved automatically into the new spaces, keeping their current order. Any students who don't fit go to the Waiting List.

## 2. Dormitory Configuration (Admin)
- Create, edit, deactivate or view a dormitory: name, short code, section (Nursery/Primary/Senior), gender, number of rooms, beds per room, bed type (Double Decker or Single), partitions on/off, status.
- Capacity and upper/lower totals are calculated automatically. Nothing is fixed in the code, so new dormitories can be added later.

## 3. Allocation rules (checked every time)
- The student must be a boarding student, with matching gender and matching section (Primary students only in Primary dormitories, Senior only in Senior).
- One active bed per student and one student per bed space.
- Beds marked Maintenance or Out of Service can't be allocated.
- When there is no space, the system shows: "No available boarding space for this student. Please select another eligible dormitory or place the student on the waiting list."

## 4. Pages (tabs inside Dormitories)
1. **Dashboard**: totals, occupancy %, Boys/Girls and Primary/Senior counts, a summary card for each dormitory, and warnings at 90% and 100% full, for full rooms, and for boarding students who have no bed.
2. **Allocation**: choose academic year and student; only eligible dormitories are shown; then pick room, bed and position (Upper/Lower). Includes combined search and filters.
3. **Auto Allocate**: strategies are Fill one dormitory first, Distribute evenly, and Distribute by class. You see a preview before confirming.
4. **Rooms**: a view of each room showing every bed, its position, colour-coded status and the student. Admin can mark a bed Reserved, Maintenance or Out of Service.
5. **Transfers**: move a student to another dormitory, room or bed, with a reason and who approved it. The old bed becomes free again.
6. **Waiting List**: priority, reason and status. Shows an alert when a bed opens up for a waiting-list student.
7. **New Year**: carry forward boarding students, start a fresh allocation, or clear the previous one. History is never deleted.
8. **Reports** (PDF and Excel): dormitory occupancy, room occupancy, student dormitory list, Boys, Girls, Primary, Senior, unallocated students, waiting list, and the bed register.

## 5. Student profile and parents
- A "Boarding Information" section on the student profile: dormitory, room, bed, position, code, allocation date, status and history, printable.
- The parent dashboard continues to show dormitory, room, bed and position.

## 6. Permissions
- Admin: full access.
- Secretary: allocate students, view capacity and reports.
- Head of School: view allocations and reports for their own section, and approve transfers.
- Accountant: view boarding status and capacity.

## Technical details
- Add to `dormitories`: `code`, `bed_type`, `beds_per_room`, `partitions_enabled`, `is_active`. Change the section values to nursery, primary and senior.
- Add to `dorm_beds`: `bed_position` (upper/lower/single), `bunk_number`, `partition`, `status`. Update `sync_dorm_beds` to create rooms × bunk beds × positions with automatic codes.
- `dorm_assignments`: add `status` (active/ended), `allocated_at`, `ended_at`. Unique indexes on active rows for each student+year and each bed+year. Expand the validation trigger to check section and bed status.
- New tables `dorm_allocation_history` and `dorm_waiting_list`, accessed only through the gateway (with GRANTs to service_role).
- Update `data-query` and `data-management` permissions, the dorm types, `DormBedPicker`, `DormitoriesPage` (split into tab components under `src/components/dorms/`), `StudentProfileDialog` and `ParentDashboard`.
- Moving existing students: a one-time data script that maps each existing assignment to a new bed in order.

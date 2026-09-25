# Visual Room Bed Selection

## Goal
Replace the Rooms table with a visual room-and-bed layout similar to seat selection, while preserving current dormitory data and permissions.

## Changes
- Show one selected room at a time after choosing the dormitory and room.
- Draw each bunk as a physical bed with separate Upper and Lower selectable spaces; single beds show one space.
- Arrange beds in two sides with a central aisle so the room location is easy to understand.
- Colour each space by Available, Occupied, Reserved, Maintenance, or Out of Service, with a visible legend.
- Clicking a space opens its details: bed code, position, status, and assigned student.
- Admin/Secretary can choose an unoccupied space and assign an eligible boarding student there.
- Keep status editing for unoccupied spaces in the selected-bed panel.
- On phones, keep the room map horizontally safe and make bed spaces large enough to tap.

## Technical details
- Extend `RoomsTab` with selected room/bed/student state and use the existing secure data actions for assignment and bed-status updates.
- Reuse existing eligibility rules, assignment data, and design tokens; no database changes are required.
- Pass the current user name already available in dormitory context when saving an assignment.
- Verify the Rooms flow in the browser on desktop and mobile-sized layouts, then confirm the current build remains healthy.

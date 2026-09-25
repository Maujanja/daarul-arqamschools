# Partitioned room layout for three boys' dormitories

## What will change
- Apply a special room map to **A.H. Msuya**, **Lower Boys Apartment**, and **Prof Maliki**.
- Show the entrance at the front and divide each room into two equal halves using a visible half-wall partition.
- Place three double-decker beds in the first half and three in the second half.
- In each half, show one bunk by the window, one against the partition wall, and one against the wall shared with the next room.
- Keep every upper/lower bed space clickable with its current student, status, selection, and allocation controls unchanged.
- Keep the existing room map for all other dormitories.

## Technical details
- Update only the visual room-map component and reuse the existing bed-space controls and dormitory data.
- Use the dormitory partition setting and the three specified dormitory names/codes to select this layout.
- Maintain horizontal scrolling on narrow screens so the floor plan remains readable without overlapping labels or controls.
- Verify the three special dormitories and one ordinary dormitory on desktop and mobile.

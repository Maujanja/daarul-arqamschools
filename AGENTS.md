# Architecture rules

- Child progress is computed in a pure shared module used by the progress endpoint and release notifications, so comparisons and alerts agree.
- Parent progress endpoints require a signed, expiring, student-bound session issued only after the existing parent login succeeds; never authorize them with client-claimed IDs or roles.
- Progress includes only approved examinations for the requested academic year and compares consecutive examinations within the same historical class, avoiding unpublished results and promotion-scale mismatches.
- Sauti audio is requested only by the parent progress Edge Function and returned as verified audio/mpeg; provider credentials never reach the browser.
- Browser MP3 requests use native fetch rather than functions.invoke, which decodes audio/mpeg as text; report and voice-test views share cancellable audio playback with object-URL cleanup.
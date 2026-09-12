# Marketing Hub: rename Bulk SMS and add Voice Marketing

## What changes for users

The menu item "Bulk SMS" becomes **Marketing**. Inside it there are four tabs:

1. **Bulk SMS** — exactly what exists today, nothing removed.
2. **Voice Marketing** — new, working now.
3. **WhatsApp Marketing** — visible but marked "Coming soon".
4. **Voice Balance & Top-up** — buying voice credit shows as "Coming soon" until the payment link is connected.

Same people keep access: Admin, Accountant, and Heads of School.

## Voice Marketing tab

- Numbers: upload an Excel/CSV file, type them one by one, or paste a whole list. Numbers starting `255...`, `0...`, or bare `7...`/`6...` are all converted to `255xxxxxxxxx` automatically, duplicates removed, invalid ones flagged — same rules as Bulk SMS today.
- Message: either **upload an audio file** or **record directly** in the browser (microphone). A short player lets the user listen before sending.
- Typing a message for text-to-speech is shown as "Coming soon".
- Send: shows how many calls were placed, how many failed, per-number delivery status, and a campaign history with details.
- Voice balance is measured in **minutes/seconds of calling** and shown at the top of the tab. Pricing per call is left as "Coming soon" and configurable later.

## Waiting on you

- **Briq voice API key** (doc.briq.tz) — needed before real calls go out. Until it is saved, the Voice tab works fully but sending returns a clear "voice service not connected yet" message.
- **Mongike payment API** — for buying voice credit; that section stays "Coming soon" until then.

## Technical notes

- Rename route `/bulk-sms` to `/marketing` (keep `/bulk-sms` redirecting), sidebar label "Marketing" with the same role list. `BulkSmsPage.tsx` becomes `MarketingPage.tsx` with a tab shell; the existing SMS UI is extracted into `BulkSmsTab.tsx` unchanged.
- New tables (gateway-only, RLS on, GRANTs to authenticated/service_role):
  - `voice_campaigns` — created_by, role, title, audio_path, source (upload/record), total/sent/failed, seconds_used, balance_after.
  - `voice_recipients` — campaign_id, name, phone, raw_phone, status, provider_call_id, duration_seconds, error, delivery_status.
  - `voice_credit_ledger` — seconds added/consumed, reason, reference (top-ups written later by the payment webhook).
- Private storage bucket `voice-messages` for uploaded/recorded audio, written via the edge function; policies on `storage.objects`.
- New edge function `voice-campaign` (verify_jwt = false, role check identical to `bulk-sms`) with actions: `balance`, `send`, `campaigns`, `recipients`, `refresh_status`, `delete_campaign`. Briq calls read `BRIQ_API_KEY` / `BRIQ_SENDER_ID` from secrets; when absent it returns a "not configured" error instead of failing silently. Balance derives from `voice_credit_ledger` plus, when available, the Briq balance endpoint.
- Recording uses `MediaRecorder` in the browser, uploaded as base64 through the edge function (same pattern as avatar upload).
- Phone normalization reused from the Bulk SMS helper, extracted into a shared util.

# Aarogya Homeopathic Clinic — Full Dynamic Website

Dr. Aalok Kushwaha ke liye poori dynamic website: patient-facing booking site +
admin dashboard + database + PDF receipts + real-time "naya appointment aaya"
notification.

## Tech Stack (aur kyun)

| Layer      | Tech                          | Why |
|------------|--------------------------------|-----|
| Frontend   | Plain HTML + CSS + JS          | Simple, fast, no build step, easy to edit |
| Backend    | Node.js + Express               | Industry standard, huge community, easy to deploy |
| Database   | PostgreSQL (e.g. free Supabase) | **Permanent storage.** Unlike a local SQLite file, this survives redeploys and restarts — free hosts like Render wipe local files on every redeploy, which used to delete all appointments. A real database fixes that completely. |
| Real-time  | Socket.io                       | Push new-appointment alerts to the admin dashboard instantly |
| PDF        | PDFKit                          | Generates the appointment receipt as a downloadable PDF |
| Auth       | JWT + bcrypt                    | Protects the `/admin.html` dashboard |
| Email (optional) | Nodemailer                | Sends an email to the clinic when a new appointment is booked, if configured |
| Image uploads | Multer + Sharp             | Lets the admin upload a new doctor photo from the dashboard — auto-corrects rotation and resizes it |

**Requires Node.js version 18 or higher.** Check yours with `node -v`.

## Folder Structure

```
aarogya-clinic/
├── server.js              → main server entry point
├── db/database.js         → PostgreSQL schema + all DB queries
├── routes/
│   ├── appointments.js    → public booking API
│   ├── admin.js           → login + protected admin API
│   └── reviews.js         → public review submission + fetch
├── middleware/auth.js     → JWT check for admin routes
├── utils/
│   ├── receipt.js         → PDF receipt generator
│   └── mailer.js          → optional email notifications
├── public/                → everything the browser loads
│   ├── index.html         → main website
│   ├── admin.html         → staff dashboard
│   ├── css/style.css, css/admin.css
│   ├── js/script.js, js/admin.js
│   └── assets/doctor.jpg
├── .env.example           → copy this to .env and fill in your details
└── package.json
```

## Step 1 — Get a free PostgreSQL database (Supabase)

1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account).
2. Create a **New Project** — give it any name, set a database password (remember it!), pick the region closest to you.
3. Wait ~2 minutes for it to finish setting up.
4. Go to **Project Settings → Database → Connection String → URI**. Copy it —
   it looks like:
   ```
   postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
5. If your password has special characters, URL-encode them in the string:
   `@` → `%40`, `#` → `%23`, `%` → `%25`, `&` → `%26`

   You'll paste this as `DATABASE_URL` in Step 3 below. **The app creates its
   own tables automatically the first time it starts** — you don't need to
   run any SQL yourself.

## Step 2 — Install dependencies

```bash
cd aarogya-clinic
npm install
```

## Step 3 — Configure your `.env`

```bash
cp .env.example .env
```

Open `.env` and edit:
- `DATABASE_URL` → your Supabase connection string from Step 1.
- `CLINIC_NAME`, `CLINIC_DOCTOR`, `CLINIC_PHONE`, `CLINIC_EMAIL`, `CLINIC_ADDRESS`
  → these show up automatically on the website and on the PDF receipt.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` → login for `/admin.html`.
  **Default password is `admin123` — change this before going live!**
  To generate a new hash for your own password, run:
  ```bash
  node -e "console.log(require('bcryptjs').hashSync('YOUR_NEW_PASSWORD', 10))"
  ```
  Paste the output into `ADMIN_PASSWORD_HASH`.
- `JWT_SECRET` → any long random string (used to sign login sessions).
- `SMTP_*` (optional) → only fill these in if you want an email sent to the
  clinic every time someone books. Leave blank to skip.

## Step 4 — Run it

```bash
npm start
```

You should see:
```
✓ Database schema ready (appointments, reviews)
🌿 Aarogya Homeopathic Clinic server running
```

Then open:
- **Website:** http://localhost:3000
- **Admin Dashboard:** http://localhost:3000/admin.html (login with your `.env` credentials)

## How appointment booking works

1. Patient fills the form on the website → `POST /api/appointments`
2. Backend saves it to SQLite and generates a unique ID like `AAR-20260726-0001`
3. Patient sees a **"Request Received — Pending"** message with their ID.
   This is deliberately **not** a final confirmation — the appointment stays
   `pending` until clinic staff confirms it from the admin dashboard.
4. **At the same moment**, the admin dashboard (if open) gets a live push
   notification via Socket.io — a toast, a sound, and (if allowed) a native
   OS notification, even if the tab isn't focused.
5. If SMTP is configured, an email is also sent to the clinic.
6. Staff log in at `/admin.html`, see the new booking, and mark it
   **Confirmed** (or Cancelled/Completed) once they've checked availability.
7. The patient can check their real-time status anytime using the
   **"Check Appointment Status"** section on the website — they enter their
   Appointment ID + phone number (both required, so nobody can look up
   someone else's booking) and see the current status live.
8. The downloadable PDF receipt always reflects the **current** status with
   a large banner — "⏳ Awaiting Clinic Confirmation" while pending, or
   "✓ Confirmed by Clinic" once approved — so there's never any confusion
   about whether a visit is actually booked.

## Uploading a new doctor photo (no code editing needed)

1. Log into `/admin.html`.
2. Scroll to the **Doctor Photo** section.
3. Click **Choose New Photo**, pick any JPG/PNG/WEBP from your phone or computer (max 10MB), then **Upload Photo**.
4. It updates on the live website within a second — no restart needed.

The upload automatically fixes sideways/upside-down phone photos (a common
issue with phone camera EXIF rotation data) and resizes it for fast loading.

## Patient Reviews

- Anyone visiting the website can click **"Share Your Experience"** at the
  bottom of the Testimonials section and submit a review with a star rating.
- Submitted reviews go live **immediately** — no approval step — so they show
  up on the site right away, which is what makes them feel real and current.
- To keep this safe from spam/inappropriate content, the admin dashboard has
  a **Patient Reviews** section where you can **Hide** or **Delete** any
  review after the fact. Hidden reviews stop showing on the site but aren't
  deleted, so you can un-hide them later if needed.
- You can also **Add Review Manually** from the dashboard — useful if a
  patient sends you feedback over WhatsApp/phone and you want to publish it
  on their behalf.

## Clinic Workflow System (Doctor / Reception / Billing) — Phase 1

A separate, role-based system for running the actual clinic day-to-day,
completely independent from the site-admin login above.

**Getting in:** click **"Staff Login"** in the website's nav menu (or go to
`/staff.html`). Pick a role, then log in.

**Default accounts** (auto-created the first time the app starts — **change
these passwords before real use**, via each dashboard's profile, or ask to
add a "change password" flow):

| Role | Username | Password |
|---|---|---|
| Doctor | `doctor` | `doctor123` |
| Reception | `reception` | `reception123` |
| Medical/Billing | `billing` | `billing123` |

The **site admin** (`/admin.html`, your existing login) can create additional
staff accounts under the new **"Clinic Staff"** section — set a username,
password, and role for each real staff member.

### How the workflow connects

1. **Reception** registers a patient (or finds an existing one by phone) and
   records vitals + chief complaint → patient appears in the **Doctor**'s
   queue instantly.
2. **Doctor** opens the patient, fills in the Digital Rx (Chief Complaint,
   Examination, Diagnosis, Advice, Investigation, Follow Up, etc. — 11
   sections), adds medicines from the shared Medicine Master (or types a new
   one on the spot), and saves — this sends the patient straight to
   **Billing**.
3. **Billing** opens the visit, sees the prescribed medicines with any known
   prices auto-filled, sets a price for anything new (optionally saving it
   to the Medicine Master for next time), applies a discount if needed, and
   generates a PDF bill.

**Quick Type:** every Rx section has clickable suggestion chips that insert
common phrases — click **"+ Add"** next to any section to save a new phrase
your clinic uses often, so it's there next time.

**Patient history:** when a doctor opens a returning patient, past visits
show up automatically — no need to re-type anything reception already has
on file.

### Phase 2 — now included

- **Photo Rx:** when saving a prescription, the doctor picks **Digital Rx**
  or **Photo Rx**. Photo Rx lets them upload/capture a photo of a
  handwritten prescription instead of typing sections — stored in
  PostgreSQL (not the local filesystem), so it's permanent. Billing staff
  can view it via a **"📷 View Photo Rx"** button, and a patient's history
  shows when an old visit had one.
- **Public bill download:** patients can go to the **"Download Your Bill"**
  section on the website, enter their Bill Number + phone number, and
  download their bill PDF themselves — no staff login needed. Requires both
  values to match (can't be guessed).
- **Improved billing PDF:** cleaner layout, alternating row shading, and the
  doctor's name is now filled in automatically from who actually saw the
  patient (previously this was a blank field — now fixed).

### Phase 3 — now included

- **Live notifications:** the Doctor dashboard gets an instant toast + sound
  when Reception adds a new patient; the Billing dashboard gets one when a
  doctor sends a prescription over — no refresh needed.
- **Dashboard stats:** Doctor sees Waiting Now / Seen Today / Total Patients
  Seen. Billing sees Pending Bills / Bills Today / Revenue Today.
- **Medicine inventory:** medicines now track **stock quantity** and
  **expiry date**, with automatic **Low Stock** and **Expiring Soon** badges.
  Manage all of this from the **"Manage Medicines"** panel in the Billing
  dashboard (add, edit, adjust stock/price/expiry).
- **Patient history timeline:** a proper **"History"** button (in Reception's
  search results and the Doctor's patient header) opens a clean timeline of
  all past visits — vitals, diagnosis, advice, and Photo Rx indicators.
- **Attachments:** doctors can attach lab reports or other documents (PDF/
  image, separate from Photo Rx) to a visit from the prescription screen.
- **Audit log:** the site admin dashboard now has a **"Recent Activity"**
  section showing who did what and when — patient intake, prescriptions
  saved, bills generated, files attached.

Ask any time you want something further refined.

## Phase 4 — requested refinements (all completed)

- **Bill date fixed** — was showing US-style month/day/year, now shows
  DD/MM/YYYY consistently.
- **Doctor name auto-corrected** — if your database still had the old
  "Dr. Aalok Kushwaha" spelling saved from before the rename, the app fixes
  it automatically the next time it starts (one-time, safe, idempotent).
- **Consulting fee** — set once in the Doctor dashboard's Analytics tab; it's
  automatically added to every bill until you change it. Billing staff can
  toggle it off per-bill if needed (e.g. a follow-up with no fee).
- **No more medicine quantity field** — homeopathic remedies are dispensed
  as one tube/bottle per item, not a variable quantity like tablets. Doctor
  and Billing screens now just show medicine name + price.
- **Automatic inventory deduction** — when a bill is generated, 1 unit is
  deducted from that medicine's stock automatically. No more manual updates.
- **History tabs** (Doctor + Billing) — once a consultation is billed, it
  doesn't disappear. It moves to a **History** tab with date filters
  (Today / Yesterday / This Week / This Month / 3 / 6 months / 1 / 2 years /
  Custom Range) so nothing is ever lost.
- **Doctor Analytics** — a new tab with bar/line charts showing medicine
  revenue and patient counts over any date range, plus totals for patients
  seen, consulting fee revenue, medicine revenue, and combined total.
- **Billing dashboard** — now shows "Medicine Sales Today" alongside revenue,
  and a **History** tab with the same date filters, each showing item count
  and total per bill.
- **Simpler public lookup** — "Check Appointment Status" and "Download Your
  Bill" now only ask for a **phone number** (no ID needed) and show every
  matching appointment/bill for that number to choose from.
- **Medicine form overhaul** — "Strength" renamed to "Dosage / Strength"
  with helpful examples, Category is now a searchable dropdown (Tablet,
  Capsule, Syrup, etc. — or type your own), Price shows a ₹ prefix and
  rejects negative numbers, Stock Quantity only accepts whole numbers, and
  the layout is now aligned and equal-height across all fields.
- **Staff login page redesigned** — replaced emoji icons with clean line-art
  icons, added a premium dark-themed backdrop, refined typography and card
  styling — no functional changes, purely visual.

### A security trade-off worth knowing

Making public lookup **phone-only** (instead of phone + appointment ID / bill
number) is simpler for patients, but it does mean anyone who knows a
patient's phone number can see their appointment/bill history on your site.
This matches what you asked for, and phone numbers aren't usually treated as
secret — but if you ever want the extra layer back (ID + phone), it's a
small change to revert. Just let me know.

## Phase 5 — analytics fix + premium redesign

- **Fixed: Doctor Analytics not showing data.** The most likely cause was
  Chart.js being loaded from a public CDN (`cdnjs.cloudflare.com`), which
  some networks, ad-blockers, or browser extensions silently block — this
  would make the charts fail to render with no obvious error. **Chart.js is
  now bundled locally** in `public/js/vendor/chart.umd.min.js` and served
  directly from your own server, removing that dependency entirely. If
  charts still don't appear, a red error message will now show under the
  charts explaining why (instead of failing silently).
- **More analytics added:** alongside the existing revenue-over-time (bar)
  and patients-over-time (line) charts, there are now two more — a
  **donut chart** showing the Consulting Fee vs. Medicine Sales revenue
  split, and a **pie chart** of your top-selling medicines by revenue.
- **Compact date filters** — the Today/Yesterday/Custom filter bar (in
  History and Analytics tabs) is now a small pill-style control instead of
  a large box, so it reads like a real filter rather than taking over the
  page.
- **Staff account deletion** — the admin dashboard's "Clinic Staff" section
  now has a **Delete** button alongside Disable/Enable. Deleting a staff
  account is permanent, but their historical visits, prescriptions, and
  bills are never deleted — they just no longer show whose staff account
  handled them.
- **API caching bug fixed** — new patients/prescriptions sometimes didn't
  show up on another dashboard until logging out and back in. This was
  browser/network caching of API responses; every `/api/*` response now
  explicitly disables caching, so a plain "Refresh" is always enough.
- **Premium visual polish (first pass)** — gradient buttons, soft shadows,
  a blurred sticky header, and gradient stat numbers across dashboards.

## Phase 6 — full sidebar redesign

All four dashboards (Doctor, Reception, Billing, and the site Admin panel)
were restructured with a **left sidebar navigation** — matching the
reference design you shared — instead of the previous top-only layout.

- **Doctor dashboard** gets a distinct dark green sidebar; Reception,
  Billing, and Admin keep a clean white sidebar. Each has its own nav
  items, a branded icon mark, and a small "tagline card" at the bottom.
- **Stat cards** show a colored icon circle (calendar, clock, rupee,
  people, etc.) instead of plain text.
- **Analytics summary cards** have a colored left-border accent.
- **Empty states** (empty billing/doctor queue) are illustrated cards with
  an icon, instead of a single line of grey text.
- **Medicine form and Patient Intake form** fields have icon prefixes.
- **Admin appointments table** shows a small patient avatar icon next to
  each name.
- This was a **structural + visual change only** — every element ID was
  kept in place so no JavaScript logic had to change.

## Phase 7 — sidebar polish (based on screenshots you sent)

- **Fixed wasted sidebar space** — the sidebar's nav list no longer stretches
  to fill the full height, so the "tagline card" now sits naturally right
  below the last nav item instead of leaving a big empty gap above it.
- **Bigger, bolder dashboard titles** — "Doctor Dashboard" (and Billing/
  Reception's headers) are now larger and bold, with a
  **"Welcome back, [Name]"** line underneath, matching your reference.
- **Fixed tab-switching bug** — the Queue-specific stat cards (Waiting Now /
  Seen Today / Total Patients Seen, and Billing's Pending Bills / Bills
  Today / etc.) were showing on *every* tab, including Analytics and
  History. They're now scoped to only show on the Queue tab — clicking
  History or Analytics shows only that section's content, nothing else.
- **Lighter dark sidebar** — the Doctor dashboard's dark sidebar was closer
  to black before; it's now a proper mid-tone dark green, easier on the
  eyes while still visually distinct from the other white sidebars.
- **Nicer tagline card** — added a soft gradient background, decorative
  circles, and a shadowed icon badge, so it reads as an intentional design
  element rather than a plain colored box.
- **General sidebar polish** — nav items now shift slightly and their icon
  scales up on hover, giving the sidebar a more responsive, premium feel.



All four dashboards (Doctor, Reception, Billing, and the site Admin panel)
were restructured with a **left sidebar navigation** — matching the
reference design you shared — instead of the previous top-only layout.

- **Doctor dashboard** gets a distinct **dark green sidebar** (as in your
  reference image); Reception, Billing, and Admin keep a clean white
  sidebar. Each has its own nav items, a branded icon mark, and a small
  "tagline card" at the bottom (e.g. "Compassion. Care. Commitment.").
- **Stat cards** now show a colored icon circle (calendar, clock, rupee,
  people, etc.) instead of plain text — matching the reference's card style.
- **Analytics summary cards** (Patients Seen, Consulting Fee Revenue, etc.)
  now have a colored left-border accent, as shown in your Doctor Analytics
  reference image.
- **Empty states** (empty billing queue, empty doctor queue) are now
  illustrated cards with an icon, instead of a single line of grey text.
- **Medicine form and Patient Intake form** fields now have icon prefixes
  (name, phone, calendar, category, stock box, etc.) matching your
  reference screenshots.
- **Admin appointments table** now shows a small patient avatar icon next
  to each name, like the reference.
- This was a **structural + visual change only** — every button, form, and
  API call underneath still works exactly as before. All the same element
  IDs were kept in place specifically so none of the JavaScript logic had
  to change, which keeps the risk of this redesign low.
- Mobile: sidebars collapse behind a hamburger menu button below ~900px
  width, matching how the rest of the app is already responsive.



- **Fixed: Doctor Analytics not showing data.** The most likely cause was
  Chart.js being loaded from a public CDN (`cdnjs.cloudflare.com`), which
  some networks, ad-blockers, or browser extensions silently block — this
  would make the charts fail to render with no obvious error. **Chart.js is
  now bundled locally** in `public/js/vendor/chart.umd.min.js` and served
  directly from your own server, removing that dependency entirely. If
  charts still don't appear, a red error message will now show under the
  charts explaining why (instead of failing silently).
- **More analytics added:** alongside the existing revenue-over-time (bar)
  and patients-over-time (line) charts, there are now two more — a
  **donut chart** showing the Consulting Fee vs. Medicine Sales revenue
  split, and a **pie chart** of your top-selling medicines by revenue.
- **Compact date filters** — the Today/Yesterday/Custom filter bar (in
  History and Analytics tabs) is now a small pill-style control instead of
  a large box, so it reads like a real filter rather than taking over the
  page.
- **Staff account deletion** — the admin dashboard's "Clinic Staff" section
  now has a **Delete** button alongside Disable/Enable. Deleting a staff
  account is permanent, but their historical visits, prescriptions, and
  bills are never deleted — they just no longer show whose staff account
  handled them.
- **Premium visual redesign** — Doctor, Reception, Billing, and Admin
  dashboards now share the same refined look as the Staff Login page:
  gradient buttons, soft shadows, a blurred sticky header, and gradient
  stat numbers — no functional changes, purely visual polish.

## Deployment (making it live on the internet)

This is a single Node.js app that serves both the website and the API — so
you only need **one** hosting service, not separate frontend/backend hosts.

### Recommended: Render.com (free tier available)
1. Push this project to a GitHub repository.
2. Go to [render.com](https://render.com) → New → Web Service → connect your repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add all your `.env` values (including `DATABASE_URL`) under Render's
   "Environment" tab — Render does **not** read your local `.env` file, you
   must re-enter every value there.
6. Deploy. Render gives you a live URL like `https://aarogya-clinic.onrender.com`.

### Alternative: Railway.app
Same idea — connect GitHub repo, set environment variables (including
`DATABASE_URL`), deploy.

✅ **Data persistence:** because appointments and reviews now live in
PostgreSQL (Supabase) rather than a local file, they will **not** be lost
when Render/Railway redeploys or restarts your app — this was the whole
point of the migration. Free-tier "ephemeral filesystem" resets only affect
local files (like the doctor photo — see note below), not your database.

⚠️ **One remaining thing to know:** the doctor photo you upload from the
admin dashboard (`public/assets/doctor.jpg`) is still a local file. On
Render/Railway free tiers, it can reset to the last-deployed version after a
redeploy or restart. If that happens, just re-upload it from the dashboard —
takes 10 seconds. (If this becomes annoying, the long-term fix is to store
the photo in Supabase Storage instead of the local filesystem — ask if you'd
like this added.)

## Connecting your domain

Once deployed on Render/Railway, go to their "Custom Domain" settings, add
your domain (e.g. `aarogyahomeoclinic.com`), and update your domain
registrar's DNS records (usually a `CNAME` or `A` record) as instructed by
the host. This is the same domain step we discussed earlier — just point it
at your new backend URL instead of Netlify.

## Editing content later

- **Contact info, clinic name:** edit `.env` — no code changes needed, updates everywhere automatically.
- **Doctor bio / services / testimonials text:** edit directly in `public/index.html`.
- **Colors / fonts:** edit `public/css/style.css` (all values are CSS variables at the top).
- **Doctor photo:** replace `public/assets/doctor.jpg` with a new image (same filename).

## Security notes before going live

- Change `ADMIN_PASSWORD_HASH` and `JWT_SECRET` — do not use the defaults.
- Never commit your real `.env` file to GitHub (`.gitignore` already excludes it).
- If you enable SMTP email, use an "app password", never your real email password.

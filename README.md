# Aarogya Homeopathic Clinic — Full Dynamic Website

Dr. Aalok Kushwaha ke liye poori dynamic website: patient-facing booking site +
admin dashboard + database + PDF receipts + real-time "naya appointment aaya"
notification.

## Tech Stack (aur kyun)

| Layer      | Tech                          | Why |
|------------|--------------------------------|-----|
| Frontend   | Plain HTML + CSS + JS          | Simple, fast, no build step, easy to edit |
| Backend    | Node.js + Express               | Industry standard, huge community, easy to deploy |
| Database   | SQLite (`node:sqlite`, built into Node.js) | Zero setup, no separate DB server needed, file-based — perfect for a single-clinic site. **No native compilation** (unlike `better-sqlite3`), so it won't break during deployment. |
| Real-time  | Socket.io                       | Push new-appointment alerts to the admin dashboard instantly |
| PDF        | PDFKit                          | Generates the appointment receipt as a downloadable PDF |
| Auth       | JWT + bcrypt                    | Protects the `/admin.html` dashboard |
| Email (optional) | Nodemailer                | Sends an email to the clinic when a new appointment is booked, if configured |
| Image uploads | Multer + Sharp             | Lets the admin upload a new doctor photo from the dashboard — auto-corrects rotation and resizes it |

**Requires Node.js version 22.5 or higher** (for the built-in SQLite module).
Check yours with `node -v`. If it's older, download the latest LTS from
[nodejs.org](https://nodejs.org).

## Folder Structure

```
aarogya-clinic/
├── server.js              → main server entry point
├── db/database.js         → SQLite schema + all DB queries
├── routes/
│   ├── appointments.js    → public booking API
│   └── admin.js           → login + protected admin API
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
├── data/clinic.db         → SQLite database file (auto-created on first run)
├── .env.example           → copy this to .env and fill in your details
└── package.json
```

## Step 1 — Install dependencies

```bash
cd aarogya-clinic
npm install
```

## Step 2 — Configure your `.env`

```bash
cp .env.example .env
```

Open `.env` and edit:
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
  clinic every time someone books. Leave blank to skip — the site works fine
  without it, since the admin dashboard already shows live notifications.

## Step 3 — Run it

```bash
npm start
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



This is a single Node.js app that serves both the website and the API — so
you only need **one** hosting service, not separate frontend/backend hosts.

### Recommended: Render.com (free tier available)
1. Push this project to a GitHub repository.
2. Go to [render.com](https://render.com) → New → Web Service → connect your repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add all your `.env` values under Render's "Environment" tab.
6. Deploy. Render gives you a live URL like `https://aarogya-clinic.onrender.com`.

### Alternative: Railway.app
Same idea — connect GitHub repo, set environment variables, deploy.

⚠️ **Important:** Both Render and Railway support Node 22, but free tiers may
use an "ephemeral" filesystem, meaning the SQLite file can reset on redeploys.
For a real clinic in production, once you outgrow the free tier, consider
upgrading to a paid plan with a persistent disk, or migrating to a hosted
database later (Supabase/Postgres) — the `db/database.js` file is the only
place you'd need to change.

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

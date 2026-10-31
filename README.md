# தமிழ் எழுத்து · Tamil Eluthu — Tamil school portal

One website for a Tamil school's day-to-day work, with accounts for students, parents and teachers:

| Section | Teachers | Students | Parents |
|---|---|---|---|
| **Today** | Class code, roll-call status, unsent marks | Homework due, latest mark, attendance | Same, for each linked child |
| **Diary** (நாட்குறிப்பு) | Post homework, classwork, notices, events; email notices to parents | See posts, tick homework done | See posts and whether homework is done |
| **Attendance** (வருகை) | One-tap roll call (present/late/absent/excused), summary, CSV | Own record | Child's record |
| **Listening** (கேட்டல்) | Link listening exams/audio/past papers, release answers, enter marks | Open exams, see answers and marks | — |
| **Marks** (மதிப்பெண்) | Markbook, mark sheets, publish, email results to parents, CSV | Own published marks | Child's published marks + email |
| **Reports** (அறிக்கை) | Term reports with skills, comments, automatic attendance and marks; email to parents | Own published reports | Child's reports + email; print/PDF, WhatsApp share |
| **திருத்தி** | The writing checker below | | |
| **Papers** (shop) | Sell or give away papers (own or other authors', with permission); Stripe or manual cash sales | Buy / download | Buy / download |

The public home page and the paper catalogue can be browsed without an account.

Everything is available in **English and Tamil** (globe button in the header; each person's choice is remembered). Teachers can **WhatsApp** parents directly (absences, results, reports) and share the diary with a class group. Everyone gets **in-app notifications** (bell) for new homework, listening exams, results, reports and teacher comments. A **principal/admin** area shows every class, manages teachers, and edits the school's name, logo, photo, contacts and WhatsApp group link without touching code.

### The phone app is different from the website
Inside the Android app, or when the site is added to a phone's home screen, people get an app layout instead of the website:
- **Welcome screens** you swipe through (no marketing page), then sign in or create an account.
- **Bottom tab bar** with a raised centre button for each role's main job: *Writing* for students, *Attendance* for teachers. A **More** sheet holds everything else.
- **A personal home screen:**
  - Students: "Next up" homework with a countdown and a *Mark as done* button, progress rings, and quick actions.
  - Parents: their child's attendance, average mark and homework, with a switch between children.
  - Teachers: today's checklist (roll call, homework posted, marks to send), quick actions and the class code to share.
- **Tamil word of the day** with a 3-choice quiz, pronunciation (🔊) and a daily 🔥 streak, plus a **Thirukkural of the week**.
- **Personalize:** colour theme (Peacock, Lotus, Mango, Ocean, Night), text size, language, a nickname for the greeting, and which home cards to show.
- Pull down to refresh, a short vibration on taps, and phone safe-area support.

To preview the app layout on a computer, open the site with `?app=1` (for example `https://yourdomain.com/?app=1`). Use `?app=0` to go back to the website.

### Launch checklist
1. **Database.** In Supabase → SQL Editor, run these files in order. The first two are already applied on the current project.
   - `supabase/migrations/20261101000000_school_portal.sql`: diary, attendance, listening, marks, reports, shop
   - `supabase/migrations/20261102000000_admin_settings_notifications.sql`: admin, school settings, parent phones, notifications
2. **First admin (principal).** Run this once with their email:
   ```sql
   insert into public.teacher_emails(email, is_admin) values ('principal@yourschool.org', true)
     on conflict (email) do update set is_admin = true;
   update public.profiles set is_admin = true
    where id = (select id from auth.users where lower(email) = lower('principal@yourschool.org'));
   ```
   After that, the admin adds teachers from **Admin → Teachers**. No more SQL is needed for that.
3. **School details.** Sign in as the admin and open **Admin → School details**. Set the name in English and Tamil, the logo, a school photo, the about text, contacts, the address and the WhatsApp group invite link.
4. **Server functions.**
   ```bash
   supabase functions deploy notify-parents
   supabase functions deploy shop-checkout
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
5. **Parent emails** (reports, results and notices; written in English and Tamil) use [Resend](https://resend.com). Verify your domain there, then:
   ```bash
   supabase secrets set RESEND_API_KEY=re_... NOTIFY_FROM="Your School <noreply@yourdomain.com>" SITE_URL=https://yourdomain.com
   ```
   Without these, sending still publishes in the portal and creates notifications.
6. **Paid papers (Stripe).** In Stripe → Developers → Webhooks, add `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` with the events `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `charge.refunded`, then:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...
   ```
   Free papers, “buy from author” links and manual **Give access** sales (cash or bank transfer) work without Stripe. Test with `sk_test_` keys and card `4242 4242 4242 4242` first.
7. **Build and upload** (see the Hostinger steps below). Optional `.env` values: `VITE_PHONE_COUNTRY` (default `61`, used to turn 04xx numbers into WhatsApp links), plus fallbacks for the name and contact.
8. **Before inviting families,** review `src/pages/Info.jsx` (Privacy, Terms & refunds) with your school committee, and have a Tamil teacher review the wording in `src/ta.js`.

Privacy for the new sections is enforced by the database like everything else: a teacher only sees and writes records for students in their own classes; students and parents only see their own child's attendance, marks and reports, and only after the teacher publishes marks and reports. Paper files are in a private bucket and can be downloaded only by the seller, buyers, or anyone signed in for free items. Parent email addresses are never sent to the website. Tests: `tests/security.sql`, `tests/portal.sql` and `tests/admin.sql` (database rules, all rolled back) and `node --test tests/*.test.mjs`.

---

## தமிழ் திருத்தி · the writing checker

Tamil writing feedback for VCE students:

- **Students** photograph the pages in their book (or type/paste), and get every mistake underlined with the correct form and the rule in simple English. They join their class with a class code and give their parent a parent code.
- **Parents** enter their child's parent code and see only their own child's writing, mistakes and the teacher's comments.
- **Teachers** create classes, see every student's writing, the class's most common mistakes, and write comments that students and parents can read.

Built with React (Vite), Supabase (logins, database, photo storage) and the Claude API (reading handwriting and checking).

---

## How privacy works

Every rule is enforced by the database itself (row level security), not by the website:

| Who | Can see |
|---|---|
| Student | Only their own writing |
| Parent | Only the children they linked with that child's parent code |
| Teacher | Only students in classes they created |

- Only emails you add to the teacher list can sign up as a teacher.
- Students cannot change their results; only the checking function can write them.
- Photos are stored in a private bucket, in one folder per student, with the same rules.
- A student can make a new parent code at any time and remove a linked parent.

These rules were tested against a real Postgres database before release (student, parent, stranger-parent and teacher scenarios).

Before using it with students, get the school's approval and parent consent for storing students' writing, as you would for any student-data app. Choose the Sydney region when creating the Supabase project so data stays in Australia.

---

## Current project

This repository now defaults to the dedicated **Tamil Thiruthi** Supabase project in Sydney (`zqeagskgyykxdxccjxkh`). Its database and checking function are deployed, and the Anthropic connection has passed live synthetic tests. The browser configuration contains only a publishable key; keep privileged keys and the Anthropic key in Supabase Secrets.

Run `npm ci` and `npm run build` to build against this project. Set both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only when deliberately overriding it. Do not rerun the initial schema or security migration on the existing project: they have already been applied.

See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for evidence and remaining launch gates. Real handwriting accuracy and hosted sign-up/email delivery are not yet certified.

## Set-up for a separate project (optional)

### 1. Create the Supabase project
1. Go to <https://supabase.com>, sign in and create a **New project**. Region: **Sydney (ap-southeast-2)**.
2. Open **SQL Editor** → **New query**, paste all of `supabase/migrations/0001_schema.sql`, and press **Run**.
3. Add your teacher email(s) in a new query:
   ```sql
   insert into public.teacher_emails(email) values ('your.email@example.com');
   ```
4. **Authentication → URL Configuration**: set **Site URL** to your website address (step 3), and add it under **Redirect URLs**. While testing locally, also add `http://localhost:5173`.

### 1b. Send login emails from your Hostinger mailbox (needed for password reset)
Supabase's built-in sender only allows 2 emails per hour, so sign-up confirmations and password resets would stop working with a whole class. Send them through Hostinger instead:
1. hPanel → **Emails** → create a mailbox, e.g. `noreply@yourdomain.com`.
2. Supabase → **Authentication → Emails → SMTP Settings** → turn on **Custom SMTP**:
   - Sender email: `noreply@yourdomain.com` · Sender name: `Tamil Thiruthi`
   - Host: `smtp.hostinger.com` · Port: `465` (if it fails, use `587`)
   - Username: `noreply@yourdomain.com` · Password: that mailbox's password
3. Supabase → **Authentication → Rate Limits**: check the email limit suits your class size (the default with custom SMTP is 30 per hour).
4. Optional: **Authentication → Email Templates** → edit the "Reset password" and "Confirm signup" emails to mention Tamil Thiruthi.

Test it: on the sign-in screen, tap **Forgot password?**, enter your email, and check the email arrives from your Hostinger address.

### 2. Deploy the checking function
You need an Anthropic API key from <https://console.anthropic.com> (Settings → API keys). Add some credit; each check costs roughly a few cents (more for several photo pages).

Install the Supabase CLI (<https://supabase.com/docs/guides/cli>), then in this folder:
```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy check-writing
```
Optional: `supabase secrets set ANTHROPIC_MODEL=claude-opus-5-5` for the most careful checking (slower and dearer). The default is `claude-sonnet-5-5`.

### 3. Put the website online — Hostinger
1. On your computer, in this folder: copy `.env.example` to `.env` and fill in your Supabase Project URL and anon key, then run:
   ```bash
   npm install
   npm run build
   ```
   This makes a `dist` folder.
2. In Hostinger hPanel: **Websites → your domain (or a subdomain such as `thiruthi.yourdomain.com`) → File Manager → public_html**. Delete the default `index.php`/`default.php` if present, then upload **everything inside** `dist` (including the hidden `.htaccess` file).
3. hPanel → **Security → SSL**: make sure SSL is active for the domain (the app and camera need https).
4. In Supabase → **Authentication → URL Configuration**: set **Site URL** to your Hostinger address (e.g. `https://thiruthi.yourdomain.com`) and add it to **Redirect URLs**.
5. Open the address on your phone and sign in as the teacher.

To update the website later: run `npm run build` again and re-upload the `dist` contents.

### 3a. Hostinger Node.js web app (deploy from GitLab/GitHub)
In hPanel → **Websites → Add website → Node.js app**, connect the repository and use:
- Framework: **Other** (or Vite) · Node version: **20 or 22**
- Install command: `npm install` · Build command: `npm run build` · Start command: `npm start` · Output/entry: `server.mjs`

`npm start` runs `server.mjs`, which serves the built site from `dist/` on the port Hostinger gives it (it builds automatically if `dist/` is missing). No environment variables are required: the site uses the Supabase project in `src/project-config.js`. After the first deploy, add the site address to Supabase → Authentication → URL Configuration.

### 3b. Other hosting (optional)
1. Copy `.env.example` to `.env` and fill in **Project Settings → API**: the Project URL and the `anon` public key. (Never put the service-role key in the website.)
2. Try it locally:
   ```bash
   npm install
   npm run dev
   ```
3. Host it free on **Netlify** or **Vercel**: push this folder to GitHub, import it, set the build command `npm run build`, output folder `dist`, and add the two `VITE_SUPABASE_...` environment variables. Put the final address into Supabase's Site URL (step 1.4).

### 4. Install it as a phone app
The website is an installable app (a "PWA"): it gets its own icon on the home screen, opens full screen, and the **Take photo** tile opens the camera directly.
- **Android (Chrome):** open the website, tap **Install app** (top right), or Chrome's menu → **Install app / Add to Home screen**.
- **iPhone (Safari):** open the website, tap **Share** → **Add to Home Screen**.

No app store is needed. (Publishing to the Google Play Store or Apple App Store later is possible by wrapping the same app with Capacitor; it needs a Google Play developer account and an Apple Developer account.)

### 5. First use
1. Sign up as **Teacher** with the email you added. Confirm the email, sign in, and create your class (e.g. "VCE Tamil 2027"). You get a 6-letter **class code**. Share the website link and the class code with your students.
2. Students sign up as **Student**, enter the class code, and see their **parent code**.
3. Parents sign up as **Parent** and enter their child's parent code.

---

## Files

```
supabase/migrations/0001_schema.sql   tables, roles, privacy rules, photo bucket
supabase/functions/check-writing/     reads handwriting + checks Tamil (Claude API)
src/pages/                            Auth, Student, Parent, Teacher screens
src/components/                       feedback view, upload form, lists, progress
src/categories.js                     the mistake categories (same as the class sheet)
```

## Changing things

- **What counts as a mistake / the wording of rules**: edit `checkPrompt` in `supabase/functions/check-writing/index.ts`, then run `supabase functions deploy check-writing` again.
- **Handwriting reading**: edit `transcribePrompt` in the same file. It is told to copy mistakes exactly and never correct them.
- **Add another teacher**: add their email to `teacher_emails` (step 1.3).

---

## Android app (APK)

The `android/` folder is a small Android app that contains the website and connects its **Take photo** / **Choose photos** buttons to the phone's camera and gallery. The APK is built automatically on GitHub (free), so you don't need Android Studio.

1. Create a **private** GitHub repository and upload this whole folder to it.
2. In the repository: **Settings → Secrets and variables → Actions → New repository secret**. Add the four secrets listed in `SIGNING-KEY-README.txt` (sent separately with the signing key):
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   and **`APP_URL`** = your Hostinger address (e.g. `https://thiruthi.yourdomain.com`). With `APP_URL` set, the app opens your live website, so every website update reaches the app instantly and you only rebuild the APK when the Android part changes.
3. Open the **Actions** tab → **Build Android app (APK)** → **Run workflow**. After about 5 minutes, open the finished run and download **TamilThiruthi-APK** at the bottom.
4. Put the `.apk` on an Android phone and open it. Android asks to allow installing from this source once.

Every push to `main` builds a new version automatically; installing it updates the app in place (same signing key).

### iPhone
APK files are Android-only. iPhone users open your Hostinger address in **Safari → Share → Add to Home Screen**. It then opens like an app with its own icon, full screen, with the camera button working. (A native App Store app would need a Mac and an Apple Developer account, and Apple often rejects apps that only wrap a website.)

If you build without Supabase overrides, the app uses the dedicated Tamil Thiruthi project configured in `src/project-config.js`. Set both environment variables together to use another project.

**Keep `thiruthi-release.jks` and its password safe.** Without them you cannot release updates to installed apps or publish the same app on Google Play.

Alternative: open the `android/` folder in Android Studio after copying `dist/` into `android/app/src/main/assets/www/`, then **Build → Build APK(s)**.


## Security hardening (31 October 2026)

Apply `supabase/migrations/20261031050145_harden_student_access.sql` after the initial schema and deploy **both** `index.ts` and `security.mjs` in `check-writing`. Deploy the updated frontend too: teacher allow-list checking now happens only in the signup trigger, and the interface supports retrying saved or expired checks.

- Photo paths must belong to the submitting student, both at insertion and before checking. Downloads use the student's session and Storage RLS, never the service-role key.
- Server limits: 10 pages, 20,000 characters, 10 MB per image and 20 MB combined images.
- Work claims are serialized per student. One active check, 10 attempts/hour, 40/day and three attempts/submission. Usage survives submission deletion. Completed work is not charged again.
- A five-minute lease permits recovery after interruption. Attempt tokens prevent old workers from overwriting newer work. Provider calls time out after 60 seconds; errors shown to students omit provider details.
- Privileged database implementations live in the unexposed `private` schema. Public RPC wrappers use invoker permissions. Anonymous access and unused table privileges are revoked. Teacher allow-list and attempt-log tables deliberately have no client RLS policies.
- Student text is explicitly treated as untrusted input to the AI. This reduces prompt manipulation risk but does not establish marking accuracy.

Validation: `node --test tests/security.test.mjs`, `npm run build`, and `tests/security.sql` against a test database (the script rolls back all fixtures). Do not put service-role or Anthropic keys in frontend variables. The AI key and a valid provider model are still required for live marking tests.

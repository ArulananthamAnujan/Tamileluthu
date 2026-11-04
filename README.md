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

Everything is available in **English and Tamil** (globe button in the header; each person's choice is remembered). Teachers can **WhatsApp** parents directly (absences, results, reports) and share the diary with a class group. Everyone gets **in-app notifications** (bell) for new homework, listening exams, results, reports and teacher comments. A **principal/admin** area shows every class, manages teachers, **approves new student and parent accounts** (they see a “waiting for approval” page and cannot join a class or use anything until approved; the admin can also block an account later), and edits the school's name, logo, photo, contacts and WhatsApp group link without touching code. No school details are shown until the admin adds them.

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

### Email from your own mailbox (free, no Resend needed)
The site sends reports, results, notices, class invitations and writing feedback from **your school's own email account**. Set these once in Supabase → **Edge Functions → Secrets** (or with `supabase secrets set …`):

| Secret | Hostinger Email | Gmail |
|---|---|---|
| `SMTP_HOST` | `smtp.hostinger.com` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` | `465` |
| `SMTP_USER` | `office@yourschool.org` | `yourname@gmail.com` |
| `SMTP_PASS` | the mailbox password | a Gmail **App Password** (Google Account → Security → 2-Step Verification → App passwords) |
| `NOTIFY_FROM` (optional) | `Your School <office@yourschool.org>` | leave empty |

Use port **465**: Supabase blocks 25 and 587. Gmail allows about 500 emails a day; a Hostinger mailbox has its own daily limit. The same mailbox can also send sign-up and password emails: see step 1b below (Supabase → Authentication → SMTP).

Even without any setup, teachers can use **“Open in my email app”** (invites and writing reports), which opens their own Gmail/Outlook with everything written in.

### Teachers checking writing themselves
Teachers can open **திருத்தி → Check writing myself**, type any student's name (with or without an account), and photograph or paste the work. The result is private to the teacher. **Report · PDF · Share** gives a printable report to download as a PDF, send on WhatsApp, open in your own email app, or send from the school mailbox.

### Examiner-style essay marking
Every check now gives two kinds of feedback:
1. **An examiner's assessment**, marked against **Sri Lankan written Tamil** by default (change it under Admin → School details → *Marking standard*):
   - **Question check.** If the student typed the question, it says whether the essay *answers*, *partly answers* or *does not answer* it, and why. If not, it says what kind of question the essay seems to answer and asks the student to confirm it (**Yes, that is my question**) or type the real one. The essay is then marked again.
   - **Introduction, body and conclusion**: what the student actually wrote, what works, what to improve, and a model sentence in Tamil. A missing section is flagged.
   - **Practice mark out of 25**: five criteria marked out of 5 (answering the question, structure, language accuracy, vocabulary, text type and register), with a percentage and grade. It is clearly labelled as a practice mark, not an official one.
   - Text-type feedback, overall comment, next steps and useful Tamil phrases.
   - **A model rewrite**: the student's own ideas rewritten as a top-grade answer in Sri Lankan written Tamil, with the key improvements explained.
2. **Line-by-line corrections** from a professor-level proof-read: up to 120, covering every small error (spelling, ஒற்று/புணர்ச்சி, agreement, case endings, tense, punctuation, spacing, word choice, sentence structure, spoken Sri Lankan forms such as வாறன் → வருகிறேன்), judged by the same standard, so correct Sri Lankan forms (பாடசாலை, பரீட்சை, வைத்தியசாலை, கதைத்தல்…) are never marked wrong.

Students choose **English or Tamil** for the feedback when they upload. The assessment also appears in the downloadable PDF report, the WhatsApp text and the emailed report.

### Monthly subscriptions for the writing checker
Each student needs a monthly subscription to use தமிழ் திருத்தி. Teachers never pay, and homework, attendance, marks and reports stay free. Set it up under **Admin → Subscriptions**:
- **Price per month** and currency.
- **Checks included per month** (0 = unlimited).
- **Free trial checks** for new students (default 3).
- An on/off switch, if you ever want the checker to be free again.

Families subscribe under **Subscription** (in My account, the footer, or More in the app): a student pays for themself, or a parent pays for each child. Payment is by card through Stripe and renews monthly. Families can cancel or change their card with **Manage**, which opens Stripe's customer portal.

For **cash or bank transfer**, open **Admin → Subscriptions → Give access**, choose a number of months and add a note (for example a receipt number). Choose 0 months to remove access you gave by hand.

The database enforces this: the checker refuses to start without access, whatever the website shows.

**Stripe setup (one time):**
1. Deploy the functions:
   ```bash
   supabase functions deploy subscribe-checkout
   supabase functions deploy billing-portal
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
2. In Stripe → Developers → Webhooks, the endpoint `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` needs these events (on top of the paper-shop ones):
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
3. In Stripe → Settings → Billing → **Customer portal**, turn on cancelling subscriptions and updating payment methods.
4. Set the secrets `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `SITE_URL`.

Test with `sk_test_` keys and card `4242 4242 4242 4242` before going live.

### Inviting students
**Invite students** is on the teacher's home screen. It shows the class code and a link (`…/#/join?code=ABC123`). Students who open the link and create a Student account join the class automatically. Share it by copying the link, on WhatsApp, from your own email app (BCC), or from the school mailbox.

### Launch checklist
1. **Database.** In Supabase → SQL Editor, run these files in order. The first two are already applied on the current project.
   - `supabase/migrations/20261101000000_school_portal.sql`: diary, attendance, listening, marks, reports, shop
   - `supabase/migrations/20261102000000_admin_settings_notifications.sql`: admin, school settings, parent phones, notifications
   - `supabase/migrations/20261103000000_teacher_checks_invites.sql`: teachers' own writing checks
   - `supabase/migrations/20261104000000_unlimited_checks.sql`: no check limits, many checks at once (optional limits under Admin → School details)
   - `supabase/migrations/20261105000000_subscriptions.sql`: paid monthly access to the writing checker
   - `supabase/migrations/20261106000000_essay_marking.sql`: examiner-style essay marking (question, sections, practice mark)
   - `supabase/migrations/20261107000000_report_files.sql`: private storage for report PDFs, shared as 30-day links when a phone blocks file sharing
   - `supabase/migrations/20261108000000_attendance_marked_at.sql`: stamps the attendance time automatically (needed for attendance to save)
   - `supabase/migrations/20261109000000_share_teacher_checks.sql`: students and their parents can see writing a teacher checked for them, and get a notification when it is ready
   - `supabase/migrations/20261110000000_account_approval.sql`: new student and parent accounts wait for the admin's approval (Admin → Approvals); removes the placeholder school name so no school details show until the admin adds them
   - `supabase/migrations/20261111000000_subscription_plans.sql`: monthly plans with their own price and checks (starts with Basic 6 checks A$45, Plus 20 checks A$139, Premium 35 checks A$229); edit them under Admin → Subscriptions. Redeploy `subscribe-checkout` and `stripe-webhook` with it
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
   supabase functions deploy send-invites
   supabase functions deploy email-report
   supabase functions deploy check-writing
   supabase functions deploy shop-checkout
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
5. **Email.** Add the SMTP secrets from *Email from your own mailbox* above. Without them, sending still publishes in the portal and creates notifications.
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

Built with React (Vite), Supabase (logins, database, photo storage) and AI models (reading handwriting and checking).

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

This repository now defaults to the dedicated **Tamil Thiruthi** Supabase project in Sydney (`zqeagskgyykxdxccjxkh`). Its database and checking function are deployed, and the AI model connection has passed live synthetic tests. The browser configuration contains only a publishable key; keep privileged keys and the AI model key in Supabase Secrets.

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

### 1b. Send login emails from your own mailbox (fixes "email rate limit exceeded")
Supabase's built-in email sender is for testing only and allows a few emails per hour for the whole project. After that, sign-ups and password resets fail with **"email rate limit exceeded"**. To fix it, connect your own mailbox, then raise the limit.
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
You need an API key from your AI model provider's console (Settings → API keys). Add some credit; each check costs roughly a few cents (more for several photo pages).

Install the Supabase CLI (<https://supabase.com/docs/guides/cli>), then in this folder:
```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set AI_API_KEY=your-ai-model-key
supabase functions deploy check-writing
```
Optional settings:
- `supabase secrets set AI_MODEL=<model ID>`: use a different AI model, e.g. a larger one for the most careful checking (slower and dearer). A balanced default is built in.
- `supabase secrets set AI_EFFORT=high`: deeper checking (`low`/`medium`/`high`). The default is `medium`, which keeps photo checks well within the time limit.
- `supabase secrets set AI_CHECK_EFFORT=xhigh`: how hard the line-by-line correction pass thinks (default `high`, so it catches the small mistakes). If checks of long multi-page essays time out on the Supabase free plan (150-second limit), set it to `medium` or upgrade to Pro (400 seconds).

Projects already set up with the older secret names (`ANTHROPIC_API_KEY` and so on) keep working; you don't need to change them.

**If a check fails,** the student now sees the actual reason, for example "busy, retry", "AI key not working", "took too long" or "no writing could be read". For the details, open Supabase → Edge Functions → **check-writing → Logs**.

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
supabase/functions/check-writing/     reads handwriting + checks Tamil (AI models)
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

### iPhone app (App Store / TestFlight)
The `ios/` folder is the iPhone version of the Android app: a small native app (Swift) that opens your live website (`APP_URL`), so every website update reaches it instantly. It connects the photo buttons to the camera and photo library, shares report PDFs through the iPhone share sheet (WhatsApp, Mail, Save to Files), and opens WhatsApp, email and other websites outside the app.

You need an **Apple Developer account** (US$99 a year), but no Mac: GitHub builds the app on a Mac for you.

1. Enrol at developer.apple.com, then note your **Team ID** (Membership page).
2. In **App Store Connect → Apps → +**, create the app with bundle ID **`au.thiruthi.app`** (register the ID first under Certificates, Identifiers & Profiles → Identifiers if it is not listed).
3. In **App Store Connect → Users and Access → Integrations → App Store Connect API**, create a key with **Admin** access. Download the `.p8` file (only possible once) and note the Key ID and Issuer ID.
4. In GitHub, **Settings → Secrets and variables → Actions**, add `APPLE_TEAM_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_P8` (the whole contents of the `.p8` file) and `APP_URL` (already used by Android).
5. **Actions → Build iPhone app → Run workflow** (on `main`). About 10–30 minutes after it finishes, the build appears in **App Store Connect → TestFlight**. Add testers there; they install it with Apple's **TestFlight** app. To publish on the App Store, fill in the listing and submit it for review.

**Apple's payment rules:** Apple does not allow iPhone apps to sell digital services (the writing checker subscriptions, paid papers) except through Apple's in-app purchases. The iPhone app therefore hides the subscribe, change plan and buy buttons; families subscribe on the website and the app shows their plan and checks as normal. Apple may still reject apps that are mostly a website, so describe the app's features (camera checking, reports, notifications) clearly when you submit it.

**Without an Apple account:** iPhone users can open your website in **Safari → Share → Add to Home Screen**. It opens like an app, full screen with its own icon, and subscriptions work there.

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

Validation: `node --test tests/security.test.mjs`, `npm run build`, and `tests/security.sql` against a test database (the script rolls back all fixtures). Do not put service-role or AI model keys in frontend variables. The AI key and a valid provider model are still required for live marking tests.

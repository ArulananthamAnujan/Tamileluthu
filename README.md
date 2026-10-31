# தமிழ் திருத்தி · Tamil Thiruthi

Tamil writing feedback for VCE students, with accounts for students, parents and teachers.

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

## Set-up (about 30 minutes)

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

If you build without the Supabase secrets, the app opens on a one-time **Connect** screen where the server address and anon key can be entered on the phone.

**Keep `thiruthi-release.jks` and its password safe.** Without them you cannot release updates to installed apps or publish the same app on Google Play.

Alternative: open the `android/` folder in Android Studio after copying `dist/` into `android/app/src/main/assets/www/`, then **Build → Build APK(s)**.

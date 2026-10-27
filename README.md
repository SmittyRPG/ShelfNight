# Shelf Night

Pick tonight's board game from your own shelf, add your whole collection with one photo, and talk games with other players.

One codebase runs on **iPhone, Android and desktop** (in the browser, installable as an app). It is built with Expo (React Native) and Supabase.

| Feature | Where it lives |
|---|---|
| "What should we play tonight?" picker | `app/(tabs)/index.tsx`, logic in `src/lib/recommend.ts` |
| My shelf (mark games you own) | `app/(tabs)/shelf.tsx` |
| Shelf photo scan | `app/(tabs)/scan.tsx` + server function `supabase/functions/scan-shelf` |
| Discover similar games | `app/(tabs)/discover.tsx` |
| Sign-in and profile creation | `app/sign-in.tsx`, `app/onboarding.tsx`, `app/settings.tsx` |
| Forums with report, block and delete | `app/(tabs)/forums.tsx`, `app/thread/[id].tsx`, `app/new-thread.tsx` |
| Ad placements (off for now) | `src/components/AdSlot.tsx`, switch in `src/config.ts` |
| Database and security rules | `supabase/migrations/0001_init.sql`, starter data in `supabase/seed.sql` |

---

## Part 1: Run it on your computer (about 45 minutes, free)

### 1. Install the tools

1. **Node.js**: download the "LTS" version from <https://nodejs.org> and install it with the default options.
2. **GitHub Desktop**: <https://desktop.github.com>. Sign in with your GitHub account.
3. **Expo Go** on your phone: search "Expo Go" in the App Store or Google Play. This lets you try the app on your phone without publishing it.

### 2. Get the code

In GitHub Desktop: **File → Clone repository**, pick `shelf-night`, and choose a folder such as `Documents/shelf-night`.

### 3. Create the database (Supabase)

1. Go to <https://supabase.com>, sign up, and click **New project**. Name it `shelf-night`, make up a database password (save it in a password manager), and pick the region closest to you (e.g. East US).
2. When it's ready, open **SQL Editor → New query**. Open the file `supabase/migrations/0001_init.sql` from your folder in any text editor, copy everything, paste it in, and click **Run**. You should see "Success. No rows returned".
3. Do the same with `supabase/seed.sql`. This adds 41 starter games and the forum categories.
4. Open **Authentication → Emails → Templates → Magic Link**, and replace the message body with:
   ```
   <h2>Your Shelf Night code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```
   Click **Save**. (The app signs people in with a 6-digit code instead of a password.)
5. Open **Project Settings → API**. Keep this page open for the next step.

### 4. Connect the app to the database

1. In your `shelf-night` folder, make a copy of `.env.example` and name the copy `.env`.
   - On Mac, files starting with a dot are hidden; press **Cmd + Shift + .** in Finder to show them.
2. Open `.env` in a text editor and paste in the **Project URL** and the **anon public** key from the Supabase page. Save.

### 5. Start the app

Open a terminal **in the project folder** (in GitHub Desktop: **Repository → Open in Terminal**, or on Windows **Open in Command Prompt**). Then run these one at a time:

```bash
npm install
npx expo install --fix
npx expo start
```

- Press **w** to open it in your web browser (this is the desktop version).
- Or scan the QR code with your phone's camera (iPhone) or the Expo Go app (Android). Your phone and computer must be on the same Wi-Fi.

Sign in with your email, enter the code you receive, create your profile, and you're in.

> If `npx expo install --fix` changes some version numbers, that's expected: it matches everything to the newest Expo release.

### 6. Make yourself a moderator

After you've created your profile, run this in the Supabase SQL Editor (use your username):

```sql
update public.profiles set role = 'moderator' where username = 'your_username';
```

Moderators can delete any post and see reported or auto-hidden posts. Review reports with:

```sql
select * from public.reports where status = 'open' order by created_at desc;
```

### 7. Fill the catalog with thousands of games from Wikidata (free)

Wikidata is a free, public-domain database (the same data behind Wikipedia). Its game data can be used commercially, including with ads, with no license needed. The import pulls every board and card game on Wikidata that has a BoardGameGeek ID, typically several thousand titles.

1. In Supabase **SQL Editor**, run `supabase/migrations/0002_wikidata.sql` the same way you ran the first file.
2. In Supabase **Project Settings → API**, copy the **service_role** key (click "Reveal"). Paste it into your `.env` file after `SUPABASE_SERVICE_ROLE_KEY=`.
   This key can change anything in your database. Never share it, and never rename it to start with `EXPO_PUBLIC_`.
3. Preview first. Nothing is saved:
   ```bash
   npm run import:wikidata:preview
   ```
   It prints how many games it found and how many have player counts and play times, and it saves them to `scripts/output/wikidata-games.json` so you can look through them.
4. Import for real:
   ```bash
   npm run import:wikidata
   ```
5. Restart the app. The shelf, search and scan now use the full catalog.

**How it merges:** your 41 hand-checked starter games keep their values; Wikidata only fills in what's missing (like the BGG ID). Imported games are marked `source = 'wikidata'`, and re-running the import later refreshes them with Wikidata's latest data. Run it every month or two to pick up new games.

**What to expect:** Wikidata has names and years for nearly every game, but player counts and play times only for some, and no complexity ratings. The app handles missing details: such games still show up, marked "Player count unknown" or "Length unknown", and rank below games with full details. You can fill in details for popular games over time, by hand in Supabase **Table Editor → games**, or later through community edits.

---

## Part 2: Turn on photo scanning (costs a few cents per scan)

Scanning sends the photo to Claude, which reads the box titles. Your API key lives on the server, never in the app.

1. Create an API key at <https://console.anthropic.com> and add a small amount of credit. Set a monthly spending limit in the console.
2. Install the Supabase command-line tool: <https://supabase.com/docs/guides/local-development/cli/getting-started>
3. In the project folder's terminal:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-ID
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key
   npx supabase functions deploy scan-shelf
   npx supabase functions deploy delete-account
   ```
   `YOUR-PROJECT-ID` is the part of your Supabase URL before `.supabase.co`.

Each person gets 5 scans a day by default (change `DAILY_SCAN_LIMIT` with `npx supabase secrets set DAILY_SCAN_LIMIT=10`).

---

## Part 3: Before you launch publicly

These are not optional. Skipping them gets apps rejected or removed.

- [ ] **Game data.** The catalog comes from Wikidata (public domain, fine for ads and paid features) plus your own hand-checked games. Storing BGG ID numbers to link out to BoardGameGeek is fine, but if you ever pull data *from* BGG's API (ratings, complexity, descriptions, images), you need their license: free non-commercial while the app is ad-free, commercial once it earns money, plus the "Powered by BGG" logo. Don't use box art you found online; publishers own it.
- [ ] **Terms of use and privacy policy.** Host both pages (a free site like Notion or Carrd works) and put the links in `src/config.ts`. The privacy policy must mention email sign-in, photos sent for scanning, and ads once they're on.
- [ ] **Support email** in `src/config.ts`.
- [ ] **Moderation plan.** Both app stores require apps with user posts to let people report and block (built in), act on reports quickly, and remove abusive users. Check reports at least daily. Three separate reports automatically hide a post until a moderator looks at it.
- [ ] **Account deletion** works (Settings → Delete my account). Apple requires this.
- [ ] **App icon and splash screen**: add `assets/icon.png` (1024×1024) and reference it in `app.json`.

## Part 4: Publish to the stores and the web

You build with **EAS**, Expo's build service. It builds iPhone apps in the cloud, so you don't need a Mac.

| Platform | Account needed | Cost |
|---|---|---|
| iPhone / iPad | Apple Developer Program | $99 per year |
| Android | Google Play Console | $25 once |
| Desktop (web) | Any host, e.g. EAS Hosting, Netlify or Vercel | Free to start |

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview   # a test APK you can install on Android
eas build --platform ios                          # for TestFlight / App Store
eas submit --platform ios                         # sends the build to Apple
npx expo export --platform web                    # builds the desktop/web version into dist/
```

Change `com.shelfnight.app` in `app.json` to your own identifier (e.g. `com.yourname.shelfnight`) before your first store build. It can't change after you publish.

**Desktop apps:** the web version can be installed from Chrome or Edge as a desktop app. If you later want a downloadable Windows/Mac app, wrap the web build with Tauri or Electron. No rewrite is needed.

## Part 5: Turning on ads (later)

1. Confirm the app uses no data from BoardGameGeek's API (the Wikidata catalog is fine). If it does, get BGG's **commercial** license first.
2. Create an AdMob account (phones) and an AdSense account (web).
3. `npx expo install react-native-google-mobile-ads`, add its plugin to `app.json` with your AdMob app IDs, and follow the steps written in `src/components/AdSlot.tsx`.
4. On iPhone, ads that track users need Apple's tracking permission prompt (`expo-tracking-transparency`).
5. Set `adsEnabled: true` in `src/config.ts`.

Ad slots are already placed under Tonight's results, in Discover, and in forum threads. Phones need a new store build after adding the ad library (Expo Go can't show real ads).

---

## How the pieces fit

```
Phone / browser app (Expo)
   │  sign-in, shelves, forums ──────────►  Supabase database (row-level security on every table)
   │  shelf photo ──► scan-shelf function ──►  Claude reads titles ──► list of titles back to the app
   └  ads (later) ──► AdMob / AdSense
```

Useful commands: `npm run typecheck` checks the code for mistakes. `npx expo start --clear` fixes most "it won't load" problems.

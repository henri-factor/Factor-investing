# Factor Desk

A browser-based quarterly rebalancing tool for a US-equities long factor strategy
(value / profitability / 12-1 momentum). Loads a TradingView screener export,
ranks and sizes 30 positions, diffs against your current IB positions, and builds
the IB BasketTrader CSV — then archives each quarter to your own Google Drive.

The whole app is one static file, `index.html`. There is no server and no shared
database. Each person runs it against **their own** Google Drive, so no one ever
sees anyone else's data.

---

## Put it online with GitHub Pages (free, ~5 minutes)

1. Create a free GitHub account if you don't have one.
2. **New repository** → name it `factor-desk` → **Public** → Create.
   On a free GitHub account, Pages only works for public repos. That is safe:
   the repo holds only the tool, never your portfolios, positions or Drive URLs.
3. **Add file → Upload files** → drop in `index.html` (it must be named exactly
   `index.html`) → Commit.
4. **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main`,
   folder `/ (root)` → Save.
5. Wait ~1 minute. Your link appears at the top of that page:
   `https://<your-username>.github.io/factor-desk/`

That link is the tool. Open it, bookmark it, hand it to friends. There is no
server process, so it never sleeps and is always instant.

> Updating later: re-upload `index.html` (Add file → Upload files → commit). Pages
> redeploys in about a minute. Everyone's saved data is untouched — it lives in
> Drive, not in the page.

---

## Day one: no setup needed

Open the Pages link and use it. The tool works **completely without any Google
setup**:

- Load your TradingView screener export, rank, size, diff positions, build the
  IB BasketTrader CSV, review charts — all of it, no account, no login.
- Each quarter saves **in your browser** automatically.
- Click **“Download this quarter (.zip)”** to get one file with the basket, the
  data workbook, the chart-review file, the resulting portfolio, the sold list,
  and a README. Drag that .zip into any Google Drive folder yourself to archive
  it. No Apps Script, no URL, no permissions.

That is all most people ever need. **Automatic** Drive sync (below) is an
optional upgrade — set it up only if you want each quarter uploaded for you.

---

## Moving your existing history to the web link (do this once)

Browser storage belongs to each website separately, so the web link starts
**empty** even if you used the local file before. Your Drive files and XIRR
sheet are not affected — this is only the in-tool history list and saved URLs.

1. Open the **new** `index.html` from your computer (double-click). It picks up
   your old local history automatically.
2. Step 4 → **Backup**. A `FactorDesk_backup_<date>.json` file downloads.
3. Open your GitHub Pages link → step 4 → **Restore** → choose that file.

Use the same Backup/Restore to move to a new computer or browser. The backup
contains your Drive `/exec` URLs — keep it private, like the URLs themselves.

---

## Multiple portfolios (yourself and friends)

**Each portfolio is fully self-contained**: its own Google Apps Script URL, its
own Drive folder, its own XIRR sheet, its own saved-quarter history. Nothing is
shared between portfolios, which is what guarantees isolation.

### Your own two (or more) portfolios
In the tool, step 4, use the **Active portfolio** selector:

- **+ Add portfolio** → name it (e.g. *Main*, *Experimental*).
- With that portfolio active, open **Google Drive sync** and paste the Apps
  Script URL for *that* portfolio's Drive folder.
- Switch portfolios any time from the dropdown. Each remembers its own URL and
  its own history. Two portfolios can both have a "2026 Q3" without ever
  colliding.

Set up a **separate Apps Script deployment per portfolio** (one `/exec` URL per
Drive folder + XIRR sheet) — see below. That is the maximum-isolation setup.

### A friend's portfolio
Your friend opens the same Pages link, adds their own portfolio, deploys their
own Apps Script against their own Drive, and pastes their own `/exec` URL. They
never touch your URL, so they never touch your data.

> Switching portfolios clears the loaded positions, cash and account number, so
> load the IB statement for the portfolio you are working on after switching.

> **The one rule:** never share your Apps Script `/exec` URL. The tool is public;
> that URL is the private key to your Drive folder. Share the tool link, never
> the `/exec` URL.

---

## Per-portfolio Google Drive setup (once per portfolio)

For each portfolio you want archived to Drive:

1. Create (or pick) a **Drive folder** and an **XIRR Google Sheet** for that
   portfolio.
2. In that Sheet: **Extensions → Apps Script**, paste `FactorDesk_AppsScript.gs`,
   and set `DRIVE_FOLDER_ID` to that folder (or leave `""` to auto-create one).
3. **Deploy → New deployment → Web app**, *Execute as: Me*,
   *Who has access: **Anyone***. Copy the `/exec` URL.
4. In the tool, select that portfolio, open **Google Drive sync**, paste the URL,
   and click **Test connection**.

Repeat for your second portfolio with a **different** folder, sheet, and
deployment. (See the user guide for screenshots and the IB-statement / currency
details.)

---

## Files in this repo

- `index.html` — the tool (this is what GitHub Pages serves).
- `FactorDesk_AppsScript.gs` — the Google Apps Script, one deployment per portfolio.
- `Factor_Desk_User_Guide.docx` — full walkthrough (model, IB statement, currency, XIRR).
- `XIRR_Benchmark_Template.xlsx` — the returns-vs-S&P-500 sheet template.

Your saved quarters never live here — they live in your own Google Drive.

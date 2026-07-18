# Shipboard dogfood — A→E (P0 only)

Run this on **https://shipboard.ca** after each major ship.  
**Rule:** log everything you feel. **Fix only P0** (blocks generate → preview → ship). P1/P2 go to a backlog note.

| Severity | Meaning |
|----------|---------|
| **P0** | Cannot complete the loop (auth, generate, preview blank/crash, ship blocked wrongly, data loss) |
| **P1** | Painful but workaround exists |
| **P2** | Polish / copy / nice-to-have |

---

## A — Access

1. Open https://shipboard.ca → **Start free** / studio  
2. Sign in with **GitHub**  
3. Sign out → Sign in with **Google**  
4. Confirm avatar menu has **Sign out** (not only Settings)

**Pass if:** you land in studio signed in.  
**P0 if:** OAuth fails, loops, or no sign-out.

---

## B — Bootstrap (golden path)

1. New chat / empty studio  
2. Click **Admin Users** (primary)  
3. Optional second pass: **Auth Screens** or **Kanban**  
4. Wait until stream finishes (use **Continue** if truncated)

**Pass if:** multi-file source appears; no endless error toast.  
**P0 if:** hang, empty output, hard crash, quota error on free with gens left.

---

## C — Confirm preview

1. Open **Preview** when build settles  
2. Interact: table + Add user **or** auth toggle **or** Kanban add card  
3. Toolbar ship status: **Ready to ship** (or clear Not ready reason)

**Pass if:** interactive UI, no red fatal overlay.  
**P0 if:** blank iframe, Babel fatal, unusable UI, Ready stuck while code is complete.

---

## D — Diff / iterate

1. Send a small follow-up: e.g. *“Add a search box above the table”*  
2. Open **Changes** tab  
3. Confirm file list + unified diff vs previous version

**Pass if:** Changes shows real diffs.  
**P0 if:** Changes empty when code clearly changed, or iterate corrupts project.

---

## E — Eject / ship

1. **Push to GitHub** (or ZIP if push blocked)  
2. Confirm success dialog is **readable** (no white-on-white)  
3. Clone or download → `npm i` → optional `npm run dev`  
4. Optional: open folder in Cursor

**Pass if:** repo/ZIP is valid Next-ish project you can open.  
**P0 if:** push fails with no recovery, corrupt export, success UI unreadable.

---

## Optional (not blocking A→E)

- Settings → Database → BYOB Neon/Supabase (read-only map)  
- Gallery publish / remix  
- Deploy checklist dialog  

---

## Log template

```text
Date:
URL: https://shipboard.ca
A Access: PASS / FAIL — notes
B Bootstrap: PASS / FAIL — recipe used
C Preview: PASS / FAIL
D Changes: PASS / FAIL
E Ship: PASS / FAIL — GitHub or ZIP
P0s to fix:
```

Ship P0s before more features or marketing video.

---

## Automated smoke (Playwright)

Public surfaces only (no OAuth generate):

```bash
# against production (default)
npm run test:e2e

# against local
BASE_URL=http://localhost:3000 npm run test:e2e
```

Covers SEO pages, sitemap/robots/llms.txt, studio shell, homepage → studio CTA.  
**Does not replace** human dogfood B–E (generate → preview → ship).

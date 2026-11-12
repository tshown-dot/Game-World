# Teacher sheet script

`Code.gs` is the Google Apps Script behind the "Game World: Unlocks & Progress" sheet. It lets the games load a
student's unlocks and saved progress, and save progress and results. It is the only backend.

## Install or update (about 5 minutes)
1. Open the Apps Script project. Replace everything in `Code.gs` with the contents of this folder's `Code.gs`.
2. On the line `const SHEET_ID = ...` paste your sheet's ID (the long text between `/d/` and `/edit` in its address).
   Keep the real ID in Apps Script only, not in this repo.
3. Run it once to set up: choose `setupSheet` in the function menu, press Run, and approve the permission screen.
   It adds the `Progress` tab, fills the `Unlocks` tab with 250 student codes (`STUDENT_COUNT` at the top of the script), and adds a checkbox per town plus a `full_access` checkbox column. Tick `full_access` for a teacher or preview code to open every building in every town.
   It also adds 8 Grade 7 checkbox columns (`g7_town_1` to `g7_town_8`, columns K to R, after `full_access`). Boxes that are already ticked stay ticked, and no column moves.
   To add more students later, raise `STUDENT_COUNT`, paste the script again and run `setupSheet` again. Old codes never change.
4. Publish the change: Deploy, then Manage deployments, then the pencil icon, then Version: New version, then Deploy.
   Edit the existing deployment so the web app address stays the same.
5. Copy the codes from column A of the `Unlocks` tab into your own private roster next to student names.
   Never put names in the workbook or in this repo. Treat codes like passwords.

## Check it works (in a browser)
Replace `CODE` with one of the codes. You should see `"ok":true` and sixteen true/false values (8 Grade 6 towns, then 8 Grade 7 towns).
`<web app address>?action=load&code=CODE`
Tick a town's checkbox for that code in the `Unlocks` tab and reload after about a minute. The matching value turns true.
A made-up code should give `"error":"bad_code"`.

## Updating from version 2 to version 3 (adds Grade 7)
Follow steps 1 to 4 above exactly as for a new install (paste the new `Code.gs`, put your sheet ID back in, run
`setupSheet` once, then Deploy > Manage deployments > pencil > New version > Deploy). Then:
- In the `Unlocks` tab, columns K to R are the Grade 7 towns. `g7_town_4` (column N) is Factor Falls.
- To open Factor Falls for an accelerated student, tick `g7_town_4` on that student's row. To open it for everyone,
  tick it on the `ALL` row. Grade 7 towns never open on their own from Grade 6 progress.
- Until this update is installed, the game keeps working as before and Grade 7 stays closed for students
  (a `full_access` code can still preview it).

## Notes
- Unlock changes can take up to a minute to appear, because the script caches the table for 60 seconds.
- Tests for this script run against a pretend Google: `node tests/test_apps_script.js`. They do not prove it works on
  real Google, so do the browser check above after every install.

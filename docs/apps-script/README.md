# Teacher sheet script

`Code.gs` is the Google Apps Script behind the "Game World: Unlocks & Progress" sheet. It lets the games load a
student's unlocks and saved progress, and save progress and results. It is the only backend.

## Install or update (about 5 minutes)
1. Open the Apps Script project. Replace everything in `Code.gs` with the contents of this folder's `Code.gs`.
2. On the line `const SHEET_ID = ...` paste your sheet's ID (the long text between `/d/` and `/edit` in its address).
   Keep the real ID in Apps Script only, not in this repo.
3. Run it once to set up: choose `setupSheet` in the function menu, press Run, and approve the permission screen.
   It adds the `Progress` tab and fills the `Unlocks` tab with 250 student codes (`STUDENT_COUNT` at the top of the script) and a checkbox per town.
   To add more students later, raise `STUDENT_COUNT`, paste the script again and run `setupSheet` again. Old codes never change.
4. Publish the change: Deploy, then Manage deployments, then the pencil icon, then Version: New version, then Deploy.
   Edit the existing deployment so the web app address stays the same.
5. Copy the codes from column A of the `Unlocks` tab into your own private roster next to student names.
   Never put names in the workbook or in this repo. Treat codes like passwords.

## Check it works (in a browser)
Replace `CODE` with one of the codes. You should see `"ok":true` and eight true/false values.
`<web app address>?action=load&code=CODE`
Tick a town's checkbox for that code in the `Unlocks` tab and reload after about a minute. The matching value turns true.
A made-up code should give `"error":"bad_code"`.

## Notes
- Unlock changes can take up to a minute to appear, because the script caches the table for 60 seconds.
- Tests for this script run against a pretend Google: `node tests/test_apps_script.js`. They do not prove it works on
  real Google, so do the browser check above after every install.

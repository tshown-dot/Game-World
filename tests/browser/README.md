# Browser tests

These play each game and town in a real (hidden) Chrome window, through the real buttons, at 1366 x 768.
They check things the math tests cannot: dragging and tapping, hints and worked solutions, the fail screen and
retry, the end report, the town messages, no scrolling and no page errors.

Run them all (takes about 10 minutes):

    npm run test:browser

Run just one, by part of its name:

    npm run test:browser -- undo

- They never write to the real Google Sheet. Each test answers the sheet's requests with a stand-in.
- `expression_town.test.cjs` can also do a read-only check of the live sheet script (a made-up code, nothing written):
  `LIVE=1 npm run test:browser -- expression`.
- Screenshots land in `tests/browser/screenshots/` (ignored by git).
- Games expose their state to the tests only when opened with `?test` in the address.

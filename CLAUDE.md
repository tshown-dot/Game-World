# Project: Game World (enVision 2.0 Math Games, Grade 6 and up)

A "world" of short, game-style study activities that reinforce enVision 2.0 lessons for 6th graders.
The world has a **Super Map** (pick a town) and eventually **8 towns**, one per textbook topic.
Each town has its own map of buildings (one per lesson) and each building opens one game.
Teachers use it as classroom stations, independent practice and study-hall supplements, *after*
direct instruction. These are not tutorials.

## Who is working here
- The owner is a teacher and a novice "vibe coder". Claude does the building.
- Explain choices in plain language. Prefer a simple structure the owner can follow over a clever one.
- Before editing or adding files, show a short plan and wait for approval. Small steps, one lesson at a time.
- Say plainly what was tested and what was not. Never claim something works without running it.

## Structure
```
index.html                         Super Map (choose a town)
shared/                            code used by every town: map engine, audio, progress saving, styles
towns/<town-name>/index.html       a town map (one building per lesson)
towns/<town-name>/games/<lesson>/  one folder per game
tests/                             math-logic tests, runnable with plain `node`
docs/lessons.md                    lesson lists from the textbook database
```
- Planned first town: `towns/topic-4-equation-valley/` (Grade 6 Topic 4: Equations & Inequalities).
- Topic 3 ("Expression Town") started in the separate `tactics-math-arena` repo. The owner has approved moving it
  into this repo as `towns/topic-3-expression-town/` (copy, never edit the original repo). When copying: remove the
  Supabase and Apps Script calls, stored passcodes and all hard-coded credentials (see Progress and unlocks below).
- Towns 1 and 2 are not built yet. Town order is by textbook topic: 1 Decimal Docks, 2 Integer Highlands,
  3 Expression Town, 4 Equation Valley, 5-8 to be decided.
- Each town has its own biome (terrain, palette, landmark). The Super Map is a pixel-style overworld with 8 regions.
- Write shared code once in `shared/`. Do not copy the map engine or audio code into each town.

## Progress and unlocks (owner decisions)
- Students use an anonymous code (no names). Progress is kept on the device (localStorage) and the active code is
  remembered locally. Passcodes are never stored in the browser.
- Towns unlock in order: town N+1 opens when the boss of town N is beaten. A teacher can open any town early.
- Teacher unlocks and class progress live in one Google Sheet, "Game World: Unlocks & Progress", with tabs:
  `Unlocks` (one row per anonymous student code plus an `ALL` row, one column per town, TRUE = open),
  `Results` (one row per finished game: timestamp, student_code, town, lesson, game, score, problems_attempted,
  problems_correct, accuracy, boss_defeated, practice_mode) and `Towns` (column-to-town key and instructions).
- The game reads unlocks and writes results through a small Google Apps Script web app (it returns only one student's
  row, never the whole table). Results are queued on the device and sent when the network is back.
- No Supabase or other database unless the owner approves it. The name-to-code roster is never stored in this repo or
  in that sheet.
- Verify with a stand-in endpoint in tests: the build container cannot reach Google, so live sheet access needs a
  manual check on a real network.
- Write shared code once in `shared/`. Do not copy the map engine or audio code into each town.

## Reference projects (read-only, owned by the same teacher)
- `tshown-dot/tactics-math-arena`: Topic 3 hub ("Expression Town") with 8 cartridge games. Source of the design pillars and test pattern.
- `tshown-dot/3.4-Game`, `Envisions-3.5-`, `Envisions-3.6-Distributive-Property`: standalone predecessors of Topic 3 games.
- `tshown-dot/coordinate-commander`: Topic 2 coordinate-plane game.
- `tshown-dot/6th-Topic-4`: earlier planning repo for Topic 4. Superseded by this repo.
Do not edit those repos. Copy ideas, not files, unless the owner says otherwise.

## Curriculum data
- The owner keeps a Google Sheet, "Universal Math Textbook Database (G6 & G7)", with tabs for Lessons, Items (textbook
  problems) and Assets (images). Lesson lists live in `docs/lessons.md`. Do not invent lesson titles or standards.
- The Items tab is scanned text, so wording can be garbled, and most answer fields just say "See lesson solution key".
  Use it for problem types and misconception ideas. Compute answers in code. Have the owner review hints.
- Do not copy local file paths or personal details from the sheet into this repo.

## Technical freedom
Games do NOT have to be a single HTML file. Choose whatever gives students the best experience while staying
maintainable by an LLM plus a novice owner. Guardrails:
- Prefer plain HTML/CSS/JavaScript (ES modules). Add a framework or build step only with a clear reason, and explain it first.
- Must run on low-spec school Chromebooks, load fast on locked-down school networks, and work offline once loaded.
  Third-party CDNs (Tailwind, Google Fonts and similar) are allowed because they work on the owner's school network.
  Pin an exact version in every CDN URL so an upstream release cannot change the games, and give fonts a system-font
  fallback so a blocked CDN does not break the page.
- Deployable as a static site (Render or GitHub Pages) with no server required. Use relative paths so it works from a subfolder.

## Design pillars
1. **Genre fits the math.** The concept dictates the mechanic. Never pause play for disconnected pop-up quiz cards.
2. **Real stakes, fast retry.** Timers, health, lives or limited moves. A failure gives diagnostic feedback and a retry in under 2 seconds.
3. **Reinforce and extend.** Assume direct instruction already happened. Challenge from new angles and finish with a higher-order boss or dilemma.
4. **Real game feel.** Objective clear within 10 seconds (what do I control, what stops me, how do I win). Juice: screen shake, crisp sound, punchy animation.
5. **Classroom flow.** Fits 1366x768 with no vertical scrolling. Runs last 3-10 minutes. Students can start from any zone for differentiation.
6. **Briefing first.** Every game opens with a briefing or worked demo (objective, controls, stakes) and a clear Start button. This also unlocks browser audio. A help toggle stays available during play.
7. **Feedback that teaches.** Detect specific misconceptions and explain them. After two misses, show the full worked solution and give a backup problem of the same type.
8. **Accessibility options.** Offer a no-timer, no-damage practice mode. Sound is easy to mute. Support keyboard, touch and trackpad.
9. **Generated problems.** Problems are randomly generated each play, and the generator accepts equivalent answer formats (for example 15, $15, 15.00).
10. **One world.** Towns share look, controls and progress so moving between them feels like one game.

## Privacy (non-negotiable)
- No student names or personal information, ever. No logins that collect names or emails.
- Progress is keyed to an anonymous code and kept on the device (localStorage). The only approved backend is the
  owner's Google Sheet described under "Progress and unlocks". Anything else needs the owner's approval first.
- Never commit secrets, API keys, passwords or teacher credentials. Use environment variables or placeholders.

## Testing
- Each game's math logic (generators, answer checking, misconception detection) lives in its own module with a `test_*.js` file runnable with plain `node`.
- Test answer parsing with multiple formats and with common wrong answers.
- Before saying a game is done: run the tests, load it in a headless browser at 1366x768, confirm no console errors and no vertical scroll.

## Git
- Commit messages are short and descriptive. One logical change per commit.
- Push only to the branch the session specifies. Do not open pull requests unless asked.

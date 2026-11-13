# Project: Game World (enVision 2.0 Math Games, Grade 6 and up)

A "world" of short, game-style study activities that reinforce enVision 2.0 lessons for 6th graders.
The world has a **Super Map** (pick a town) and eventually **8 towns** per grade, one per textbook topic: the Grade 6
map, and the **Grade 7 Isles** for accelerated students (owner decision: one world, not a separate site).
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
index.html                         Super Map (sign in once, choose a town)
world/                             Super Map code: superMap.js (behavior), superMapArt.js (art), superMap.css
shared/                            code used by every town: progressStore.js (sign-in and saving), towns.js
                                   (town list and unlock rules), audio.js (sound), config.js (sheet address),
                                   world.css (shared look), art.js (trees, clouds, hero, nameplates),
                                   cartridgeHarness.js (opens a game inside a town)
shared/town/                       the shared town engine: townState.js (progress and unlock rules inside a
                                   town), townHub.js (map, walking, briefings, victory, My Progress), town.css
shared/game/                       the shared game parts: arcadeShell.js (action games, see below), track.js (a number-line track), gameShell.js (zones, timer meter, 3 lives, scoring,
                                   feedback, worked solution + backup, report, town messages), drag.js (drag
                                   or tap a piece), game.css (top bar, side panel, controls, briefing, report)
towns/<town-name>/index.html       a town map (one building per lesson)
towns/<town-name>/games/<lesson>/  one folder per game
tests/                             math-logic tests, runnable with plain `node`
docs/lessons.md                    lesson lists from the textbook database
```
- Equation Valley (`towns/topic-4-equation-valley/`, Topic 4) is built on the shared town engine. A town only supplies
  its building list (`js/valley.js`) and art (`js/valleyArt.js`). Built so far: 4-1 Key Fitter, 4-2 Counterweight, 4-3 Undo Machine, 4-4 Gear Shift, 4-5 Food Truck, 4-6 Ride Gate, 4-7 Force Field, 4-8 Cause and Effect Lab, 4-9 Rune Machine, 4-10 Trail Mapper
  and the Golem Fort boss (`games/4-boss-golem-fort/`, a review of 4-1 to 4-10). Every Equation Valley building is built.
  In other towns, unbuilt buildings show "under construction" and are skipped in the unlock chain until they exist.
- **Design standard (owner decision): action first, not a polished quiz.** The move the student repeats must BE the math
  (shade a graph and watch numbers test it, sort like terms), with no question panel, many small decisions per minute,
  and hints only after a mistake. Topic 3's Term Popper and Drone Drop and Grade 7's Log Flume are the models.
  4-7 Force Field is the first game rebuilt this way, on `shared/game/arcadeShell.js`: `createArcade({...})` runs the
  briefing, top bar, damage meter, 3 lives, hint card (same mistake twice in a zone), fail and report; the game runs its
  own action loop and calls `arcade.good()` / `arcade.bad(key)` / `arcade.zoneCleared()`. Its page has no side panel
  (`<main id="app" class="arcade">`). In Force Field each wave is: shade the graph, pods test it, then "your turn" orders
  where the student picks numbers of their own (`makeOrder` / `checkOrder` in `field.js`); in the boss the student chooses
  which numbers to test to find a hidden rule. 4-1 Key Fitter is rebuilt the same way (`keys.js`): the student holds a key
  and taps every lock it opens as locks roll past (`genBelt` / `checkTap`), then slides a key of their own with free test
  keys (`genRing`, `genMystery`, `checkTry`) and forges a lock (`checkForge`). 4-5 Food Truck is rebuilt too (`truck.js`, drawn
  in HTML, not SVG): call tickets MORE or LESS on a rail (`checkEstimate`), pick the undo tool and watch the ticket unwind
  (`toolsFor` / `unwind`, with the reciprocal shown as `2/3 × 3/2 = 1`), ring up exact answers (`checkRing`), write a ticket
  from a story with tiles (`checkBuild`) and find the new cook's wrong line (`genSlip`). 4-9 Rune Machine is rebuilt too
  (`rune.js`, HTML): catch each output with a basket on a number line (`genCatch` / `checkCatch`), set the rule on dials and
  watch the machine run every row (`genDials` / `testRule`), pick the input for a target (`genBack`), and choose which inputs
  to test on a hidden rule (`genFeed` / `dialsFromFeed`). In a game's own CSS never reuse a class name from `shared/game/game.css`
  (`.crate` is the life boxes in the top bar). 4-3 Undo Machine is rebuilt on a number-line track (`shared/game/track.js` +
  `track.css`, to be reused by 4-4): an equation is one run of a cart, start + push = flag; the student sets the start or the
  push and watches it land (`genRun` / `checkRun` in `undo.js`), writes an equation for a story from tiles (`genStory` /
  `checkBuild`) and tests a mystery push (`genMystery`). Proposed order for reworking the
  remaining games (most quiz-like first): 4-4, 4-8, 4-6, 4-10, 4-2, then the Golem Fort; Grade 7: 4-2, 4-5, 4-4, 4-1, 4-3.
  Rework one game at a time, each with a plan the owner approves.
- Every other game is built on `shared/game/gameShell.js`: `createGame({...})` takes the zones, problem generators, worked
  solution, timer seconds, wording and skill tips, and the game only draws its own problems and controls. Copy the
  page layout from an existing game's `index.html` (the shell needs its ids, including `lives` for the 3 lives).
  Each game also links `shared/game/game.css` plus its own small `style.css` for its scene. Use `shared/game/drag.js`
  for anything a student drags or taps into place. Never copy the shell's code into a game.
- Topic 3 ("Expression Town") started in the separate `tactics-math-arena` repo and now lives here as
  `towns/topic-3-expression-town/`. It was copied (the original repo was never edited). The 8 games (`cartridges/`)
  are unchanged and do not use the shared game shell. The town runs on the shared town engine like Equation Valley:
  `js/expressionTown.js` builds the stages from `js/nodes.js` (the building list) and draws with `js/worldArt.js`
  (art made for a 1366 x 658 map, moved down 55 px). Its roads turn square corners using each stage's `via` points.
  Older Expression Town saves carry `unlockedNodes` and the old stage id `node_3_4` (`js/legacy.js`); the shared
  engine keeps every stage those saves had open. The Boss Castle (`node_apex`) opens `games/3-boss-castle/`, the
  Topic 3 review boss (the Expression Colossus, lessons 3-1 to 3-7), built on the shared game shell like the Golem Fort.
- `npm test` runs every test in the repo (the sheet script, the progress store, the Topic 3 hub and all its games).
- **Grade 7 Isles** (owner decisions): every town in `shared/towns.js` has a `grade` (6 or 7) and a `number` (1-8 inside
  its grade). Grade 6 ids never change (`topic_1`...); Grade 7 ids start with `g7_`. The list order is the sheet's flag
  order (0-7 Grade 6, 8-15 Grade 7), so only add towns at the end. A Grade 7 town opens ONLY by a teacher tick
  (`g7_town_N` columns K-R in the Unlocks tab, after `full_access`) or a full_access code, never from Grade 6 progress;
  inside Grade 7, beating a boss opens the next built Grade 7 town. The Super Map shows one grade at a time; the sail
  sign (or G) switches maps and is shown only to students who can enter a Grade 7 town. The Grade 7 map is the Grade 6
  land mirrored (`pointOf` in `world/superMapArt.js`).
- Factor Falls (`towns/g7-topic-4-factor-falls/`, Grade 7 Topic 4, id `g7_topic_4`) is the first Grade 7 town: 8 lessons
  plus the Thunder Falls boss, on the shared town engine. Built so far: 4-1 Ranger Station (`games/4-1-ranger-station/`,
  build `start ± rate·v` by dragging number chips, then evaluate with decimals and negatives) and 4-2 Twin Bridges
  (`games/4-2-twin-bridges/`: test two expressions with a value, name the property, fill boxes to build a twin, select
  every twin; expressions are stored as text plus what they equal, `m·x + k`) and 4-3 Log Flume (`games/4-3-log-flume/`:
  each term is a log `{ c, v }`; sort logs into channels of like terms, then type each channel's total) and 4-4 Spray Deck
  (`games/4-4-spray-deck/`: an area model, `a(inside) + tail`; type each section's area, then simplify) and 4-5 Factor Mill
  (`games/4-5-factor-mill/`: the deck run backward; pick the wheel = GCF, then type each term divided by it). The other building names
  in `js/falls.js` are working names until each game is planned with the owner. (A town with `gamesReady: false` in
  `shared/towns.js` is left off `stations.html`.)
  Grade 7 problems go beyond Grade 6 Topic 3 (negative, decimal and fraction coefficients, two variables, subtracting
  expressions), so reuse mechanics and the shared shell, but write new generators.
- Towns 1 and 2 are not built yet. Town order is by textbook topic: 1 Decimal Docks, 2 Integer Highlands,
  3 Expression Town, 4 Equation Valley, 5-8 to be decided.
- Each town has its own biome (terrain, palette, landmark). The Super Map is a pixel-style overworld with 8 regions:
  harbor (1), highlands (2), meadow (3), canyon (4), and placeholder biomes for towns 5-8 (swamp, volcano, tundra,
  sky) until the owner names those towns. Town names, topics and biomes live in `shared/towns.js`.
- Students sign in once on the Super Map; towns reuse the remembered code. A town's "world map" sign returns to the
  Super Map (`index.html?from=<town id>` puts the hero outside that town). EXIT anywhere signs out.
- Inside a town, buildings unlock in order; unbuilt buildings are skipped; a full_access code opens every built one.
  Only stage records are saved, and what is open is worked out from them, so adding buildings never locks anyone out.
- Practice-mode runs still count as clearing a building (same as Expression Town). Owner decision: a town BOSS is only
  defeated by a timed run. A practice-only boss clear keeps its star but is saved with `practiceOnly: true`, and
  `townSummary` in `shared/towns.js` does not count it, so it does not open the next town.
- Write shared code once in `shared/`. Do not copy the map engine or audio code into each town.

## Progress and unlocks (owner decisions)
- Up to 250 students, each with their own Chromebook. Progress must survive a browser clear and a device change,
  so it is saved in the owner's Google Sheet, with the device keeping a local copy for speed and offline use.
- Each student gets a teacher-issued code: 6 characters from `A-H J-N P-Z 2-9` (no I, O, 0 or 1), generated inside
  the owner's Google account and handed out on sticky notes. Codes are not case-sensitive in the game. Only codes that
  exist in the sheet are accepted. No names anywhere, and no passcode or stored password.
- The first built town is always open (for now Expression Town, Town 3). Towns that are not built show
  "coming soon" and are skipped in the unlock chain. A town a student has already played never locks again,
  even if earlier towns are built later.
- Towns unlock in order: the next built town opens when the boss of the previous built town is beaten. A teacher can open a town early by ticking
  that town's box for a student or for the `ALL` row. That opens the town only; buildings inside still unlock in order.
- `full_access` (a checkbox column, for a teacher or preview code) opens every building in every town, like the old
  teacher mode. It shows a TEACHER banner and never rewrites the student's real saved unlocks.
- One Google Sheet, "Game World: Unlocks & Progress", has tabs: `Unlocks` (one row per student code plus an `ALL` row,
  one checkbox column per town plus a `full_access` checkbox), `Progress` (student_code, progress JSON, updated_at; one row per student),
  `Results` (one row per finished game: timestamp, student_code, town, lesson, game, score, problems_attempted,
  problems_correct, accuracy, boss_defeated, practice_mode) and `Towns` (column-to-town key and instructions).
  The `Unlocks` tab also has 8 Grade 7 checkbox columns after `full_access` (script version 3, `docs/apps-script/`).
- A Google Apps Script web app is the only backend. `GET ?action=load&code=` returns that student's open towns and
  saved progress and `full_access`, never other rows. `POST` with `type: "save"` or `type: "result"` writes progress
  or a result row. Saved progress is one JSON object: `{v, level, xp, coins, savedAt, towns: {topic_3: {...}}}`, where
  each town keeps its own slice and unknown slices are passed through untouched.
  The game saves at milestones (finished game, boss, new building), not on every click, retries with a short random
  delay if the script says `busy`, and queues writes on the device while offline.
- Signing in on a device that has never seen the code needs the internet once. After that, play works offline and
  saves wait in a queue on the device until the network is back.
- A code this device already knows opens at once from the device copy (Super Map and towns), and the sheet is
  checked in the background (`loadStudent(code, { fast: true, onFresh })`). Teacher ticks show up a moment later;
  a code removed from the sheet is signed out. Never make the Super Map wait on the sheet when coming back from a town.
- Planned, not built yet: a short "save code" the student can copy and paste to restore progress if the sheet is
  unreachable.
- **Station Mode** (owner decision, for classroom stations): any page opened with `?station` skips sign-in and opens every
  built town and building (`index.html?station` for the whole world; `towns/<town>/index.html?station` for one town,
  with the world-map sign hidden so students stay there). Nothing is sent to the sheet and nothing counts toward real
  progress; stars last only until the tab closes (sessionStorage). `?station=off` returns the tab to normal sign-in.
  Teachers get the links from `stations.html` (not linked from the game). It lives in `shared/station.js` plus a few
  lines in `shared/progressStore.js`; the station "code" is `STATION`, which can never be a real code. The links are
  hidden, not locked. Every new town must call `startStation(townId)` (the shared town engine already does).
- Students see their own progress in-game (the "MY STARS" button opens a "My Progress" screen with stars, badges and
  save status). Every town gets the same screen. No printing. A screenshot is how a student shares progress with the
  teacher.
- No Supabase or other database unless the owner approves it. The name-to-code roster is never stored in this repo or
  in that sheet. Treat codes like passwords: never commit them.
- Test the game against a stand-in endpoint so tests never write to the owner's real sheet. The build environment
  may be allowed to reach `script.google.com`, so read-only checks against the live script are possible, but never
  write test rows to the real sheet without asking.

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
A game can meet every pillar on paper and still be a polished quiz. Check each new game, and each rework, against the
tests written under the pillars before calling it done.

1. **Genre fits the math.** The concept dictates the mechanic (exponents: a reactor surge; GCF: splitting loot;
   distributive property: drone deliveries). Never pause play for disconnected pop-up quiz cards.
   - *The verb test:* name the action the student repeats most. If it is "read a prompt and answer it", it is a quiz,
     whatever the theme. If it is "shade a graph", "sort like terms" or "split the loot", the math is the mechanic.
   - *The reskin test:* if another lesson's problems could be swapped in without changing the controls, the genre does
     not fit the math.
   - No question panel by default. The rule or goal lives in the scene (a sign, a gauge), not in a side box.
2. **Real stakes, fast retry.** Timers, health, lives or limited moves. A failure gives diagnostic feedback and a retry in under 2 seconds.
   - *Consequences, not verdicts:* the game world shows the mistake before any text does (a wrong circle lets exactly
     the edge pod through). The explanation comes after the consequence.
3. **Reinforce and extend.** Assume direct instruction already happened. Challenge from new angles and finish with a higher-order boss or dilemma.
   - *Produce, don't just judge:* the student makes something of their own (a number, an expression, a graph), not only
     recognizes a right answer.
   - Include at least one "work backward" or "find the hidden rule" phase where the student decides what to test.
4. **Real game feel.** Objective clear within 10 seconds (what do I control, what stops me, how do I win). Juice: screen shake, crisp sound, punchy animation.
   - *Volume:* many small decisions per minute, not five big questions per zone.
   - *Plan, then watch:* a moment to set something up, then the game tests the plan.
5. **Classroom flow.** Fits 1366x768 with no vertical scrolling. Runs last 3-10 minutes. Students can start from any zone for differentiation.
6. **Briefing first.** Every game opens with a briefing or worked demo (objective, controls, stakes) and a clear Start button. This also unlocks browser audio. A help toggle stays available during play.
7. **Feedback that teaches.** Detect specific misconceptions and explain them. Hints come only after a mistake, and a
   fuller hint after the same mistake twice. After two misses, show the worked solution (or an answer that works) and
   give another try of the same type.
8. **Accessibility options.** Offer a no-timer, no-damage practice mode. Sound is easy to mute. Support keyboard, touch and trackpad.
9. **Generated problems.** Problems are randomly generated each play, and the generator accepts equivalent answer formats (for example 15, $15, 15.00).
10. **One world.** Towns share look, controls and progress so moving between them feels like one game.
11. **The representation is the playfield.** The math's own picture (number line, balance, area model, table) is the
    game board, drawn the way the textbook draws it, so the skill transfers back to paper.
12. **Boundary cases on purpose.** Every wave includes the values where misconceptions live (the edge itself, 12.01,
    zero, a negative), because that is where understanding is separated from pattern-matching.

## Privacy (non-negotiable)
- No student names or personal information, ever. No logins that collect names or emails.
- Progress is keyed to an anonymous code and kept on the device (localStorage). The only approved backend is the
  owner's Google Sheet described under "Progress and unlocks". Anything else needs the owner's approval first.
- Never commit secrets, API keys, passwords or teacher credentials. Use environment variables or placeholders.

## Testing
- Each game's math logic (generators, answer checking, misconception detection) lives in its own module with a `test_*.js` file runnable with plain `node`.
- Test answer parsing with multiple formats and with common wrong answers.
- Before saying a game is done: run the tests, load it in a headless browser at 1366x768, confirm no console errors and no vertical scroll.
- Browser tests live in `tests/browser/` (one `*.test.cjs` per game or town, run with `npm run test:browser`, or
  `npm run test:browser -- <name>` for one). Every new game gets one: play all zones through the real controls,
  one wrong answer, two misses (worked solution + backup), practice mode, fail and retry, the town messages,
  no scroll and no errors. They answer the sheet with a stand-in and never touch the real sheet.

## Git
- Commit messages are short and descriptive. One logical change per commit.
- Push only to the branch the session specifies. Do not open pull requests unless asked.

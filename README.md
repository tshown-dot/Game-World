# Game World

A world of short math games for 6th graders, aligned with **enVision 2.0**.
Students pick a town on the **Super Map**. Each town is one textbook topic, with a building for every lesson and a game inside each building.

## Towns

| Town | Topic | Status |
|---|---|---|
| Expression Town | Topic 3: Numeric & Algebraic Expressions | Complete: lessons 3-1 to 3-7 and the Boss Castle (the Expression Colossus, a Topic 3 review). On the shared town engine, with code sign-in and cloud saving |
| Equation Valley | Topic 4: Equations & Inequalities | Open. Complete: lessons 4-1 to 4-10 (Key Fitter, Counterweight, Undo Machine, Gear Shift, Food Truck, Ride Gate, Force Field, Cause and Effect Lab, Rune Machine, Trail Mapper) and the Golem Fort boss |
| Factor Falls (Grade 7 Isles) | Grade 7 Topic 4: Generate Equivalent Expressions | Lessons 4-1 to 4-3 are built (Ranger Station, Twin Bridges, Log Flume); other lessons coming. For accelerated students: opens only by teacher tick |
| Six more towns | To be decided | Planned |

## Status
The Super Map, Expression Town (Topic 3) and Equation Valley (Topic 4, all ten lessons and the Golem Fort boss) are live, with code sign-in and cloud saving. See `CLAUDE.md` for the design rules and project structure, and `docs/lessons.md` for the Topic 4 lesson list.

## Principles
- The math concept picks the game genre.
- Real stakes, fast retry, feedback that explains the mistake.
- Runs on school Chromebooks. Students sign in with a code from the teacher: no names, no emails, no student personal information.

## Running the tests
- `npm test` runs all the math and progress tests (needs Node 18 or newer).
- `npm run test:browser` plays every game and town in a hidden browser (needs Playwright; see `tests/browser/README.md`).

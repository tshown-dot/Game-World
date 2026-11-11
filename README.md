# Game World

A world of short math games for 6th graders, aligned with **enVision 2.0**.
Students pick a town on the **Super Map**. Each town is one textbook topic, with a building for every lesson and a game inside each building.

## Towns

| Town | Topic | Status |
|---|---|---|
| Expression Town | Topic 3: Numeric & Algebraic Expressions | Built. Lives in `towns/topic-3-expression-town/` with code sign-in and cloud saving |
| Equation Valley | Topic 4: Equations & Inequalities | Open. Lessons 4-1 Key Fitter, 4-2 Counterweight and 4-3 Undo Machine are built; other lessons coming |
| Six more towns | To be decided | Planned |

## Status
The Super Map, Expression Town (Topic 3) and Equation Valley (Topic 4, lessons 4-1 to 4-3) are live, with code sign-in and cloud saving. See `CLAUDE.md` for the design rules and project structure, and `docs/lessons.md` for the Topic 4 lesson list.

## Principles
- The math concept picks the game genre.
- Real stakes, fast retry, feedback that explains the mistake.
- Runs on school Chromebooks. Students sign in with a code from the teacher: no names, no emails, no student personal information.

## Running the tests
`npm test` runs all tests (needs Node 18 or newer).

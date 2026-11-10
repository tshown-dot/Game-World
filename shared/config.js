// Settings shared by every town in Game World.
// This is the only place the sheet web app address should be written.

export const CONFIG = {
  // Public web app for the teacher sheet "Game World: Unlocks & Progress".
  // GET  ?action=unlocks&code=<student code>  returns which towns are open for that code.
  // POST {student_code, town, lesson, game, score, ...} adds one row to the Results tab.
  // It holds no secrets: it only returns one student's unlock flags and accepts results rows.
  SHEET_ENDPOINT:
    'https://script.google.com/macros/s/AKfycbynV4sv6ALkPOsLAViYpVFXDZoQoxZBVf8hlprt3jhfI5mY3kH5esSKlJos4PCv1mRn3w/exec',

  TOWN_COUNT: 8,
};

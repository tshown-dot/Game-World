// Settings shared by every town in Game World.
// This is the only place the sheet web app address should be written.

export const CONFIG = {
  // Public web app for the teacher sheet "Game World: Unlocks & Progress".
  // GET  ?action=load&code=<student code>  returns that student's open towns and saved progress.
  // POST {type:"save", student_code, progress}  saves progress.
  // POST {type:"result", student_code, town, lesson, game, score, ...}  adds one row to the Results tab.
  // The address holds no secrets: it only works for codes that exist in the sheet.
  SHEET_ENDPOINT:
    'https://script.google.com/macros/s/AKfycbynV4sv6ALkPOsLAViYpVFXDZoQoxZBVf8hlprt3jhfI5mY3kH5esSKlJos4PCv1mRn3w/exec',

  TOWN_COUNT: 8,
};

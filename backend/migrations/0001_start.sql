-- How much of each habit was done each day. A day with nothing done has no
-- row. `steps` is how far through the habit's levels it got (1 = done, for a
-- done-or-not habit).
CREATE TABLE days (
  habit TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  steps INTEGER NOT NULL CHECK (steps > 0),
  PRIMARY KEY (habit, date)
);

-- The to-do list, in order.
CREATE TABLE todos (
  position INTEGER PRIMARY KEY,
  id TEXT NOT NULL,
  text TEXT NOT NULL,
  done INTEGER NOT NULL CHECK (done IN (0, 1))
);

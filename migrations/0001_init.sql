-- supple schema (ported verbatim from server.py:287-294) + stateless-rate-limit table.
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  client TEXT,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY,
  user TEXT NOT NULL,
  csrf TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS workspace(
  id INTEGER PRIMARY KEY CHECK(id=1),
  data TEXT NOT NULL,
  revision INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS invitations(
  token TEXT PRIMARY KEY,
  client TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS videos(
  exercise TEXT PRIMARY KEY,
  file TEXT NOT NULL,
  mime TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events(
  user TEXT NOT NULL,
  key TEXT NOT NULL,
  PRIMARY KEY(user,key)
);
-- Workers are stateless, so login rate-limiting lives in D1 instead of an in-memory dict.
CREATE TABLE IF NOT EXISTS attempts(
  scope TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts ON attempts(scope, ts);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  interests TEXT NOT NULL,
  preferred_sources TEXT NOT NULL,
  reading_mode TEXT NOT NULL DEFAULT 'daily',
  language TEXT NOT NULL DEFAULT 'tr',
  reading_goal INTEGER NOT NULL DEFAULT 20
);

CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_text TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  image_url TEXT,
  author TEXT,
  published_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  duplicate_group_id TEXT,
  ai_summary TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE user_article_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  article_id TEXT NOT NULL REFERENCES articles(id),
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE bookmarks (
  user_id TEXT NOT NULL REFERENCES users(id),
  article_id TEXT NOT NULL REFERENCES articles(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, article_id)
);

CREATE TABLE read_status (
  user_id TEXT NOT NULL REFERENCES users(id),
  article_id TEXT NOT NULL REFERENCES articles(id),
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, article_id)
);

CREATE TABLE ingestion_runs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  fetched_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

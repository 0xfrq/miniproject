CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'guru')),
  password_hash text NOT NULL,
  class_name text NOT NULL DEFAULT '',
  academic_year text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public_records (
  collection text NOT NULL CHECK (collection IN ('values', 'activities', 'posts', 'agenda')),
  id text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  position bigserial NOT NULL,
  PRIMARY KEY (collection, id)
);

CREATE TABLE IF NOT EXISTS materials (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  position bigserial NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS materials_owner_idx ON materials(owner_id);

CREATE TABLE IF NOT EXISTS assessments (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  position bigserial NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id)
);
CREATE INDEX IF NOT EXISTS assessments_owner_idx ON assessments(owner_id);

CREATE TABLE IF NOT EXISTS questions (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  assessment_id text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  position bigserial NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_id, owner_id) REFERENCES assessments(id, owner_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS questions_owner_idx ON questions(owner_id);
CREATE INDEX IF NOT EXISTS questions_assessment_idx ON questions(assessment_id);

CREATE TABLE IF NOT EXISTS grading (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  assessment_id text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  position bigserial NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_id, owner_id) REFERENCES assessments(id, owner_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS grading_owner_idx ON grading(owner_id);
CREATE INDEX IF NOT EXISTS grading_assessment_idx ON grading(assessment_id);

CREATE TABLE IF NOT EXISTS legacy_imports (
  name text PRIMARY KEY,
  sha256 text NOT NULL,
  counts jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

-- Katalog buku teks SD dari SIBI (Kemendikdasmen) dan indeks RAG per buku.
CREATE TABLE IF NOT EXISTS books (
  id text PRIMARY KEY,
  slug text NOT NULL DEFAULT '',
  title text NOT NULL,
  grade smallint NOT NULL CHECK (grade BETWEEN 1 AND 6),
  curriculum text NOT NULL CHECK (curriculum IN ('merdeka', 'k13')),
  book_type text NOT NULL CHECK (book_type IN ('siswa', 'guru')),
  subject text NOT NULL DEFAULT '',
  source_url text NOT NULL,
  cover_url text NOT NULL DEFAULT '',
  isbn text NOT NULL DEFAULT '',
  writer text NOT NULL DEFAULT '',
  publisher text NOT NULL DEFAULT '',
  edition text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  index_status text NOT NULL DEFAULT 'none' CHECK (index_status IN ('none', 'indexing', 'ready', 'failed')),
  index_progress smallint NOT NULL DEFAULT 0 CHECK (index_progress BETWEEN 0 AND 100),
  index_error text NOT NULL DEFAULT '',
  index_started_at timestamptz,
  indexed_at timestamptz,
  page_count integer,
  chunk_count integer NOT NULL DEFAULT 0,
  file_size bigint,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS books_grade_idx ON books(grade, curriculum, book_type);
CREATE INDEX IF NOT EXISTS books_status_idx ON books(index_status);

CREATE TABLE IF NOT EXISTS book_chunks (
  book_id text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  page_start integer NOT NULL,
  page_end integer NOT NULL,
  content text NOT NULL,
  embedding real[] NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('indonesian'::regconfig, content)) STORED,
  PRIMARY KEY (book_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS book_chunks_tsv_idx ON book_chunks USING gin(tsv);

-- Embedding disimpan sudah dinormalisasi, sehingga dot product = cosine similarity.
CREATE OR REPLACE FUNCTION vector_dot(a real[], b real[]) RETURNS double precision
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  AS 'SELECT sum(x::double precision * y) FROM unnest(a, b) AS t(x, y)';

CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  book_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_conversations_owner_idx ON ai_conversations(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
  id bigserial PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sources) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_messages_conversation_idx ON ai_messages(conversation_id, id);

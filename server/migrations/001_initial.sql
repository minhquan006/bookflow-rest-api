CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 120),
  email text NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254),
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('MEMBER', 'LIBRARIAN', 'ADMIN')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (name = btrim(name) AND length(name) BETWEEN 1 AND 100),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categories_name_normalized_unique ON categories (lower(name));

CREATE TABLE books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  isbn text UNIQUE CHECK (isbn IS NULL OR (isbn ~ '^([0-9]{9}[0-9X]|[0-9]{13})$')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 255),
  author text NOT NULL CHECK (length(btrim(author)) BETWEEN 1 AND 255),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
  archived_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX books_category_id_idx ON books (category_id);

CREATE TABLE book_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  barcode text NOT NULL UNIQUE CHECK (barcode = btrim(barcode) AND length(barcode) BETWEEN 1 AND 64),
  condition_status text NOT NULL DEFAULT 'AVAILABLE' CHECK (condition_status IN ('AVAILABLE', 'MAINTENANCE', 'RETIRED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX book_copies_book_condition_idx ON book_copies (book_id, condition_status);

CREATE TABLE loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  copy_id uuid NOT NULL REFERENCES book_copies(id) ON DELETE RESTRICT,
  borrowed_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  returned_at timestamptz,
  returned_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT loans_due_after_borrow CHECK (due_at > borrowed_at),
  CONSTRAINT loans_return_after_borrow CHECK (returned_at IS NULL OR returned_at >= borrowed_at),
  CONSTRAINT loans_return_pair CHECK ((returned_at IS NULL) = (returned_by IS NULL))
);
CREATE UNIQUE INDEX loans_one_open_per_copy ON loans (copy_id) WHERE returned_at IS NULL;
CREATE INDEX loans_user_returned_idx ON loans (user_id, returned_at);
CREATE INDEX loans_open_due_idx ON loans (due_at) WHERE returned_at IS NULL;

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 100),
  entity_type text NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 100),
  entity_id uuid NOT NULL,
  request_id text NOT NULL CHECK (length(request_id) BETWEEN 1 AND 128),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_occurred_id_idx ON audit_logs (occurred_at DESC, id);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, occurred_at DESC);
CREATE INDEX audit_logs_action_idx ON audit_logs (action, occurred_at DESC);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  family_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by uuid REFERENCES refresh_tokens(id) ON DELETE RESTRICT,
  CONSTRAINT refresh_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT refresh_replacement_requires_revocation CHECK (replaced_by IS NULL OR revoked_at IS NOT NULL),
  CONSTRAINT refresh_no_self_replacement CHECK (replaced_by IS NULL OR replaced_by <> id)
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_expiry_idx ON refresh_tokens (expires_at);

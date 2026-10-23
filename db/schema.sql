CREATE TABLE IF NOT EXISTS templates (
  id                   TEXT PRIMARY KEY,
  label                TEXT NOT NULL,
  description          TEXT,
  delimiter            TEXT NOT NULL CHECK (delimiter IN (';', ',', E'\t', '|')),
  column_order_matters BOOLEAN NOT NULL DEFAULT FALSE,
  volume_name          TEXT NOT NULL UNIQUE,
  columns              JSONB NOT NULL
    CHECK (jsonb_typeof(columns) = 'array' AND jsonb_array_length(columns) > 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
)
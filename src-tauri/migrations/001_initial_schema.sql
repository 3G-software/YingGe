PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS libraries (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    root_path   TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assets (
    id              TEXT PRIMARY KEY,
    library_id      TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    file_name       TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    relative_path   TEXT NOT NULL,
    file_type       TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    file_size       INTEGER NOT NULL,
    file_hash       TEXT NOT NULL,
    width           INTEGER,
    height          INTEGER,
    duration_ms     INTEGER,
    description     TEXT NOT NULL DEFAULT '',
    ai_description  TEXT NOT NULL DEFAULT '',
    thumbnail_path  TEXT,
    folder_path     TEXT NOT NULL DEFAULT '/',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    imported_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assets_library ON assets(library_id);
CREATE INDEX IF NOT EXISTS idx_assets_folder ON assets(library_id, folder_path);
CREATE INDEX IF NOT EXISTS idx_assets_file_type ON assets(file_type);
CREATE INDEX IF NOT EXISTS idx_assets_hash ON assets(file_hash);

CREATE TABLE IF NOT EXISTS tags (
    id          TEXT PRIMARY KEY,
    library_id  TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#808080',
    category    TEXT NOT NULL DEFAULT '',
    is_ai       INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_library ON tags(library_id, name);

CREATE TABLE IF NOT EXISTS asset_tags (
    asset_id    TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    confidence  REAL NOT NULL DEFAULT 1.0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (asset_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_tags_tag ON asset_tags(tag_id);

CREATE TABLE IF NOT EXISTS embeddings (
    id          TEXT PRIMARY KEY,
    asset_id    TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    model       TEXT NOT NULL,
    vector      BLOB NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_asset_model ON embeddings(asset_id, model);

CREATE TABLE IF NOT EXISTS ai_config (
    id              TEXT PRIMARY KEY,
    provider_name   TEXT NOT NULL,
    api_endpoint    TEXT NOT NULL,
    api_key         TEXT NOT NULL,
    model_id        TEXT NOT NULL,
    embedding_model TEXT NOT NULL DEFAULT '',
    is_active       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plugins (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    version         TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    entry_point     TEXT NOT NULL,
    enabled         INTEGER NOT NULL DEFAULT 1,
    config_json     TEXT NOT NULL DEFAULT '{}',
    installed_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- FTS5 full-text search on asset metadata
CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
    file_name,
    description,
    ai_description,
    content='assets',
    content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS assets_ai AFTER INSERT ON assets BEGIN
    INSERT INTO assets_fts(rowid, file_name, description, ai_description)
    VALUES (new.rowid, new.file_name, new.description, new.ai_description);
END;

CREATE TRIGGER IF NOT EXISTS assets_ad AFTER DELETE ON assets BEGIN
    INSERT INTO assets_fts(assets_fts, rowid, file_name, description, ai_description)
    VALUES ('delete', old.rowid, old.file_name, old.description, old.ai_description);
END;

CREATE TRIGGER IF NOT EXISTS assets_au AFTER UPDATE ON assets BEGIN
    INSERT INTO assets_fts(assets_fts, rowid, file_name, description, ai_description)
    VALUES ('delete', old.rowid, old.file_name, old.description, old.ai_description);
    INSERT INTO assets_fts(rowid, file_name, description, ai_description)
    VALUES (new.rowid, new.file_name, new.description, new.ai_description);
END;

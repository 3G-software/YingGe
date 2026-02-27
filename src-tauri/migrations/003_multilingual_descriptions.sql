-- Add multilingual description fields (ignore errors if columns already exist)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- So we'll handle this gracefully in the migration runner

-- Check if columns exist by attempting to add them
-- The migration runner will ignore errors for these statements
ALTER TABLE assets ADD COLUMN ai_description_en TEXT NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN ai_description_zh TEXT NOT NULL DEFAULT '';

-- Update FTS5 to include multilingual descriptions
-- Drop existing triggers and table first
DROP TRIGGER IF EXISTS assets_ai;
DROP TRIGGER IF EXISTS assets_ad;
DROP TRIGGER IF EXISTS assets_au;
DROP TABLE IF EXISTS assets_fts;

-- Recreate FTS5 table with multilingual fields
CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
    file_name,
    description,
    ai_description,
    ai_description_en,
    ai_description_zh,
    content='assets',
    content_rowid='rowid'
);

-- Recreate triggers
CREATE TRIGGER IF NOT EXISTS assets_ai AFTER INSERT ON assets BEGIN
    INSERT INTO assets_fts(rowid, file_name, description, ai_description, ai_description_en, ai_description_zh)
    VALUES (new.rowid, new.file_name, new.description, new.ai_description, new.ai_description_en, new.ai_description_zh);
END;

CREATE TRIGGER IF NOT EXISTS assets_ad AFTER DELETE ON assets BEGIN
    INSERT INTO assets_fts(assets_fts, rowid, file_name, description, ai_description, ai_description_en, ai_description_zh)
    VALUES ('delete', old.rowid, old.file_name, old.description, old.ai_description, old.ai_description_en, old.ai_description_zh);
END;

CREATE TRIGGER IF NOT EXISTS assets_au AFTER UPDATE ON assets BEGIN
    INSERT INTO assets_fts(assets_fts, rowid, file_name, description, ai_description, ai_description_en, ai_description_zh)
    VALUES ('delete', old.rowid, old.file_name, old.description, old.ai_description, old.ai_description_en, old.ai_description_zh);
    INSERT INTO assets_fts(rowid, file_name, description, ai_description, ai_description_en, ai_description_zh)
    VALUES (new.rowid, new.file_name, new.description, new.ai_description, new.ai_description_en, new.ai_description_zh);
END;

-- Rebuild FTS index with existing data (if any)
INSERT INTO assets_fts(rowid, file_name, description, ai_description, ai_description_en, ai_description_zh)
SELECT rowid, file_name, description, ai_description,
       COALESCE(ai_description_en, ''),
       COALESCE(ai_description_zh, '')
FROM assets;

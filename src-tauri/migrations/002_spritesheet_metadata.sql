-- Add spritesheet metadata table
CREATE TABLE IF NOT EXISTS spritesheet_metadata (
    asset_id        TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    sprite_info     TEXT NOT NULL,  -- JSON string containing sprite positions and sizes
    sheet_width     INTEGER NOT NULL,
    sheet_height    INTEGER NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spritesheet_asset ON spritesheet_metadata(asset_id);

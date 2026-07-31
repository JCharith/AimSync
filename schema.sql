-- ====================================================================
-- AimSync Cloudflare D1 Relational Database Schema
-- Production-Ready Schema supporting Auth.js, Session Telemetry,
-- Rolling Skill Matrices, 4-Quadrant Miss Averages, & Anti-Cheat Triggers
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Auth.js Core Authentication Tables
-- --------------------------------------------------------------------

DROP TABLE IF EXISTS verification_tokens;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    emailVerified DATETIME,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    providerAccountId TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    sessionToken TEXT UNIQUE NOT NULL,
    userId TEXT NOT NULL,
    expires DATETIME NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires DATETIME NOT NULL,
    PRIMARY KEY (identifier, token)
);

-- --------------------------------------------------------------------
-- 2. Consolidated User Progression & Skill Matrices
-- --------------------------------------------------------------------

DROP TABLE IF EXISTS user_progression;

CREATE TABLE user_progression (
    user_id TEXT PRIMARY KEY,
    
    -- Leveling & Badges
    current_level INTEGER DEFAULT 1,
    total_xp INTEGER DEFAULT 0,
    surgeon_badge_unlocked INTEGER DEFAULT 0,
    vector_lock_badge_unlocked INTEGER DEFAULT 0,
    vanguard_badge_unlocked INTEGER DEFAULT 0,
    
    -- Aggregated Performance Stats
    global_accuracy REAL DEFAULT 0.0,
    total_games INTEGER DEFAULT 0,
    time_played INTEGER DEFAULT 0,
    modes_data TEXT DEFAULT '{}',      -- JSON object mapping per-mode best scores
    playlists TEXT DEFAULT '[]',       -- JSON array storing user custom playlists
    miss_quadrants TEXT DEFAULT '{}',  -- JSON object storing cumulative miss counts
    
    -- XP Factor Breakdown (Radar Profiler Dimensions)
    xp_flicking INTEGER DEFAULT 0,
    xp_tracking INTEGER DEFAULT 0,
    xp_speed INTEGER DEFAULT 0,
    xp_precision INTEGER DEFAULT 0,
    xp_perception INTEGER DEFAULT 0,
    xp_cognition INTEGER DEFAULT 0,
    
    -- 4-Quadrant Miss Averages (Rolling Historical Matrix)
    top_left_misses REAL DEFAULT 0.0,
    top_right_misses REAL DEFAULT 0.0,
    bottom_left_misses REAL DEFAULT 0.0,
    bottom_right_misses REAL DEFAULT 0.0,
    quadrant_top_left REAL DEFAULT 0.0,
    quadrant_top_right REAL DEFAULT 0.0,
    quadrant_bottom_left REAL DEFAULT 0.0,
    quadrant_bottom_right REAL DEFAULT 0.0,

    last_played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- 3. Kinematic Telemetry & Session Log Entries
-- --------------------------------------------------------------------

DROP TABLE IF EXISTS scores_telemetry;

CREATE TABLE scores_telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    difficulty TEXT DEFAULT 'medium',
    username TEXT,
    ghost_telemetry TEXT,              -- Delta-compressed kinematic JSON stream
    hits INTEGER NOT NULL DEFAULT 0,
    misses INTEGER NOT NULL DEFAULT 0,
    accuracy REAL NOT NULL DEFAULT 0.0,
    max_combo INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    
    -- Anti-Cheat Integrity Triggers
    integrity_flag TEXT NOT NULL DEFAULT 'HIGH_INTEGRITY', -- HIGH_INTEGRITY | LOW_INTEGRITY
    is_flagged INTEGER NOT NULL DEFAULT 0,                 -- 0 = clean run, 1 = flagged for review
    flag_reason TEXT DEFAULT NULL,                         -- Anti-cheat trigger explanation
    
    -- Kinematic Analytics
    average_urgency_index REAL DEFAULT 1.0,
    over_flick_coefficient REAL DEFAULT 1.0,
    
    -- 4-Quadrant Miss Session Metrics
    top_left_misses REAL DEFAULT 0.0,
    top_right_misses REAL DEFAULT 0.0,
    bottom_left_misses REAL DEFAULT 0.0,
    bottom_right_misses REAL DEFAULT 0.0,
    miss_quadrants TEXT DEFAULT '{}',                      -- Session quadrant raw distribution JSON
    
    neural_stability_score REAL DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES user_progression(user_id) ON DELETE CASCADE
);

-- Alias view for drill_sessions backwards compatibility
DROP VIEW IF EXISTS drill_sessions;
CREATE VIEW drill_sessions AS SELECT * FROM scores_telemetry;

-- --------------------------------------------------------------------
-- 4. High-Performance Relational Indexes
-- --------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(userId);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId);
CREATE INDEX IF NOT EXISTS idx_scores_telemetry_user_id ON scores_telemetry(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_telemetry_created_at ON scores_telemetry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_telemetry_is_flagged ON scores_telemetry(is_flagged);
CREATE INDEX IF NOT EXISTS idx_scores_telemetry_exercise ON scores_telemetry(exercise_id);
CREATE INDEX IF NOT EXISTS idx_user_progression_level ON user_progression(current_level DESC);
CREATE INDEX IF NOT EXISTS idx_user_progression_xp ON user_progression(total_xp DESC);

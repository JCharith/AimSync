-- ====================================================================
-- AimSync Cloudflare D1 Relational Database Schema
-- Production-Ready Schema supporting Auth.js, Session Telemetry,
-- Rolling Skill Matrices, 4-Quadrant Miss Averages, & Anti-Cheat Triggers
--
-- Wrangler Deployment Command:
-- wrangler d1 execute aimsync-db --remote --file=./schema.sql
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Auth.js Core Authentication Tables (Discord OAuth)
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    emailVerified DATETIME,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
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

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    sessionToken TEXT UNIQUE NOT NULL,
    userId TEXT NOT NULL,
    expires DATETIME NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires DATETIME NOT NULL,
    PRIMARY KEY (identifier, token)
);

-- --------------------------------------------------------------------
-- 2. Radar Profiles & Rolling Skill Matrices
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS skill_matrices (
    user_id TEXT PRIMARY KEY,
    
    -- Radar Profiles & Key Skill Attributes
    accuracy REAL DEFAULT 0.0,
    flicking REAL DEFAULT 0.0,
    tracking REAL DEFAULT 0.0,
    reaction REAL DEFAULT 0.0,
    consistency REAL DEFAULT 0.0,
    spray_control REAL DEFAULT 0.0,

    -- Rolling 4-Quadrant Miss Tracking (Aggregated INTEGER Columns)
    miss_quadrant_top_left INTEGER DEFAULT 0,
    miss_quadrant_top_right INTEGER DEFAULT 0,
    miss_quadrant_bottom_left INTEGER DEFAULT 0,
    miss_quadrant_bottom_right INTEGER DEFAULT 0,

    -- Leveling & Progression Metrics
    current_level INTEGER DEFAULT 1,
    total_xp INTEGER DEFAULT 0,
    xp_flicking INTEGER DEFAULT 0,
    xp_tracking INTEGER DEFAULT 0,
    xp_speed INTEGER DEFAULT 0,
    xp_precision INTEGER DEFAULT 0,
    xp_perception INTEGER DEFAULT 0,
    xp_cognition INTEGER DEFAULT 0,

    -- Unlock Badges
    surgeon_badge_unlocked INTEGER DEFAULT 0,
    vector_lock_badge_unlocked INTEGER DEFAULT 0,
    vanguard_badge_unlocked INTEGER DEFAULT 0,

    -- Aggregated Session Totals
    total_games INTEGER DEFAULT 0,
    time_played INTEGER DEFAULT 0,
    modes_data TEXT DEFAULT '{}',
    playlists TEXT DEFAULT '[]',

    last_played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- 3. Session Performance & Telemetry Logs
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS session_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    difficulty TEXT DEFAULT 'medium',
    username TEXT,
    
    -- Performance Metrics
    score INTEGER NOT NULL DEFAULT 0,
    kps REAL NOT NULL DEFAULT 0.0,
    duration INTEGER NOT NULL DEFAULT 0,
    hits INTEGER NOT NULL DEFAULT 0,
    misses INTEGER NOT NULL DEFAULT 0,
    accuracy REAL NOT NULL DEFAULT 0.0,
    max_combo INTEGER NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0,

    -- Anti-Cheat Integrity Triggers
    is_flagged INTEGER NOT NULL DEFAULT 0,           -- 0 = clean run, 1 = flagged for review
    flag_reason TEXT DEFAULT NULL,                   -- Anti-cheat trigger explanation
    integrity_flag TEXT NOT NULL DEFAULT 'HIGH_INTEGRITY', -- HIGH_INTEGRITY | LOW_INTEGRITY

    -- Kinematic Analytics
    average_urgency_index REAL DEFAULT 1.0,
    over_flick_coefficient REAL DEFAULT 1.0,
    
    -- Session 4-Quadrant Miss Counts
    miss_quadrant_top_left INTEGER DEFAULT 0,
    miss_quadrant_top_right INTEGER DEFAULT 0,
    miss_quadrant_bottom_left INTEGER DEFAULT 0,
    miss_quadrant_bottom_right INTEGER DEFAULT 0,

    ghost_telemetry TEXT DEFAULT NULL,               -- Delta-compressed kinematic JSON stream
    neural_stability_score REAL DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES skill_matrices(user_id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- 4. Backward Compatibility Views
-- --------------------------------------------------------------------

DROP VIEW IF EXISTS user_progression;
CREATE VIEW user_progression AS 
SELECT 
    user_id,
    current_level,
    total_xp,
    surgeon_badge_unlocked,
    vector_lock_badge_unlocked,
    vanguard_badge_unlocked,
    accuracy AS global_accuracy,
    total_games,
    time_played,
    modes_data,
    playlists,
    xp_flicking,
    xp_tracking,
    xp_speed,
    xp_precision,
    xp_perception,
    xp_cognition,
    miss_quadrant_top_left AS top_left_misses,
    miss_quadrant_top_right AS top_right_misses,
    miss_quadrant_bottom_left AS bottom_left_misses,
    miss_quadrant_bottom_right AS bottom_right_misses,
    miss_quadrant_top_left AS quadrant_top_left,
    miss_quadrant_top_right AS quadrant_top_right,
    miss_quadrant_bottom_left AS quadrant_bottom_left,
    miss_quadrant_bottom_right AS quadrant_bottom_right,
    last_played_at,
    updated_at
FROM skill_matrices;

DROP VIEW IF EXISTS scores_telemetry;
CREATE VIEW scores_telemetry AS
SELECT
    id,
    user_id,
    exercise_id,
    difficulty,
    username,
    ghost_telemetry,
    hits,
    misses,
    accuracy,
    max_combo,
    duration AS duration_seconds,
    score,
    kps,
    xp_earned,
    integrity_flag,
    is_flagged,
    is_flagged AS flagged,
    flag_reason,
    average_urgency_index,
    over_flick_coefficient,
    miss_quadrant_top_left AS top_left_misses,
    miss_quadrant_top_right AS top_right_misses,
    miss_quadrant_bottom_left AS bottom_left_misses,
    miss_quadrant_bottom_right AS bottom_right_misses,
    neural_stability_score,
    created_at
FROM session_logs;

DROP VIEW IF EXISTS drill_sessions;
CREATE VIEW drill_sessions AS SELECT * FROM session_logs;

-- --------------------------------------------------------------------
-- 5. High-Performance Relational Indexes
-- --------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(userId);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId);
CREATE INDEX IF NOT EXISTS idx_session_logs_user_id ON session_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_created_at ON session_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_logs_is_flagged ON session_logs(is_flagged);
CREATE INDEX IF NOT EXISTS idx_session_logs_exercise ON session_logs(exercise_id);
CREATE INDEX IF NOT EXISTS idx_skill_matrices_level ON skill_matrices(current_level DESC);
CREATE INDEX IF NOT EXISTS idx_skill_matrices_xp ON skill_matrices(total_xp DESC);

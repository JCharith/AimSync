-- ====================================================================
-- AimSync Cloudflare D1 Relational Database Schema
-- Production-Ready Schema supporting Auth.js, Session Telemetry,
-- Rolling Skill Matrices, 4-Quadrant Miss Averages, & Anti-Cheat Triggers
-- ====================================================================

PRAGMA foreign_keys = ON;

-- --------------------------------------------------------------------
-- Clean Drop Section (Correct Object Types & Cascade Order)
-- --------------------------------------------------------------------
DROP VIEW IF EXISTS drill_sessions;
DROP VIEW IF EXISTS user_stats_view;

DROP TABLE IF EXISTS session_logs;
DROP TABLE IF EXISTS user_progression;
DROP TABLE IF EXISTS verification_tokens;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS users;

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
    token TEXT NOT NULL UNIQUE,
    expires DATETIME NOT NULL,
    PRIMARY KEY (identifier, token)
);

-- --------------------------------------------------------------------
-- 2. User Progression & Skill Matrix Table
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_progression (
    user_id TEXT PRIMARY KEY,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    flick_xp INTEGER DEFAULT 0,
    tracking_xp INTEGER DEFAULT 0,
    precision_xp INTEGER DEFAULT 0,
    speed_xp INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- 3. Telemetry Session Logs & Anti-Cheat Metrics Table
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS session_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    mode_id TEXT,
    difficulty TEXT DEFAULT 'STANDARD',
    username TEXT,
    score INTEGER NOT NULL,
    hits INTEGER NOT NULL,
    misses INTEGER NOT NULL,
    accuracy REAL NOT NULL,
    max_combo INTEGER DEFAULT 0,
    duration INTEGER NOT NULL,
    kps REAL DEFAULT 0.0,
    xp_earned INTEGER DEFAULT 0,
    ghost_telemetry TEXT,
    integrity_flag INTEGER DEFAULT 1,
    is_flagged INTEGER DEFAULT 0,
    flag_reason TEXT,
    average_urgency_index REAL DEFAULT 0.0,
    over_flick_coefficient REAL DEFAULT 0.0,
    miss_quadrant_top_left INTEGER DEFAULT 0,
    miss_quadrant_top_right INTEGER DEFAULT 0,
    miss_quadrant_bottom_left INTEGER DEFAULT 0,
    miss_quadrant_bottom_right INTEGER DEFAULT 0,
    neural_stability_score REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- 4. Views
-- --------------------------------------------------------------------

CREATE VIEW IF NOT EXISTS drill_sessions AS 
SELECT 
    id,
    user_id,
    exercise_id,
    mode_id,
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

-- --------------------------------------------------------------------
-- 5. Relational Indexes
-- --------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(userId);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId);
CREATE INDEX IF NOT EXISTS idx_session_logs_user_id ON session_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_created_at ON session_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_logs_is_flagged ON session_logs(is_flagged);
CREATE INDEX IF NOT EXISTS idx_session_logs_exercise ON session_logs(exercise_id);wr
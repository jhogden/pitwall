-- ============================================================================
-- V1__initial_schema.sql
-- Pitwall Motorsport App - Initial Database Schema
-- ============================================================================

-- ---------------------------------------------------------------------------
-- series
-- ---------------------------------------------------------------------------
CREATE TABLE series (
    id              BIGSERIAL       PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    slug            VARCHAR(50)     NOT NULL UNIQUE,
    color_primary   VARCHAR(7)      NOT NULL,
    color_secondary VARCHAR(7)      NOT NULL,
    logo_url        TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- seasons
-- ---------------------------------------------------------------------------
CREATE TABLE seasons (
    id          BIGSERIAL       PRIMARY KEY,
    series_id   BIGINT          NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    year        INT             NOT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),

    UNIQUE (series_id, year)
);

CREATE INDEX idx_seasons_series_id ON seasons(series_id);

-- ---------------------------------------------------------------------------
-- circuits
-- ---------------------------------------------------------------------------
CREATE TABLE circuits (
    id              BIGSERIAL       PRIMARY KEY,
    name            VARCHAR(200)    NOT NULL,
    country         VARCHAR(100)    NOT NULL,
    city            VARCHAR(100)    NOT NULL,
    track_map_url   TEXT,
    timezone        VARCHAR(50)     NOT NULL
);

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
CREATE TABLE events (
    id          BIGSERIAL       PRIMARY KEY,
    season_id   BIGINT          NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    circuit_id  BIGINT          NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
    name        VARCHAR(200)    NOT NULL,
    slug        VARCHAR(100)    NOT NULL UNIQUE,
    start_date  DATE            NOT NULL,
    end_date    DATE            NOT NULL,
    status      VARCHAR(20)     NOT NULL DEFAULT 'upcoming'
                    CHECK (status IN ('upcoming', 'live', 'completed')),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_season_id  ON events(season_id);
CREATE INDEX idx_events_circuit_id ON events(circuit_id);
CREATE INDEX idx_events_status     ON events(status);
CREATE INDEX idx_events_slug       ON events(slug);

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
CREATE TABLE sessions (
    id          BIGSERIAL       PRIMARY KEY,
    event_id    BIGINT          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    type        VARCHAR(30)     NOT NULL
                    CHECK (type IN ('practice', 'qualifying', 'race', 'sprint')),
    name        VARCHAR(100)    NOT NULL,
    start_time  TIMESTAMPTZ     NOT NULL,
    end_time    TIMESTAMPTZ,
    status      VARCHAR(20)     NOT NULL DEFAULT 'scheduled'
);

CREATE INDEX idx_sessions_event_id ON sessions(event_id);
CREATE INDEX idx_sessions_status   ON sessions(status);

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
CREATE TABLE teams (
    id          BIGSERIAL       PRIMARY KEY,
    series_id   BIGINT          NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    name        VARCHAR(200)    NOT NULL,
    short_name  VARCHAR(50)     NOT NULL,
    color       VARCHAR(7)      NOT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_series_id ON teams(series_id);

-- ---------------------------------------------------------------------------
-- drivers
-- ---------------------------------------------------------------------------
CREATE TABLE drivers (
    id          BIGSERIAL       PRIMARY KEY,
    name        VARCHAR(200)    NOT NULL,
    number      INT,
    team_id     BIGINT          REFERENCES teams(id) ON DELETE SET NULL,
    nationality VARCHAR(100),
    slug        VARCHAR(100)    NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_drivers_team_id ON drivers(team_id);
CREATE INDEX idx_drivers_slug    ON drivers(slug);

-- ---------------------------------------------------------------------------
-- results
-- ---------------------------------------------------------------------------
CREATE TABLE results (
    id          BIGSERIAL       PRIMARY KEY,
    session_id  BIGINT          NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    driver_id   BIGINT          NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    position    INT             NOT NULL,
    time        VARCHAR(50),
    laps        INT,
    gap         VARCHAR(50),
    status      VARCHAR(50)     NOT NULL DEFAULT 'finished',
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_results_session_id ON results(session_id);
CREATE INDEX idx_results_driver_id  ON results(driver_id);

-- ---------------------------------------------------------------------------
-- feed_items
-- ---------------------------------------------------------------------------
CREATE TABLE feed_items (
    id              BIGSERIAL       PRIMARY KEY,
    type            VARCHAR(30)     NOT NULL
                        CHECK (type IN ('race_result', 'preview', 'analysis', 'highlight')),
    series_id       BIGINT          REFERENCES series(id) ON DELETE SET NULL,
    event_id        BIGINT          REFERENCES events(id) ON DELETE SET NULL,
    title           VARCHAR(500)    NOT NULL,
    summary         TEXT            NOT NULL,
    content_url     TEXT,
    thumbnail_url   TEXT,
    published_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_items_series_id    ON feed_items(series_id);
CREATE INDEX idx_feed_items_event_id     ON feed_items(event_id);
CREATE INDEX idx_feed_items_published_at ON feed_items(published_at DESC);
CREATE INDEX idx_feed_items_type         ON feed_items(type);

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id              BIGSERIAL       PRIMARY KEY,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    display_name    VARCHAR(100)    NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- user_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE user_preferences (
    id                  BIGSERIAL   PRIMARY KEY,
    user_id             BIGINT      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    followed_series     JSONB       NOT NULL DEFAULT '[]'::jsonb,
    followed_teams      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    followed_drivers    JSONB       NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

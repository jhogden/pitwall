-- ---------------------------------------------------------------------------
-- driver_standings
-- ---------------------------------------------------------------------------
CREATE TABLE driver_standings (
    id          BIGSERIAL       PRIMARY KEY,
    season_id   BIGINT          NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    driver_id   BIGINT          NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    position    INT             NOT NULL,
    points      DECIMAL(8,2)    NOT NULL DEFAULT 0,
    wins        INT             NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),

    UNIQUE (season_id, driver_id)
);

CREATE INDEX idx_driver_standings_season_id ON driver_standings(season_id);
CREATE INDEX idx_driver_standings_driver_id ON driver_standings(driver_id);

-- ---------------------------------------------------------------------------
-- constructor_standings
-- ---------------------------------------------------------------------------
CREATE TABLE constructor_standings (
    id          BIGSERIAL       PRIMARY KEY,
    season_id   BIGINT          NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    team_id     BIGINT          NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    position    INT             NOT NULL,
    points      DECIMAL(8,2)    NOT NULL DEFAULT 0,
    wins        INT             NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),

    UNIQUE (season_id, team_id)
);

CREATE INDEX idx_constructor_standings_season_id ON constructor_standings(season_id);
CREATE INDEX idx_constructor_standings_team_id ON constructor_standings(team_id);

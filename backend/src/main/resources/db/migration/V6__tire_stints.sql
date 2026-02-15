CREATE TABLE IF NOT EXISTS tire_stints (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    driver_id BIGINT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    stint_number INTEGER NOT NULL,
    compound VARCHAR(50),
    lap_start INTEGER NOT NULL,
    lap_end INTEGER NOT NULL,
    tyre_age_at_start INTEGER,
    is_new_tyre BOOLEAN,
    source VARCHAR(30),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_tire_stints_session_driver_stint UNIQUE (session_id, driver_id, stint_number)
);

CREATE INDEX IF NOT EXISTS idx_tire_stints_session_id ON tire_stints(session_id);
CREATE INDEX IF NOT EXISTS idx_tire_stints_driver_id ON tire_stints(driver_id);

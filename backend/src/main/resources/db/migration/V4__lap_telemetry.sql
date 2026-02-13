CREATE TABLE IF NOT EXISTS lap_telemetry (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    driver_id BIGINT REFERENCES drivers(id) ON DELETE SET NULL,
    car_number VARCHAR(16) NOT NULL,
    lap_number INT NOT NULL,
    position INT,
    lap_time VARCHAR(20),
    sector1_time VARCHAR(20),
    sector2_time VARCHAR(20),
    sector3_time VARCHAR(20),
    sector4_time VARCHAR(20),
    average_speed_kph VARCHAR(20),
    top_speed_kph VARCHAR(20),
    session_elapsed VARCHAR(20),
    lap_timestamp TIMESTAMPTZ,
    is_valid BOOLEAN,
    crossing_pit_finish_lane BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_lap_telemetry_session_car_lap UNIQUE (session_id, car_number, lap_number)
);

CREATE INDEX IF NOT EXISTS idx_lap_telemetry_session_id ON lap_telemetry(session_id);
CREATE INDEX IF NOT EXISTS idx_lap_telemetry_driver_id ON lap_telemetry(driver_id);

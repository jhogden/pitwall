-- ---------------------------------------------------------------------------
-- Add class/category dimension for multi-class racing series (IMSA/WEC)
-- ---------------------------------------------------------------------------

ALTER TABLE results
    ADD COLUMN IF NOT EXISTS class_name VARCHAR(100) NOT NULL DEFAULT 'Overall';

CREATE INDEX IF NOT EXISTS idx_results_session_class_name
    ON results(session_id, class_name);

ALTER TABLE results
    DROP CONSTRAINT IF EXISTS uq_results_session_driver;

-- Deduplicate legacy rows before enforcing new composite uniqueness.
DELETE FROM results r
USING (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY session_id, driver_id, class_name
                   ORDER BY id
               ) AS rn
        FROM results
    ) ranked
    WHERE rn > 1
) dupes
WHERE r.id = dupes.id;

ALTER TABLE results
    ADD CONSTRAINT uq_results_session_driver_class_name
    UNIQUE (session_id, driver_id, class_name);

ALTER TABLE driver_standings
    ADD COLUMN IF NOT EXISTS class_name VARCHAR(100) NOT NULL DEFAULT 'Overall';

CREATE INDEX IF NOT EXISTS idx_driver_standings_season_class_name
    ON driver_standings(season_id, class_name);

ALTER TABLE driver_standings
    DROP CONSTRAINT IF EXISTS driver_standings_season_id_driver_id_key;

DELETE FROM driver_standings ds
USING (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY season_id, driver_id, class_name
                   ORDER BY id
               ) AS rn
        FROM driver_standings
    ) ranked
    WHERE rn > 1
) dupes
WHERE ds.id = dupes.id;

ALTER TABLE driver_standings
    ADD CONSTRAINT driver_standings_season_driver_class_key
    UNIQUE (season_id, driver_id, class_name);

ALTER TABLE constructor_standings
    ADD COLUMN IF NOT EXISTS class_name VARCHAR(100) NOT NULL DEFAULT 'Overall';

CREATE INDEX IF NOT EXISTS idx_constructor_standings_season_class_name
    ON constructor_standings(season_id, class_name);

ALTER TABLE constructor_standings
    DROP CONSTRAINT IF EXISTS constructor_standings_season_id_team_id_key;

DELETE FROM constructor_standings cs
USING (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY season_id, team_id, class_name
                   ORDER BY id
               ) AS rn
        FROM constructor_standings
    ) ranked
    WHERE rn > 1
) dupes
WHERE cs.id = dupes.id;

ALTER TABLE constructor_standings
    ADD CONSTRAINT constructor_standings_season_team_class_key
    UNIQUE (season_id, team_id, class_name);

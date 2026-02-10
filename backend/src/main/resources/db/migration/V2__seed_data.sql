-- ============================================================================
-- V2__seed_data.sql
-- Pitwall Motorsport App - Seed Data
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Series
-- ---------------------------------------------------------------------------
INSERT INTO series (name, slug, color_primary, color_secondary) VALUES
    ('Formula 1',                       'f1',   '#E10600', '#FFFFFF'),
    ('World Endurance Championship',    'wec',  '#00548F', '#FFFFFF'),
    ('IMSA SportsCar Championship',     'imsa', '#DA291C', '#1E1E1E');

-- ---------------------------------------------------------------------------
-- 2025 Seasons
-- ---------------------------------------------------------------------------
INSERT INTO seasons (series_id, year) VALUES
    ((SELECT id FROM series WHERE slug = 'f1'),   2025),
    ((SELECT id FROM series WHERE slug = 'wec'),  2025),
    ((SELECT id FROM series WHERE slug = 'imsa'), 2025);

-- ---------------------------------------------------------------------------
-- Circuits
-- ---------------------------------------------------------------------------
INSERT INTO circuits (name, country, city, track_map_url, timezone) VALUES
    ('Bahrain International Circuit',       'Bahrain',      'Sakhir',       NULL, 'Asia/Bahrain'),
    ('Circuit de Monaco',                   'Monaco',       'Monte Carlo',  NULL, 'Europe/Monaco'),
    ('Circuit de la Sarthe',                'France',       'Le Mans',      NULL, 'Europe/Paris'),
    ('Circuit de Spa-Francorchamps',        'Belgium',      'Stavelot',     NULL, 'Europe/Brussels'),
    ('Daytona International Speedway',      'United States','Daytona Beach',NULL, 'America/New_York');

-- ---------------------------------------------------------------------------
-- F1 2025 Events (sample)
-- ---------------------------------------------------------------------------
INSERT INTO events (season_id, circuit_id, name, slug, start_date, end_date, status) VALUES
    (
        (SELECT id FROM seasons WHERE series_id = (SELECT id FROM series WHERE slug = 'f1') AND year = 2025),
        (SELECT id FROM circuits WHERE name = 'Bahrain International Circuit'),
        'Bahrain Grand Prix 2025',
        'f1-2025-bahrain-gp',
        '2025-03-14',
        '2025-03-16',
        'completed'
    ),
    (
        (SELECT id FROM seasons WHERE series_id = (SELECT id FROM series WHERE slug = 'f1') AND year = 2025),
        (SELECT id FROM circuits WHERE name = 'Circuit de Monaco'),
        'Monaco Grand Prix 2025',
        'f1-2025-monaco-gp',
        '2025-05-23',
        '2025-05-25',
        'upcoming'
    ),
    (
        (SELECT id FROM seasons WHERE series_id = (SELECT id FROM series WHERE slug = 'f1') AND year = 2025),
        (SELECT id FROM circuits WHERE name = 'Circuit de Spa-Francorchamps'),
        'Belgian Grand Prix 2025',
        'f1-2025-belgian-gp',
        '2025-07-25',
        '2025-07-27',
        'upcoming'
    );

-- ---------------------------------------------------------------------------
-- WEC 2025 Events (sample)
-- ---------------------------------------------------------------------------
INSERT INTO events (season_id, circuit_id, name, slug, start_date, end_date, status) VALUES
    (
        (SELECT id FROM seasons WHERE series_id = (SELECT id FROM series WHERE slug = 'wec') AND year = 2025),
        (SELECT id FROM circuits WHERE name = 'Circuit de la Sarthe'),
        '24 Hours of Le Mans 2025',
        'wec-2025-le-mans',
        '2025-06-14',
        '2025-06-15',
        'upcoming'
    ),
    (
        (SELECT id FROM seasons WHERE series_id = (SELECT id FROM series WHERE slug = 'wec') AND year = 2025),
        (SELECT id FROM circuits WHERE name = 'Circuit de Spa-Francorchamps'),
        '6 Hours of Spa 2025',
        'wec-2025-spa',
        '2025-04-26',
        '2025-04-26',
        'upcoming'
    );

-- ---------------------------------------------------------------------------
-- F1 2025 Teams (sample)
-- ---------------------------------------------------------------------------
INSERT INTO teams (series_id, name, short_name, color) VALUES
    ((SELECT id FROM series WHERE slug = 'f1'), 'Oracle Red Bull Racing',       'Red Bull',     '#3671C6'),
    ((SELECT id FROM series WHERE slug = 'f1'), 'Scuderia Ferrari',             'Ferrari',      '#E8002D'),
    ((SELECT id FROM series WHERE slug = 'f1'), 'Mercedes-AMG Petronas F1',     'Mercedes',     '#27F4D2'),
    ((SELECT id FROM series WHERE slug = 'f1'), 'McLaren F1 Team',              'McLaren',      '#FF8000'),
    ((SELECT id FROM series WHERE slug = 'f1'), 'Aston Martin Aramco F1 Team',  'Aston Martin', '#229971');

-- ---------------------------------------------------------------------------
-- F1 2025 Drivers (sample)
-- ---------------------------------------------------------------------------
INSERT INTO drivers (name, number, team_id, nationality, slug) VALUES
    ('Max Verstappen',      1,  (SELECT id FROM teams WHERE short_name = 'Red Bull'     LIMIT 1), 'Dutch',        'max-verstappen'),
    ('Liam Lawson',         30, (SELECT id FROM teams WHERE short_name = 'Red Bull'     LIMIT 1), 'New Zealander','liam-lawson'),
    ('Charles Leclerc',     16, (SELECT id FROM teams WHERE short_name = 'Ferrari'      LIMIT 1), 'Monegasque',   'charles-leclerc'),
    ('Lewis Hamilton',      44, (SELECT id FROM teams WHERE short_name = 'Ferrari'      LIMIT 1), 'British',      'lewis-hamilton'),
    ('George Russell',      63, (SELECT id FROM teams WHERE short_name = 'Mercedes'     LIMIT 1), 'British',      'george-russell'),
    ('Andrea Kimi Antonelli', 12, (SELECT id FROM teams WHERE short_name = 'Mercedes'   LIMIT 1), 'Italian',      'kimi-antonelli'),
    ('Lando Norris',        4,  (SELECT id FROM teams WHERE short_name = 'McLaren'      LIMIT 1), 'British',      'lando-norris'),
    ('Oscar Piastri',       81, (SELECT id FROM teams WHERE short_name = 'McLaren'      LIMIT 1), 'Australian',   'oscar-piastri'),
    ('Fernando Alonso',     14, (SELECT id FROM teams WHERE short_name = 'Aston Martin' LIMIT 1), 'Spanish',      'fernando-alonso'),
    ('Lance Stroll',        18, (SELECT id FROM teams WHERE short_name = 'Aston Martin' LIMIT 1), 'Canadian',     'lance-stroll');

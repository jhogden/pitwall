package com.pitwall.service;

import com.pitwall.dto.DataCoverageDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class DataCoverageService {

    private final JdbcTemplate jdbcTemplate;

    public DataCoverageService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<DataCoverageDto> getCoverage(String seriesSlug, Integer year) {
        String sql = """
                WITH season_base AS (
                    SELECT
                        s.id AS season_id,
                        s.year AS year,
                        ser.slug AS series_slug,
                        ser.name AS series_name
                    FROM seasons s
                    JOIN series ser ON ser.id = s.series_id
                ),
                event_counts AS (
                    SELECT
                        e.season_id,
                        COUNT(*)::int AS event_count,
                        COUNT(*) FILTER (
                            WHERE c.track_map_url IS NOT NULL
                              AND btrim(c.track_map_url) <> ''
                        )::int AS events_with_track_map
                    FROM events e
                    LEFT JOIN circuits c ON c.id = e.circuit_id
                    GROUP BY e.season_id
                ),
                session_counts AS (
                    SELECT
                        e.season_id,
                        COUNT(*)::int AS session_count,
                        COUNT(*) FILTER (
                            WHERE lower(COALESCE(s.type, '')) IN ('race', 'sprint')
                        )::int AS race_session_count
                    FROM sessions s
                    JOIN events e ON e.id = s.event_id
                    GROUP BY e.season_id
                ),
                result_sessions AS (
                    SELECT
                        e.season_id,
                        COUNT(DISTINCT r.session_id)::int AS sessions_with_results
                    FROM results r
                    JOIN sessions s ON s.id = r.session_id
                    JOIN events e ON e.id = s.event_id
                    WHERE lower(COALESCE(s.type, '')) IN ('race', 'sprint')
                    GROUP BY e.season_id
                ),
                telemetry_sessions AS (
                    SELECT
                        e.season_id,
                        COUNT(DISTINCT lt.session_id)::int AS sessions_with_telemetry
                    FROM lap_telemetry lt
                    JOIN sessions s ON s.id = lt.session_id
                    JOIN events e ON e.id = s.event_id
                    WHERE lower(COALESCE(s.type, '')) IN ('race', 'sprint')
                    GROUP BY e.season_id
                ),
                tire_sessions AS (
                    SELECT
                        e.season_id,
                        COUNT(DISTINCT ts.session_id)::int AS sessions_with_tire_stints
                    FROM tire_stints ts
                    JOIN sessions s ON s.id = ts.session_id
                    JOIN events e ON e.id = s.event_id
                    WHERE lower(COALESCE(s.type, '')) IN ('race', 'sprint')
                    GROUP BY e.season_id
                ),
                standings_counts AS (
                    SELECT
                        sb.season_id,
                        COALESCE(ds.driver_standings_count, 0)::int AS driver_standings_count,
                        COALESCE(cs.constructor_standings_count, 0)::int AS constructor_standings_count
                    FROM season_base sb
                    LEFT JOIN (
                        SELECT season_id, COUNT(*)::int AS driver_standings_count
                        FROM driver_standings
                        GROUP BY season_id
                    ) ds ON ds.season_id = sb.season_id
                    LEFT JOIN (
                        SELECT season_id, COUNT(*)::int AS constructor_standings_count
                        FROM constructor_standings
                        GROUP BY season_id
                    ) cs ON cs.season_id = sb.season_id
                )
                SELECT
                    sb.series_slug,
                    sb.series_name,
                    sb.year,
                    COALESCE(ec.event_count, 0) AS event_count,
                    COALESCE(ec.events_with_track_map, 0) AS events_with_track_map,
                    COALESCE(sc.session_count, 0) AS session_count,
                    COALESCE(sc.race_session_count, 0) AS race_session_count,
                    COALESCE(rs.sessions_with_results, 0) AS sessions_with_results,
                    COALESCE(ts.sessions_with_telemetry, 0) AS sessions_with_telemetry,
                    COALESCE(tis.sessions_with_tire_stints, 0) AS sessions_with_tire_stints,
                    COALESCE(st.driver_standings_count, 0) AS driver_standings_count,
                    COALESCE(st.constructor_standings_count, 0) AS constructor_standings_count
                FROM season_base sb
                LEFT JOIN event_counts ec ON ec.season_id = sb.season_id
                LEFT JOIN session_counts sc ON sc.season_id = sb.season_id
                LEFT JOIN result_sessions rs ON rs.season_id = sb.season_id
                LEFT JOIN telemetry_sessions ts ON ts.season_id = sb.season_id
                LEFT JOIN tire_sessions tis ON tis.season_id = sb.season_id
                LEFT JOIN standings_counts st ON st.season_id = sb.season_id
                WHERE (?::text IS NULL OR sb.series_slug = ?::text)
                  AND (?::int IS NULL OR sb.year = ?::int)
                ORDER BY sb.year DESC, sb.series_slug ASC
                """;

        return jdbcTemplate.query(
                sql,
                ps -> {
                    ps.setObject(1, seriesSlug);
                    ps.setObject(2, seriesSlug);
                    ps.setObject(3, year);
                    ps.setObject(4, year);
                },
                (rs, rowNum) -> {
                    int eventCount = rs.getInt("event_count");
                    int eventsWithTrackMap = rs.getInt("events_with_track_map");
                    int raceSessionCount = rs.getInt("race_session_count");
                    int sessionsWithResults = rs.getInt("sessions_with_results");
                    int sessionsWithTelemetry = rs.getInt("sessions_with_telemetry");
                    int sessionsWithTireStints = rs.getInt("sessions_with_tire_stints");
                    int driverStandingsCount = rs.getInt("driver_standings_count");
                    int constructorStandingsCount = rs.getInt("constructor_standings_count");

                    int trackMapCoveragePct = percent(eventsWithTrackMap, eventCount);
                    int resultsCoveragePct = percent(sessionsWithResults, raceSessionCount);
                    int telemetryCoveragePct = percent(sessionsWithTelemetry, raceSessionCount);
                    int tireCoveragePct = percent(sessionsWithTireStints, raceSessionCount);
                    int standingsCoveragePct = percent(
                            (driverStandingsCount > 0 ? 1 : 0) + (constructorStandingsCount > 0 ? 1 : 0),
                            2
                    );

                    return new DataCoverageDto(
                            rs.getString("series_slug"),
                            rs.getString("series_name"),
                            rs.getInt("year"),
                            eventCount,
                            eventsWithTrackMap,
                            trackMapCoveragePct,
                            rs.getInt("session_count"),
                            raceSessionCount,
                            sessionsWithResults,
                            resultsCoveragePct,
                            sessionsWithTelemetry,
                            telemetryCoveragePct,
                            sessionsWithTireStints,
                            tireCoveragePct,
                            driverStandingsCount,
                            constructorStandingsCount,
                            standingsCoveragePct
                    );
                }
        );
    }

    private int percent(int numerator, int denominator) {
        if (denominator <= 0 || numerator <= 0) return 0;
        double pct = (numerator * 100.0) / denominator;
        return (int) Math.round(pct);
    }
}

package com.pitwall.dto;

public record DataCoverageDto(
        String seriesSlug,
        String seriesName,
        int year,
        int eventCount,
        int eventsWithTrackMap,
        int trackMapCoveragePct,
        int sessionCount,
        int raceSessionCount,
        int sessionsWithResults,
        int resultsCoveragePct,
        int sessionsWithTelemetry,
        int telemetryCoveragePct,
        int sessionsWithTireStints,
        int tireCoveragePct,
        int driverStandingsCount,
        int constructorStandingsCount,
        int standingsCoveragePct
) {
}

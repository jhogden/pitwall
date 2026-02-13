package com.pitwall.dto;

import java.time.Instant;

public record LapTelemetryDto(
        Long id,
        Integer lapNumber,
        Integer position,
        String carNumber,
        String driverName,
        Integer driverNumber,
        String teamName,
        String teamColor,
        String lapTime,
        String sector1Time,
        String sector2Time,
        String sector3Time,
        String sector4Time,
        String averageSpeedKph,
        String topSpeedKph,
        String sessionElapsed,
        Instant lapTimestamp,
        Boolean isValid,
        Boolean crossingPitFinishLane
) {
}

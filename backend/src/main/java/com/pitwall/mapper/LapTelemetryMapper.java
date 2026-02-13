package com.pitwall.mapper;

import com.pitwall.dto.LapTelemetryDto;
import com.pitwall.model.Driver;
import com.pitwall.model.LapTelemetry;
import com.pitwall.model.Team;
import org.springframework.stereotype.Component;

@Component
public class LapTelemetryMapper {

    public LapTelemetryDto toDto(LapTelemetry telemetry) {
        Driver driver = telemetry.getDriver();
        Team team = driver != null ? driver.getTeam() : null;

        return new LapTelemetryDto(
                telemetry.getId(),
                telemetry.getLapNumber(),
                telemetry.getPosition(),
                telemetry.getCarNumber(),
                driver != null ? driver.getName() : null,
                driver != null ? driver.getNumber() : null,
                team != null ? team.getName() : null,
                team != null ? team.getColor() : null,
                telemetry.getLapTime(),
                telemetry.getSector1Time(),
                telemetry.getSector2Time(),
                telemetry.getSector3Time(),
                telemetry.getSector4Time(),
                telemetry.getAverageSpeedKph(),
                telemetry.getTopSpeedKph(),
                telemetry.getSessionElapsed(),
                telemetry.getLapTimestamp(),
                telemetry.getIsValid(),
                telemetry.getCrossingPitFinishLane()
        );
    }
}

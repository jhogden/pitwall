package com.pitwall.dto;

public record ResultDto(
        Long id,
        Integer position,
        String driverName,
        Integer driverNumber,
        String teamName,
        String teamColor,
        String time,
        Integer laps,
        String gap,
        String status
) {
}

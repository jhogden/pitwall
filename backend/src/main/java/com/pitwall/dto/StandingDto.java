package com.pitwall.dto;

public record StandingDto(
        Integer position,
        String driverName,
        Integer driverNumber,
        String teamName,
        String teamColor,
        double points
) {
}

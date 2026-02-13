package com.pitwall.dto;

public record StandingDto(
        Integer position,
        String driverName,
        String driverSlug,
        Integer driverNumber,
        String teamName,
        String teamColor,
        String className,
        double points,
        int wins
) {
    public StandingDto(
            Integer position,
            String driverName,
            String driverSlug,
            Integer driverNumber,
            String teamName,
            String teamColor,
            double points,
            int wins
    ) {
        this(position, driverName, driverSlug, driverNumber, teamName, teamColor, "Overall", points, wins);
    }
}

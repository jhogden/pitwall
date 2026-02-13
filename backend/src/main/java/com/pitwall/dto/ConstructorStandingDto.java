package com.pitwall.dto;

public record ConstructorStandingDto(
        Integer position,
        String teamName,
        String teamColor,
        String className,
        double points,
        int wins
) {
    public ConstructorStandingDto(
            Integer position,
            String teamName,
            String teamColor,
            double points,
            int wins
    ) {
        this(position, teamName, teamColor, "Overall", points, wins);
    }
}

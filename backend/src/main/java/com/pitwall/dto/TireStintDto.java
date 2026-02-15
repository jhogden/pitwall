package com.pitwall.dto;

public record TireStintDto(
        Long id,
        Integer stintNumber,
        String compound,
        Integer lapStart,
        Integer lapEnd,
        Integer tyreAgeAtStart,
        Boolean isNewTyre,
        String source,
        String driverName,
        Integer driverNumber,
        String teamName,
        String teamColor
) {
}

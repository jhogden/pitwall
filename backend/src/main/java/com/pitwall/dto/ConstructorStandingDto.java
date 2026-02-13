package com.pitwall.dto;

public record ConstructorStandingDto(
        Integer position,
        String teamName,
        String teamColor,
        double points,
        int wins
) {
}

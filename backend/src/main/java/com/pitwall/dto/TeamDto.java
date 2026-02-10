package com.pitwall.dto;

public record TeamDto(
        Long id,
        String name,
        String shortName,
        String color,
        String seriesSlug
) {
}

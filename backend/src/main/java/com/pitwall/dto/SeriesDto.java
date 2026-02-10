package com.pitwall.dto;

public record SeriesDto(
        Long id,
        String name,
        String slug,
        String colorPrimary,
        String colorSecondary,
        String logoUrl
) {
}

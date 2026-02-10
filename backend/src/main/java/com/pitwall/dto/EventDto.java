package com.pitwall.dto;

import java.time.LocalDate;

public record EventDto(
        Long id,
        String name,
        String slug,
        String seriesSlug,
        String seriesName,
        String seriesColor,
        String circuitName,
        String country,
        String city,
        LocalDate startDate,
        LocalDate endDate,
        String status
) {
}

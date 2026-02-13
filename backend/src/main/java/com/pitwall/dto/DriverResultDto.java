package com.pitwall.dto;

import java.time.LocalDate;

public record DriverResultDto(
        String eventName,
        String eventSlug,
        String seriesSlug,
        LocalDate date,
        int position,
        String gap,
        String status,
        int year
) {
}

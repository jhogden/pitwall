package com.pitwall.dto;

import java.time.LocalDate;
import java.util.List;

public record EventDetailDto(
        Long id,
        String name,
        String slug,
        SeriesDto series,
        CircuitDto circuit,
        LocalDate startDate,
        LocalDate endDate,
        String status,
        List<SessionDto> sessions
) {
}

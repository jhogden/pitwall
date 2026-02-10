package com.pitwall.dto;

import java.time.Instant;

public record SessionDto(
        Long id,
        String type,
        String name,
        Instant startTime,
        Instant endTime,
        String status
) {
}

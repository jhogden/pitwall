package com.pitwall.dto;

public record CircuitDto(
        Long id,
        String name,
        String country,
        String city,
        String trackMapUrl,
        String timezone
) {
}

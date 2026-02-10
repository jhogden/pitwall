package com.pitwall.dto;

public record DriverDto(
        Long id,
        String name,
        Integer number,
        String teamName,
        String teamColor,
        String nationality,
        String slug
) {
}

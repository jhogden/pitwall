package com.pitwall.dto;

import java.util.List;

public record UserPreferenceDto(
        List<String> followedSeries,
        List<String> followedTeams,
        List<String> followedDrivers
) {
}

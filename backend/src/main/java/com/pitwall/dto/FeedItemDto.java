package com.pitwall.dto;

import java.time.Instant;

public record FeedItemDto(
        Long id,
        String type,
        String seriesSlug,
        String seriesName,
        String seriesColor,
        Long eventId,
        String eventSlug,
        String title,
        String summary,
        String contentUrl,
        String thumbnailUrl,
        Instant publishedAt
) {
}

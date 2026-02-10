package com.pitwall.mapper;

import com.pitwall.dto.FeedItemDto;
import com.pitwall.model.Event;
import com.pitwall.model.FeedItem;
import com.pitwall.model.Series;
import org.springframework.stereotype.Component;

@Component
public class FeedItemMapper {

    public FeedItemDto toDto(FeedItem feedItem) {
        Series series = feedItem.getSeries();
        Event event = feedItem.getEvent();
        return new FeedItemDto(
                feedItem.getId(),
                feedItem.getType(),
                series != null ? series.getSlug() : null,
                series != null ? series.getName() : null,
                series != null ? series.getColorPrimary() : null,
                event != null ? event.getId() : null,
                event != null ? event.getSlug() : null,
                feedItem.getTitle(),
                feedItem.getSummary(),
                feedItem.getContentUrl(),
                feedItem.getThumbnailUrl(),
                feedItem.getPublishedAt()
        );
    }
}

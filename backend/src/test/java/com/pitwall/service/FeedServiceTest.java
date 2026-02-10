package com.pitwall.service;

import com.pitwall.dto.FeedItemDto;
import com.pitwall.mapper.FeedItemMapper;
import com.pitwall.model.FeedItem;
import com.pitwall.model.Series;
import com.pitwall.repository.FeedItemRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FeedServiceTest {

    @Mock
    private FeedItemRepository feedItemRepository;

    @Mock
    private FeedItemMapper feedItemMapper;

    @InjectMocks
    private FeedService feedService;

    @Test
    void findAll_returnsMappedPage() {
        // Arrange
        Pageable pageable = PageRequest.of(0, 10);

        FeedItem item1 = buildFeedItem(1L, "Breaking News");
        FeedItem item2 = buildFeedItem(2L, "Race Recap");
        Page<FeedItem> feedItemPage = new PageImpl<>(List.of(item1, item2), pageable, 2);

        FeedItemDto dto1 = buildFeedItemDto(1L, "Breaking News");
        FeedItemDto dto2 = buildFeedItemDto(2L, "Race Recap");

        when(feedItemRepository.findAllByOrderByPublishedAtDesc(pageable)).thenReturn(feedItemPage);
        when(feedItemMapper.toDto(item1)).thenReturn(dto1);
        when(feedItemMapper.toDto(item2)).thenReturn(dto2);

        // Act
        Page<FeedItemDto> result = feedService.findAll(pageable);

        // Assert
        assertEquals(2, result.getTotalElements());
        assertEquals(dto1, result.getContent().get(0));
        assertEquals(dto2, result.getContent().get(1));
        verify(feedItemRepository).findAllByOrderByPublishedAtDesc(pageable);
    }

    @Test
    void findBySeries_delegatesToRepositoryWithCorrectSlug() {
        // Arrange
        String seriesSlug = "f1";
        Pageable pageable = PageRequest.of(0, 10);

        FeedItem item = buildFeedItem(1L, "F1 News");
        Page<FeedItem> feedItemPage = new PageImpl<>(List.of(item), pageable, 1);

        FeedItemDto dto = buildFeedItemDto(1L, "F1 News");

        when(feedItemRepository.findBySeriesSlugOrderByPublishedAtDesc(seriesSlug, pageable)).thenReturn(feedItemPage);
        when(feedItemMapper.toDto(item)).thenReturn(dto);

        // Act
        Page<FeedItemDto> result = feedService.findBySeries(seriesSlug, pageable);

        // Assert
        assertEquals(1, result.getTotalElements());
        assertEquals(dto, result.getContent().get(0));
        verify(feedItemRepository).findBySeriesSlugOrderByPublishedAtDesc(seriesSlug, pageable);
    }

    private FeedItem buildFeedItem(Long id, String title) {
        Series series = new Series();
        series.setId(1L);
        series.setName("Formula 1");
        series.setSlug("f1");
        series.setColorPrimary("#E10600");

        FeedItem item = new FeedItem();
        item.setId(id);
        item.setType("article");
        item.setSeries(series);
        item.setTitle(title);
        item.setSummary("A summary for " + title);
        item.setContentUrl("https://example.com/" + id);
        item.setPublishedAt(Instant.now());
        return item;
    }

    private FeedItemDto buildFeedItemDto(Long id, String title) {
        return new FeedItemDto(
                id,
                "article",
                "f1",
                "Formula 1",
                "#E10600",
                null,
                null,
                title,
                "A summary for " + title,
                "https://example.com/" + id,
                null,
                Instant.now()
        );
    }
}

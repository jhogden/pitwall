package com.pitwall.controller;

import com.pitwall.dto.FeedItemDto;
import com.pitwall.service.FeedService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FeedControllerTest {

    @Mock
    private FeedService feedService;

    @InjectMocks
    private FeedController feedController;

    @Test
    void getHighlights_passesEventFilterToService() {
        Page<FeedItemDto> page = new PageImpl<>(List.of(buildDto(1L, "Event Highlight")));
        when(feedService.findHighlights(eq("wec"), eq("2025-6-hours-of-imola"), any(Pageable.class)))
                .thenReturn(page);

        ResponseEntity<Page<FeedItemDto>> response = feedController.getHighlights("wec", "2025-6-hours-of-imola", 1, 15);

        assertSame(page, response.getBody());
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(feedService).findHighlights(eq("wec"), eq("2025-6-hours-of-imola"), captor.capture());
        assertEquals(1, captor.getValue().getPageNumber());
        assertEquals(15, captor.getValue().getPageSize());
    }

    @Test
    void getHighlights_passesSeriesFilterToService() {
        Page<FeedItemDto> page = new PageImpl<>(List.of(buildDto(2L, "Series Highlight")));
        when(feedService.findHighlights(eq("imsa"), isNull(), any(Pageable.class))).thenReturn(page);

        ResponseEntity<Page<FeedItemDto>> response = feedController.getHighlights("imsa", null, 0, 20);

        assertSame(page, response.getBody());
        verify(feedService).findHighlights(eq("imsa"), isNull(), any(Pageable.class));
    }

    @Test
    void getHighlights_handlesNoFilters() {
        Page<FeedItemDto> page = new PageImpl<>(List.of(buildDto(3L, "General Highlight")));
        when(feedService.findHighlights(isNull(), isNull(), any(Pageable.class))).thenReturn(page);

        ResponseEntity<Page<FeedItemDto>> response = feedController.getHighlights(null, null, 0, 5);

        assertSame(page, response.getBody());
        verify(feedService).findHighlights(isNull(), isNull(), any(Pageable.class));
    }

    private FeedItemDto buildDto(Long id, String title) {
        return new FeedItemDto(
                id,
                "highlight",
                "f1",
                "Formula 1",
                "#E10600",
                null,
                null,
                title,
                "summary",
                "https://www.youtube.com/watch?v=test",
                "https://img.youtube.com/test.jpg",
                Instant.now()
        );
    }
}

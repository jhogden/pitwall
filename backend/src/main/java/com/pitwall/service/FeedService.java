package com.pitwall.service;

import com.pitwall.dto.FeedItemDto;
import com.pitwall.mapper.FeedItemMapper;
import com.pitwall.repository.FeedItemRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class FeedService {

    private final FeedItemRepository feedItemRepository;
    private final FeedItemMapper feedItemMapper;

    public FeedService(FeedItemRepository feedItemRepository, FeedItemMapper feedItemMapper) {
        this.feedItemRepository = feedItemRepository;
        this.feedItemMapper = feedItemMapper;
    }

    public Page<FeedItemDto> findAll(Pageable pageable) {
        return feedItemRepository.findAllByOrderByPublishedAtDesc(pageable)
                .map(feedItemMapper::toDto);
    }

    public Page<FeedItemDto> findBySeries(String seriesSlug, Pageable pageable) {
        return feedItemRepository.findBySeriesSlugOrderByPublishedAtDesc(seriesSlug, pageable)
                .map(feedItemMapper::toDto);
    }

    public Page<FeedItemDto> findHighlights(String seriesSlug, String eventSlug, Pageable pageable) {
        if (eventSlug != null && !eventSlug.isBlank()) {
            return feedItemRepository.findByTypeAndEventSlugOrderByPublishedAtDesc("highlight", eventSlug, pageable)
                    .map(feedItemMapper::toDto);
        }
        if (seriesSlug != null && !seriesSlug.isBlank()) {
            return feedItemRepository.findByTypeAndSeriesSlugOrderByPublishedAtDesc("highlight", seriesSlug, pageable)
                    .map(feedItemMapper::toDto);
        }
        return feedItemRepository.findByTypeOrderByPublishedAtDesc("highlight", pageable)
                .map(feedItemMapper::toDto);
    }
}

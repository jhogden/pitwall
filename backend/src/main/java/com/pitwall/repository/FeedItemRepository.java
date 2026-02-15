package com.pitwall.repository;

import com.pitwall.model.FeedItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FeedItemRepository extends JpaRepository<FeedItem, Long> {

    Page<FeedItem> findBySeriesSlugOrderByPublishedAtDesc(String slug, Pageable pageable);

    Page<FeedItem> findAllByOrderByPublishedAtDesc(Pageable pageable);

    Page<FeedItem> findByTypeOrderByPublishedAtDesc(String type, Pageable pageable);

    Page<FeedItem> findByTypeAndSeriesSlugOrderByPublishedAtDesc(String type, String slug, Pageable pageable);

    Page<FeedItem> findByTypeAndEventSlugOrderByPublishedAtDesc(String type, String eventSlug, Pageable pageable);
}

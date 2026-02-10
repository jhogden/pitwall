package com.pitwall.controller;

import com.pitwall.dto.FeedItemDto;
import com.pitwall.service.FeedService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/feed")
public class FeedController {

    private final FeedService feedService;

    public FeedController(FeedService feedService) {
        this.feedService = feedService;
    }

    @GetMapping
    public ResponseEntity<Page<FeedItemDto>> getFeed(
            @RequestParam(required = false) String series,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        if (series != null) {
            return ResponseEntity.ok(feedService.findBySeries(series, pageable));
        }
        return ResponseEntity.ok(feedService.findAll(pageable));
    }

    @GetMapping("/personalized")
    public ResponseEntity<Page<FeedItemDto>> getPersonalizedFeed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(feedService.findAll(pageable));
    }
}

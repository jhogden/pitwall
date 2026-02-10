package com.pitwall.controller;

import com.pitwall.dto.SeriesDto;
import com.pitwall.dto.StandingDto;
import com.pitwall.service.SeriesService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/series")
public class SeriesController {

    private final SeriesService seriesService;

    public SeriesController(SeriesService seriesService) {
        this.seriesService = seriesService;
    }

    @GetMapping
    public ResponseEntity<List<SeriesDto>> getAllSeries() {
        return ResponseEntity.ok(seriesService.findAll());
    }

    @GetMapping("/{slug}")
    public ResponseEntity<SeriesDto> getBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(seriesService.findBySlug(slug));
    }

    @GetMapping("/{slug}/standings")
    public ResponseEntity<List<StandingDto>> getStandings(@PathVariable String slug) {
        return ResponseEntity.ok(Collections.emptyList());
    }
}

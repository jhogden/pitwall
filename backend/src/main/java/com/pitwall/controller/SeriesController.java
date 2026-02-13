package com.pitwall.controller;

import com.pitwall.dto.ConstructorStandingDto;
import com.pitwall.dto.SeriesDto;
import com.pitwall.dto.StandingDto;
import com.pitwall.service.SeriesService;
import com.pitwall.service.StandingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Year;
import java.util.List;

@RestController
@RequestMapping("/api/series")
public class SeriesController {

    private final SeriesService seriesService;
    private final StandingsService standingsService;

    public SeriesController(SeriesService seriesService, StandingsService standingsService) {
        this.seriesService = seriesService;
        this.standingsService = standingsService;
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
    public ResponseEntity<List<StandingDto>> getDriverStandings(
            @PathVariable String slug,
            @RequestParam(defaultValue = "0") int year) {
        int effectiveYear = year > 0 ? year : Year.now().getValue();
        return ResponseEntity.ok(standingsService.findDriverStandings(slug, effectiveYear));
    }

    @GetMapping("/{slug}/constructors")
    public ResponseEntity<List<ConstructorStandingDto>> getConstructorStandings(
            @PathVariable String slug,
            @RequestParam(defaultValue = "0") int year) {
        int effectiveYear = year > 0 ? year : Year.now().getValue();
        return ResponseEntity.ok(standingsService.findConstructorStandings(slug, effectiveYear));
    }
}

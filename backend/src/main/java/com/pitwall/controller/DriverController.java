package com.pitwall.controller;

import com.pitwall.dto.DriverDto;
import com.pitwall.dto.DriverResultDto;
import com.pitwall.service.DriverService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/drivers")
public class DriverController {

    private final DriverService driverService;

    public DriverController(DriverService driverService) {
        this.driverService = driverService;
    }

    @GetMapping
    public ResponseEntity<List<DriverDto>> getDriversBySeries(
            @RequestParam(required = false) String series) {
        if (series != null) {
            return ResponseEntity.ok(driverService.findBySeriesSlug(series));
        }
        return ResponseEntity.ok(driverService.findAll());
    }

    @GetMapping("/{slug}")
    public ResponseEntity<DriverDto> getDriverBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(driverService.findBySlug(slug));
    }

    @GetMapping("/{slug}/results")
    public ResponseEntity<List<DriverResultDto>> getDriverResults(
            @PathVariable String slug,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) String circuit,
            @RequestParam(required = false) String sessionType) {
        return ResponseEntity.ok(driverService.findResultsBySlug(slug, year, circuit, sessionType));
    }

    @GetMapping("/{slug}/circuits")
    public ResponseEntity<List<String>> getDriverCircuits(@PathVariable String slug) {
        return ResponseEntity.ok(driverService.findCircuitsByDriverSlug(slug));
    }

    @GetMapping("/{slug}/seasons")
    public ResponseEntity<List<Integer>> getDriverSeasons(@PathVariable String slug) {
        return ResponseEntity.ok(driverService.findSeasonsByDriverSlug(slug));
    }
}

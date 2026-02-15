package com.pitwall.controller;

import com.pitwall.dto.EventDetailDto;
import com.pitwall.dto.LapTelemetryDto;
import com.pitwall.dto.ResultDto;
import com.pitwall.dto.TireStintDto;
import com.pitwall.service.EventService;
import com.pitwall.service.LapTelemetryService;
import com.pitwall.service.ResultService;
import com.pitwall.service.TireStintService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/events")
public class EventController {

    private final EventService eventService;
    private final ResultService resultService;
    private final LapTelemetryService lapTelemetryService;
    private final TireStintService tireStintService;

    public EventController(
            EventService eventService,
            ResultService resultService,
            LapTelemetryService lapTelemetryService,
            TireStintService tireStintService
    ) {
        this.eventService = eventService;
        this.resultService = resultService;
        this.lapTelemetryService = lapTelemetryService;
        this.tireStintService = tireStintService;
    }

    @GetMapping("/{slug}")
    public ResponseEntity<EventDetailDto> getEventBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(eventService.findBySlug(slug));
    }

    @GetMapping("/{slug}/results")
    public ResponseEntity<List<ResultDto>> getResults(
            @PathVariable String slug,
            @RequestParam(required = false) Long sessionId,
            @RequestParam(required = false) String className) {
        if (sessionId != null) {
            if (className != null && !className.isBlank()) {
                return ResponseEntity.ok(resultService.findBySessionIdAndClassName(sessionId, className));
            }
            return ResponseEntity.ok(resultService.findBySessionId(sessionId));
        }
        return ResponseEntity.ok(Collections.emptyList());
    }

    @GetMapping("/{slug}/result-classes")
    public ResponseEntity<List<String>> getResultClasses(
            @PathVariable String slug,
            @RequestParam(required = false) Long sessionId) {
        if (sessionId != null) {
            return ResponseEntity.ok(resultService.findResultClasses(sessionId));
        }
        return ResponseEntity.ok(Collections.emptyList());
    }

    @GetMapping("/{slug}/telemetry")
    public ResponseEntity<List<LapTelemetryDto>> getTelemetry(
            @PathVariable String slug,
            @RequestParam(required = false) Long sessionId) {
        if (sessionId != null) {
            return ResponseEntity.ok(lapTelemetryService.findBySessionId(sessionId));
        }
        return ResponseEntity.ok(Collections.emptyList());
    }

    @GetMapping("/{slug}/tire-stints")
    public ResponseEntity<List<TireStintDto>> getTireStints(
            @PathVariable String slug,
            @RequestParam(required = false) Long sessionId) {
        if (sessionId != null) {
            return ResponseEntity.ok(tireStintService.findBySessionId(sessionId));
        }
        return ResponseEntity.ok(Collections.emptyList());
    }
}

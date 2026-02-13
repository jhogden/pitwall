package com.pitwall.controller;

import com.pitwall.dto.EventDto;
import com.pitwall.service.CalendarService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/calendar")
public class CalendarController {

    private final CalendarService calendarService;

    public CalendarController(CalendarService calendarService) {
        this.calendarService = calendarService;
    }

    @GetMapping("/seasons")
    public ResponseEntity<List<Integer>> getSeasons(@RequestParam(required = false) String series) {
        return ResponseEntity.ok(calendarService.findAvailableYears(series));
    }

    @GetMapping
    public ResponseEntity<List<EventDto>> getCalendar(
            @RequestParam(required = false) String series,
            @RequestParam(required = false) Integer year) {
        if (series != null && year != null) {
            return ResponseEntity.ok(calendarService.findEventsBySeriesAndYear(series, year));
        }
        if (series != null) {
            return ResponseEntity.ok(calendarService.findEventsBySeries(series));
        }
        if (year != null) {
            return ResponseEntity.ok(calendarService.findEventsByYear(year));
        }
        return ResponseEntity.ok(calendarService.findUpcomingEvents());
    }

    @GetMapping("/{series}")
    public ResponseEntity<List<EventDto>> getEventsBySeries(
            @PathVariable String series,
            @RequestParam(required = false) Integer year) {
        if (year != null) {
            return ResponseEntity.ok(calendarService.findEventsBySeriesAndYear(series, year));
        }
        return ResponseEntity.ok(calendarService.findEventsBySeries(series));
    }
}

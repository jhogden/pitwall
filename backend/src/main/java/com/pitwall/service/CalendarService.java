package com.pitwall.service;

import com.pitwall.dto.EventDto;
import com.pitwall.mapper.EventMapper;
import com.pitwall.repository.EventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class CalendarService {

    private final EventRepository eventRepository;
    private final EventMapper eventMapper;

    public CalendarService(EventRepository eventRepository, EventMapper eventMapper) {
        this.eventRepository = eventRepository;
        this.eventMapper = eventMapper;
    }

    public List<EventDto> findUpcomingEvents() {
        return eventRepository.findByStatusOrderByStartDate("upcoming").stream()
                .map(eventMapper::toSummaryDto)
                .toList();
    }

    public List<EventDto> findEventsBySeries(String seriesSlug) {
        return eventRepository.findBySeasonSeriesSlugOrderByStartDate(seriesSlug).stream()
                .map(eventMapper::toSummaryDto)
                .toList();
    }

    public List<EventDto> findEventsByYear(int year) {
        return eventRepository.findBySeasonYearOrderByStartDate(year).stream()
                .map(eventMapper::toSummaryDto)
                .toList();
    }

    public List<EventDto> findEventsBySeriesAndYear(String seriesSlug, int year) {
        return eventRepository.findBySeasonSeriesSlugAndSeasonYearOrderByStartDate(seriesSlug, year).stream()
                .map(eventMapper::toSummaryDto)
                .toList();
    }

    public List<EventDto> findEventsByDateRange(LocalDate startDate, LocalDate endDate) {
        return eventRepository.findByStartDateBetweenOrderByStartDate(startDate, endDate).stream()
                .map(eventMapper::toSummaryDto)
                .toList();
    }
}

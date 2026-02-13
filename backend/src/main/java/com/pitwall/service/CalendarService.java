package com.pitwall.service;

import com.pitwall.dto.EventDto;
import com.pitwall.mapper.EventMapper;
import com.pitwall.model.Season;
import com.pitwall.repository.EventRepository;
import com.pitwall.repository.SeasonRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class CalendarService {

    private final EventRepository eventRepository;
    private final SeasonRepository seasonRepository;
    private final EventMapper eventMapper;

    public CalendarService(EventRepository eventRepository, SeasonRepository seasonRepository, EventMapper eventMapper) {
        this.eventRepository = eventRepository;
        this.seasonRepository = seasonRepository;
        this.eventMapper = eventMapper;
    }

    public List<Integer> findAvailableYears(String seriesSlug) {
        List<Season> seasons;
        if (seriesSlug != null && !seriesSlug.isBlank()) {
            seasons = seasonRepository.findBySeriesSlugOrderByYearDesc(seriesSlug);
        } else {
            seasons = seasonRepository.findAllByOrderByYearDesc();
        }
        return seasons.stream()
                .map(Season::getYear)
                .toList();
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

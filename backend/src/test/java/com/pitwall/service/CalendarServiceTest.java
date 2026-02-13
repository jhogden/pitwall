package com.pitwall.service;

import com.pitwall.dto.EventDto;
import com.pitwall.mapper.EventMapper;
import com.pitwall.model.Circuit;
import com.pitwall.model.Event;
import com.pitwall.model.Season;
import com.pitwall.model.Series;
import com.pitwall.repository.EventRepository;
import com.pitwall.repository.SeasonRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CalendarServiceTest {

    @Mock
    private EventRepository eventRepository;

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private EventMapper eventMapper;

    @InjectMocks
    private CalendarService calendarService;

    @Test
    void findUpcomingEvents_returnsEventsWithUpcomingStatus() {
        // Arrange
        Event event1 = buildEvent(1L, "bahrain-gp");
        Event event2 = buildEvent(2L, "saudi-gp");
        List<Event> events = List.of(event1, event2);

        EventDto dto1 = buildEventDto(1L, "bahrain-gp");
        EventDto dto2 = buildEventDto(2L, "saudi-gp");

        when(eventRepository.findByStatusOrderByStartDate("upcoming")).thenReturn(events);
        when(eventMapper.toSummaryDto(event1)).thenReturn(dto1);
        when(eventMapper.toSummaryDto(event2)).thenReturn(dto2);

        // Act
        List<EventDto> result = calendarService.findUpcomingEvents();

        // Assert
        assertEquals(2, result.size());
        assertEquals(dto1, result.get(0));
        assertEquals(dto2, result.get(1));
        verify(eventRepository).findByStatusOrderByStartDate("upcoming");
    }

    @Test
    void findEventsBySeries_delegatesToRepositoryWithCorrectSlug() {
        // Arrange
        String seriesSlug = "f1";
        Event event = buildEvent(1L, "bahrain-gp");
        EventDto dto = buildEventDto(1L, "bahrain-gp");

        when(eventRepository.findBySeasonSeriesSlugOrderByStartDate(seriesSlug)).thenReturn(List.of(event));
        when(eventMapper.toSummaryDto(event)).thenReturn(dto);

        // Act
        List<EventDto> result = calendarService.findEventsBySeries(seriesSlug);

        // Assert
        assertEquals(1, result.size());
        assertEquals(dto, result.get(0));
        verify(eventRepository).findBySeasonSeriesSlugOrderByStartDate(seriesSlug);
    }

    @Test
    void findEventsByDateRange_delegatesToRepositoryWithCorrectDates() {
        // Arrange
        LocalDate startDate = LocalDate.of(2025, 3, 1);
        LocalDate endDate = LocalDate.of(2025, 3, 31);
        Event event = buildEvent(1L, "bahrain-gp");
        EventDto dto = buildEventDto(1L, "bahrain-gp");

        when(eventRepository.findByStartDateBetweenOrderByStartDate(startDate, endDate)).thenReturn(List.of(event));
        when(eventMapper.toSummaryDto(event)).thenReturn(dto);

        // Act
        List<EventDto> result = calendarService.findEventsByDateRange(startDate, endDate);

        // Assert
        assertEquals(1, result.size());
        assertEquals(dto, result.get(0));
        verify(eventRepository).findByStartDateBetweenOrderByStartDate(startDate, endDate);
    }

    @Test
    void findUpcomingEvents_whenNoneExist_returnsEmptyList() {
        // Arrange
        when(eventRepository.findByStatusOrderByStartDate("upcoming")).thenReturn(Collections.emptyList());

        // Act
        List<EventDto> result = calendarService.findUpcomingEvents();

        // Assert
        assertTrue(result.isEmpty());
        verify(eventRepository).findByStatusOrderByStartDate("upcoming");
        verifyNoInteractions(eventMapper);
    }

    @Test
    void findEventsByYear_delegatesToRepositoryWithCorrectYear() {
        // Arrange
        int year = 2025;
        Event event = buildEvent(1L, "bahrain-gp");
        EventDto dto = buildEventDto(1L, "bahrain-gp");

        when(eventRepository.findBySeasonYearOrderByStartDate(year)).thenReturn(List.of(event));
        when(eventMapper.toSummaryDto(event)).thenReturn(dto);

        // Act
        List<EventDto> result = calendarService.findEventsByYear(year);

        // Assert
        assertEquals(1, result.size());
        assertEquals(dto, result.get(0));
        verify(eventRepository).findBySeasonYearOrderByStartDate(year);
    }

    @Test
    void findEventsByYear_whenNoneExist_returnsEmptyList() {
        // Arrange
        when(eventRepository.findBySeasonYearOrderByStartDate(2030)).thenReturn(Collections.emptyList());

        // Act
        List<EventDto> result = calendarService.findEventsByYear(2030);

        // Assert
        assertTrue(result.isEmpty());
        verifyNoInteractions(eventMapper);
    }

    @Test
    void findEventsBySeriesAndYear_delegatesToRepositoryWithCorrectParams() {
        // Arrange
        String seriesSlug = "f1";
        int year = 2025;
        Event event = buildEvent(1L, "bahrain-gp");
        EventDto dto = buildEventDto(1L, "bahrain-gp");

        when(eventRepository.findBySeasonSeriesSlugAndSeasonYearOrderByStartDate(seriesSlug, year))
                .thenReturn(List.of(event));
        when(eventMapper.toSummaryDto(event)).thenReturn(dto);

        // Act
        List<EventDto> result = calendarService.findEventsBySeriesAndYear(seriesSlug, year);

        // Assert
        assertEquals(1, result.size());
        assertEquals(dto, result.get(0));
        verify(eventRepository).findBySeasonSeriesSlugAndSeasonYearOrderByStartDate(seriesSlug, year);
    }

    @Test
    void findEventsBySeriesAndYear_whenNoneExist_returnsEmptyList() {
        // Arrange
        when(eventRepository.findBySeasonSeriesSlugAndSeasonYearOrderByStartDate("wec", 2030))
                .thenReturn(Collections.emptyList());

        // Act
        List<EventDto> result = calendarService.findEventsBySeriesAndYear("wec", 2030);

        // Assert
        assertTrue(result.isEmpty());
        verifyNoInteractions(eventMapper);
    }

    @Test
    void findAvailableYears_withSeriesSlug_returnsYearsForSeries() {
        // Arrange
        String seriesSlug = "f1";
        Season season2025 = buildSeason(1L, 2025);
        Season season2024 = buildSeason(2L, 2024);

        when(seasonRepository.findBySeriesSlugOrderByYearDesc(seriesSlug))
                .thenReturn(List.of(season2025, season2024));

        // Act
        List<Integer> result = calendarService.findAvailableYears(seriesSlug);

        // Assert
        assertEquals(List.of(2025, 2024), result);
        verify(seasonRepository).findBySeriesSlugOrderByYearDesc(seriesSlug);
        verify(seasonRepository, never()).findAllByOrderByYearDesc();
    }

    @Test
    void findAvailableYears_withoutSeriesSlug_returnsAllYears() {
        // Arrange
        Season season2025 = buildSeason(1L, 2025);
        Season season2024 = buildSeason(2L, 2024);
        Season season1950 = buildSeason(3L, 1950);

        when(seasonRepository.findAllByOrderByYearDesc())
                .thenReturn(List.of(season2025, season2024, season1950));

        // Act
        List<Integer> result = calendarService.findAvailableYears(null);

        // Assert
        assertEquals(List.of(2025, 2024, 1950), result);
        verify(seasonRepository).findAllByOrderByYearDesc();
        verify(seasonRepository, never()).findBySeriesSlugOrderByYearDesc(any());
    }

    @Test
    void findAvailableYears_whenNoneExist_returnsEmptyList() {
        // Arrange
        when(seasonRepository.findAllByOrderByYearDesc()).thenReturn(Collections.emptyList());

        // Act
        List<Integer> result = calendarService.findAvailableYears(null);

        // Assert
        assertTrue(result.isEmpty());
    }

    private Season buildSeason(Long id, int year) {
        Series series = new Series();
        series.setId(1L);
        series.setName("Formula 1");
        series.setSlug("f1");
        series.setColorPrimary("#E10600");

        Season season = new Season();
        season.setId(id);
        season.setSeries(series);
        season.setYear(year);
        return season;
    }

    private Event buildEvent(Long id, String slug) {
        Series series = new Series();
        series.setId(1L);
        series.setName("Formula 1");
        series.setSlug("f1");
        series.setColorPrimary("#E10600");

        Season season = new Season();
        season.setId(1L);
        season.setSeries(series);
        season.setYear(2025);

        Circuit circuit = new Circuit();
        circuit.setId(1L);
        circuit.setName("Bahrain International Circuit");
        circuit.setCountry("Bahrain");
        circuit.setCity("Sakhir");
        circuit.setTimezone("Asia/Bahrain");

        Event event = new Event();
        event.setId(id);
        event.setSlug(slug);
        event.setName("Bahrain Grand Prix");
        event.setSeason(season);
        event.setCircuit(circuit);
        event.setStartDate(LocalDate.of(2025, 3, 14));
        event.setEndDate(LocalDate.of(2025, 3, 16));
        event.setStatus("upcoming");
        return event;
    }

    private EventDto buildEventDto(Long id, String slug) {
        return new EventDto(
                id,
                "Bahrain Grand Prix",
                slug,
                "f1",
                "Formula 1",
                "#E10600",
                "Bahrain International Circuit",
                "Bahrain",
                "Sakhir",
                LocalDate.of(2025, 3, 14),
                LocalDate.of(2025, 3, 16),
                "upcoming"
        );
    }
}

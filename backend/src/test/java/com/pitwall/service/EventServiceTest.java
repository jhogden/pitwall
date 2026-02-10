package com.pitwall.service;

import com.pitwall.dto.EventDetailDto;
import com.pitwall.exception.ResourceNotFoundException;
import com.pitwall.mapper.EventMapper;
import com.pitwall.model.Circuit;
import com.pitwall.model.Event;
import com.pitwall.model.Season;
import com.pitwall.model.Series;
import com.pitwall.model.Session;
import com.pitwall.repository.EventRepository;
import com.pitwall.repository.SessionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EventServiceTest {

    @Mock
    private EventRepository eventRepository;

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private EventMapper eventMapper;

    @InjectMocks
    private EventService eventService;

    @Test
    void findBySlug_whenExists_returnsDetailDto() {
        // Arrange
        Event event = buildEvent(1L, "bahrain-gp");
        Session session = new Session();
        session.setId(10L);
        session.setType("race");
        session.setName("Race");
        session.setStatus("completed");
        List<Session> sessions = List.of(session);

        EventDetailDto detailDto = mock(EventDetailDto.class);

        when(eventRepository.findBySlug("bahrain-gp")).thenReturn(Optional.of(event));
        when(sessionRepository.findByEventIdOrderByStartTime(1L)).thenReturn(sessions);
        when(eventMapper.toDetailDto(event, sessions)).thenReturn(detailDto);

        // Act
        EventDetailDto result = eventService.findBySlug("bahrain-gp");

        // Assert
        assertNotNull(result);
        assertEquals(detailDto, result);
        verify(eventRepository).findBySlug("bahrain-gp");
        verify(sessionRepository).findByEventIdOrderByStartTime(1L);
        verify(eventMapper).toDetailDto(event, sessions);
    }

    @Test
    void findBySlug_whenNotFound_throwsResourceNotFoundException() {
        // Arrange
        when(eventRepository.findBySlug("unknown-gp")).thenReturn(Optional.empty());

        // Act & Assert
        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> eventService.findBySlug("unknown-gp")
        );

        assertTrue(exception.getMessage().contains("Event"));
        assertTrue(exception.getMessage().contains("unknown-gp"));
        verify(eventRepository).findBySlug("unknown-gp");
        verifyNoInteractions(sessionRepository);
        verifyNoInteractions(eventMapper);
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
        event.setStatus("completed");
        return event;
    }
}

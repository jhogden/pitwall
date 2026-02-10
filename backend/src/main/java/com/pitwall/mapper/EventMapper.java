package com.pitwall.mapper;

import com.pitwall.dto.EventDetailDto;
import com.pitwall.dto.EventDto;
import com.pitwall.dto.SessionDto;
import com.pitwall.model.Circuit;
import com.pitwall.model.Event;
import com.pitwall.model.Series;
import com.pitwall.model.Session;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class EventMapper {

    private final SeriesMapper seriesMapper;
    private final CircuitMapper circuitMapper;

    public EventMapper(SeriesMapper seriesMapper, CircuitMapper circuitMapper) {
        this.seriesMapper = seriesMapper;
        this.circuitMapper = circuitMapper;
    }

    public EventDto toSummaryDto(Event event) {
        Series series = event.getSeason().getSeries();
        Circuit circuit = event.getCircuit();
        return new EventDto(
                event.getId(),
                event.getName(),
                event.getSlug(),
                series.getSlug(),
                series.getName(),
                series.getColorPrimary(),
                circuit.getName(),
                circuit.getCountry(),
                circuit.getCity(),
                event.getStartDate(),
                event.getEndDate(),
                event.getStatus()
        );
    }

    public EventDetailDto toDetailDto(Event event, List<Session> sessions) {
        List<SessionDto> sessionDtos = sessions.stream()
                .map(this::toSessionDto)
                .toList();

        return new EventDetailDto(
                event.getId(),
                event.getName(),
                event.getSlug(),
                seriesMapper.toDto(event.getSeason().getSeries()),
                circuitMapper.toDto(event.getCircuit()),
                event.getStartDate(),
                event.getEndDate(),
                event.getStatus(),
                sessionDtos
        );
    }

    public SessionDto toSessionDto(Session session) {
        return new SessionDto(
                session.getId(),
                session.getType(),
                session.getName(),
                session.getStartTime(),
                session.getEndTime(),
                session.getStatus()
        );
    }
}

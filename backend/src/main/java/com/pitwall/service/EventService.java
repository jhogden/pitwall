package com.pitwall.service;

import com.pitwall.dto.EventDetailDto;
import com.pitwall.exception.ResourceNotFoundException;
import com.pitwall.mapper.EventMapper;
import com.pitwall.model.Event;
import com.pitwall.model.Session;
import com.pitwall.repository.EventRepository;
import com.pitwall.repository.SessionRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EventService {

    private final EventRepository eventRepository;
    private final SessionRepository sessionRepository;
    private final EventMapper eventMapper;

    public EventService(EventRepository eventRepository,
                        SessionRepository sessionRepository,
                        EventMapper eventMapper) {
        this.eventRepository = eventRepository;
        this.sessionRepository = sessionRepository;
        this.eventMapper = eventMapper;
    }

    public EventDetailDto findBySlug(String slug) {
        Event event = eventRepository.findBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Event", slug));

        List<Session> sessions = sessionRepository.findByEventIdOrderByStartTime(event.getId());
        return eventMapper.toDetailDto(event, sessions);
    }
}

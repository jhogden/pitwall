package com.pitwall.service;

import com.pitwall.dto.LapTelemetryDto;
import com.pitwall.mapper.LapTelemetryMapper;
import com.pitwall.repository.LapTelemetryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class LapTelemetryService {

    private final LapTelemetryRepository lapTelemetryRepository;
    private final LapTelemetryMapper lapTelemetryMapper;

    public LapTelemetryService(LapTelemetryRepository lapTelemetryRepository, LapTelemetryMapper lapTelemetryMapper) {
        this.lapTelemetryRepository = lapTelemetryRepository;
        this.lapTelemetryMapper = lapTelemetryMapper;
    }

    public List<LapTelemetryDto> findBySessionId(Long sessionId) {
        return lapTelemetryRepository.findBySessionIdOrderByLapNumberAscPositionAsc(sessionId).stream()
                .map(lapTelemetryMapper::toDto)
                .toList();
    }
}

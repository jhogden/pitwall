package com.pitwall.service;

import com.pitwall.dto.TireStintDto;
import com.pitwall.mapper.TireStintMapper;
import com.pitwall.repository.TireStintRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class TireStintService {

    private final TireStintRepository tireStintRepository;
    private final TireStintMapper tireStintMapper;

    public TireStintService(TireStintRepository tireStintRepository, TireStintMapper tireStintMapper) {
        this.tireStintRepository = tireStintRepository;
        this.tireStintMapper = tireStintMapper;
    }

    public List<TireStintDto> findBySessionId(Long sessionId) {
        return tireStintRepository.findBySessionIdOrderByDriverIdAscStintNumberAsc(sessionId).stream()
                .map(tireStintMapper::toDto)
                .toList();
    }
}

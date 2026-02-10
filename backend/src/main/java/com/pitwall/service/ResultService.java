package com.pitwall.service;

import com.pitwall.dto.ResultDto;
import com.pitwall.mapper.ResultMapper;
import com.pitwall.repository.ResultRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ResultService {

    private final ResultRepository resultRepository;
    private final ResultMapper resultMapper;

    public ResultService(ResultRepository resultRepository, ResultMapper resultMapper) {
        this.resultRepository = resultRepository;
        this.resultMapper = resultMapper;
    }

    public List<ResultDto> findBySessionId(Long sessionId) {
        return resultRepository.findBySessionIdOrderByPosition(sessionId).stream()
                .map(resultMapper::toDto)
                .toList();
    }
}

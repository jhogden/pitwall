package com.pitwall.service;

import com.pitwall.dto.ResultDto;
import com.pitwall.mapper.ResultMapper;
import com.pitwall.repository.ResultRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
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

    public List<ResultDto> findBySessionIdAndClassName(Long sessionId, String className) {
        return resultRepository.findBySessionIdAndClassNameOrderByPosition(sessionId, className).stream()
                .map(resultMapper::toDto)
                .toList();
    }

    public List<String> findResultClasses(Long sessionId) {
        return resultRepository.findDistinctClassNamesBySessionId(sessionId).stream()
                .filter(name -> name != null && !name.isBlank())
                .toList();
    }
}

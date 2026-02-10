package com.pitwall.service;

import com.pitwall.dto.SeriesDto;
import com.pitwall.exception.ResourceNotFoundException;
import com.pitwall.mapper.SeriesMapper;
import com.pitwall.repository.SeriesRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SeriesService {

    private final SeriesRepository seriesRepository;
    private final SeriesMapper seriesMapper;

    public SeriesService(SeriesRepository seriesRepository, SeriesMapper seriesMapper) {
        this.seriesRepository = seriesRepository;
        this.seriesMapper = seriesMapper;
    }

    public List<SeriesDto> findAll() {
        return seriesRepository.findAll().stream()
                .map(seriesMapper::toDto)
                .toList();
    }

    public SeriesDto findBySlug(String slug) {
        return seriesRepository.findBySlug(slug)
                .map(seriesMapper::toDto)
                .orElseThrow(() -> new ResourceNotFoundException("Series", slug));
    }
}

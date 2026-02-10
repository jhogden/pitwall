package com.pitwall.service;

import com.pitwall.dto.DriverDto;
import com.pitwall.exception.ResourceNotFoundException;
import com.pitwall.mapper.DriverMapper;
import com.pitwall.repository.DriverRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DriverService {

    private final DriverRepository driverRepository;
    private final DriverMapper driverMapper;

    public DriverService(DriverRepository driverRepository, DriverMapper driverMapper) {
        this.driverRepository = driverRepository;
        this.driverMapper = driverMapper;
    }

    public DriverDto findBySlug(String slug) {
        return driverRepository.findBySlug(slug)
                .map(driverMapper::toDto)
                .orElseThrow(() -> new ResourceNotFoundException("Driver", slug));
    }

    public List<DriverDto> findBySeriesSlug(String seriesSlug) {
        return driverRepository.findByTeamSeriesSlug(seriesSlug).stream()
                .map(driverMapper::toDto)
                .toList();
    }
}

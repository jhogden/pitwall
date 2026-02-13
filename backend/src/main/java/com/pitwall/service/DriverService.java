package com.pitwall.service;

import com.pitwall.dto.DriverDto;
import com.pitwall.dto.DriverResultDto;
import com.pitwall.exception.ResourceNotFoundException;
import com.pitwall.mapper.DriverMapper;
import com.pitwall.model.Event;
import com.pitwall.model.Result;
import com.pitwall.model.Session;
import com.pitwall.repository.DriverRepository;
import com.pitwall.repository.ResultRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class DriverService {

    private final DriverRepository driverRepository;
    private final ResultRepository resultRepository;
    private final DriverMapper driverMapper;

    public DriverService(DriverRepository driverRepository, ResultRepository resultRepository, DriverMapper driverMapper) {
        this.driverRepository = driverRepository;
        this.resultRepository = resultRepository;
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

    public List<DriverResultDto> findResultsBySlug(String slug, Integer year) {
        List<Result> results;
        if (year != null) {
            results = resultRepository.findByDriverSlugAndSessionTypeAndSessionEventSeasonYearOrderBySessionStartTimeAsc(
                    slug, "race", year);
        } else {
            results = resultRepository.findByDriverSlugAndSessionTypeOrderBySessionStartTimeDesc(
                    slug, "race");
        }
        return results.stream()
                .map(this::toDriverResultDto)
                .toList();
    }

    private DriverResultDto toDriverResultDto(Result result) {
        Session session = result.getSession();
        Event event = session.getEvent();
        return new DriverResultDto(
                event.getName(),
                event.getSlug(),
                event.getSeason().getSeries().getSlug(),
                event.getStartDate(),
                result.getPosition(),
                result.getGap(),
                result.getStatus(),
                event.getSeason().getYear()
        );
    }
}

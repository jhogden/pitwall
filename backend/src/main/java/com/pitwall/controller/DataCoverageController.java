package com.pitwall.controller;

import com.pitwall.dto.DataCoverageDto;
import com.pitwall.service.DataCoverageService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/coverage")
public class DataCoverageController {

    private final DataCoverageService dataCoverageService;

    public DataCoverageController(DataCoverageService dataCoverageService) {
        this.dataCoverageService = dataCoverageService;
    }

    @GetMapping
    public ResponseEntity<List<DataCoverageDto>> getCoverage(
            @RequestParam(required = false) String series,
            @RequestParam(required = false) Integer year
    ) {
        return ResponseEntity.ok(dataCoverageService.getCoverage(series, year));
    }
}

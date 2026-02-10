package com.pitwall.controller;

import com.pitwall.dto.DriverDto;
import com.pitwall.service.DriverService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/drivers")
public class DriverController {

    private final DriverService driverService;

    public DriverController(DriverService driverService) {
        this.driverService = driverService;
    }

    @GetMapping("/{slug}")
    public ResponseEntity<DriverDto> getDriverBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(driverService.findBySlug(slug));
    }
}

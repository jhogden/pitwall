package com.pitwall.controller;

import com.pitwall.dto.DriverDto;
import com.pitwall.dto.DriverResultDto;
import com.pitwall.service.DriverService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DriverControllerTest {

    @Mock
    private DriverService driverService;

    @InjectMocks
    private DriverController driverController;

    @Test
    void getDriversBySeries_withSeriesParam_delegatesToFindBySeriesSlug() {
        // Arrange
        List<DriverDto> drivers = List.of(
                new DriverDto(1L, "Max Verstappen", 1, "Red Bull Racing", "#3671C6", "Dutch", "max-verstappen")
        );
        when(driverService.findBySeriesSlug("f1")).thenReturn(drivers);

        // Act
        ResponseEntity<List<DriverDto>> response = driverController.getDriversBySeries("f1");

        // Assert
        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().size());
        verify(driverService).findBySeriesSlug("f1");
        verify(driverService, never()).findAll();
    }

    @Test
    void getDriversBySeries_withoutSeriesParam_delegatesToFindAll() {
        // Arrange
        List<DriverDto> drivers = List.of(
                new DriverDto(1L, "Max Verstappen", 1, "Red Bull Racing", "#3671C6", "Dutch", "max-verstappen"),
                new DriverDto(2L, "Lewis Hamilton", 44, "Ferrari", "#E8002D", "British", "lewis-hamilton")
        );
        when(driverService.findAll()).thenReturn(drivers);

        // Act
        ResponseEntity<List<DriverDto>> response = driverController.getDriversBySeries(null);

        // Assert
        assertEquals(200, response.getStatusCode().value());
        assertEquals(2, response.getBody().size());
        verify(driverService).findAll();
        verify(driverService, never()).findBySeriesSlug(any());
    }

    @Test
    void getDriverBySlug_delegatesToService() {
        // Arrange
        DriverDto dto = new DriverDto(1L, "Max Verstappen", 1, "Red Bull Racing", "#3671C6", "Dutch", "max-verstappen");
        when(driverService.findBySlug("max-verstappen")).thenReturn(dto);

        // Act
        ResponseEntity<DriverDto> response = driverController.getDriverBySlug("max-verstappen");

        // Assert
        assertEquals(200, response.getStatusCode().value());
        assertEquals(dto, response.getBody());
        verify(driverService).findBySlug("max-verstappen");
    }

    @Test
    void getDriverResults_passesAllFiltersToService() {
        // Arrange
        List<DriverResultDto> results = List.of(
                new DriverResultDto("British GP", "british-gp", "f1",
                        LocalDate.of(2024, 7, 7), 1, "+0.5s", "finished", 2024,
                        "Silverstone", "race")
        );
        when(driverService.findResultsBySlug("max-verstappen", 2024, "Silverstone", "race"))
                .thenReturn(results);

        // Act
        ResponseEntity<List<DriverResultDto>> response = driverController.getDriverResults(
                "max-verstappen", 2024, "Silverstone", "race");

        // Assert
        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().size());
        verify(driverService).findResultsBySlug("max-verstappen", 2024, "Silverstone", "race");
    }

    @Test
    void getDriverResults_withNoFilters_passesNulls() {
        // Arrange
        when(driverService.findResultsBySlug("max-verstappen", null, null, null))
                .thenReturn(List.of());

        // Act
        ResponseEntity<List<DriverResultDto>> response = driverController.getDriverResults(
                "max-verstappen", null, null, null);

        // Assert
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().isEmpty());
        verify(driverService).findResultsBySlug("max-verstappen", null, null, null);
    }

    @Test
    void getDriverCircuits_delegatesToService() {
        // Arrange
        List<String> circuits = List.of("Monza", "Silverstone");
        when(driverService.findCircuitsByDriverSlug("max-verstappen")).thenReturn(circuits);

        // Act
        ResponseEntity<List<String>> response = driverController.getDriverCircuits("max-verstappen");

        // Assert
        assertEquals(200, response.getStatusCode().value());
        assertEquals(2, response.getBody().size());
        assertEquals("Monza", response.getBody().get(0));
        verify(driverService).findCircuitsByDriverSlug("max-verstappen");
    }

    @Test
    void getDriverSeasons_delegatesToService() {
        // Arrange
        List<Integer> seasons = List.of(2024, 2023, 2022);
        when(driverService.findSeasonsByDriverSlug("max-verstappen")).thenReturn(seasons);

        // Act
        ResponseEntity<List<Integer>> response = driverController.getDriverSeasons("max-verstappen");

        // Assert
        assertEquals(200, response.getStatusCode().value());
        assertEquals(3, response.getBody().size());
        assertEquals(2024, response.getBody().get(0));
        verify(driverService).findSeasonsByDriverSlug("max-verstappen");
    }
}

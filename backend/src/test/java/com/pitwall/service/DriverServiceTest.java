package com.pitwall.service;

import com.pitwall.dto.DriverDto;
import com.pitwall.dto.DriverResultDto;
import com.pitwall.exception.ResourceNotFoundException;
import com.pitwall.mapper.DriverMapper;
import com.pitwall.model.Circuit;
import com.pitwall.model.Driver;
import com.pitwall.model.Event;
import com.pitwall.model.Result;
import com.pitwall.model.Season;
import com.pitwall.model.Series;
import com.pitwall.model.Session;
import com.pitwall.model.Team;
import com.pitwall.repository.DriverRepository;
import com.pitwall.repository.ResultRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DriverServiceTest {

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private ResultRepository resultRepository;

    @Mock
    private DriverMapper driverMapper;

    @InjectMocks
    private DriverService driverService;

    @Test
    void findBySlug_whenExists_returnsDto() {
        // Arrange
        Driver driver = buildDriver(1L, "Max Verstappen", 1, "max-verstappen");
        DriverDto dto = new DriverDto(1L, "Max Verstappen", 1, "Red Bull Racing", "#3671C6", "Dutch", "max-verstappen");

        when(driverRepository.findBySlug("max-verstappen")).thenReturn(Optional.of(driver));
        when(driverMapper.toDto(driver)).thenReturn(dto);

        // Act
        DriverDto result = driverService.findBySlug("max-verstappen");

        // Assert
        assertNotNull(result);
        assertEquals(dto, result);
        verify(driverRepository).findBySlug("max-verstappen");
        verify(driverMapper).toDto(driver);
    }

    @Test
    void findBySlug_whenNotFound_throwsResourceNotFoundException() {
        // Arrange
        when(driverRepository.findBySlug("unknown-driver")).thenReturn(Optional.empty());

        // Act & Assert
        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> driverService.findBySlug("unknown-driver")
        );

        assertTrue(exception.getMessage().contains("Driver"));
        assertTrue(exception.getMessage().contains("unknown-driver"));
        verify(driverRepository).findBySlug("unknown-driver");
        verifyNoInteractions(driverMapper);
    }

    @Test
    void findBySeriesSlug_returnsMappedDrivers() {
        // Arrange
        Driver driver1 = buildDriver(1L, "Max Verstappen", 1, "max-verstappen");
        Driver driver2 = buildDriver(2L, "Sergio Perez", 11, "sergio-perez");
        List<Driver> drivers = List.of(driver1, driver2);

        DriverDto dto1 = new DriverDto(1L, "Max Verstappen", 1, "Red Bull Racing", "#3671C6", "Dutch", "max-verstappen");
        DriverDto dto2 = new DriverDto(2L, "Sergio Perez", 11, "Red Bull Racing", "#3671C6", "Mexican", "sergio-perez");

        when(driverRepository.findByTeamSeriesSlug("f1")).thenReturn(drivers);
        when(driverMapper.toDto(driver1)).thenReturn(dto1);
        when(driverMapper.toDto(driver2)).thenReturn(dto2);

        // Act
        List<DriverDto> result = driverService.findBySeriesSlug("f1");

        // Assert
        assertEquals(2, result.size());
        assertEquals(dto1, result.get(0));
        assertEquals(dto2, result.get(1));
        verify(driverRepository).findByTeamSeriesSlug("f1");
        verify(driverMapper).toDto(driver1);
        verify(driverMapper).toDto(driver2);
    }

    @Test
    void findAll_returnsMappedDrivers() {
        // Arrange
        Driver driver1 = buildDriver(1L, "Max Verstappen", 1, "max-verstappen");
        Driver driver2 = buildDriver(2L, "Sergio Perez", 11, "sergio-perez");

        DriverDto dto1 = new DriverDto(1L, "Max Verstappen", 1, "Red Bull Racing", "#3671C6", "Dutch", "max-verstappen");
        DriverDto dto2 = new DriverDto(2L, "Sergio Perez", 11, "Red Bull Racing", "#3671C6", "Mexican", "sergio-perez");

        when(driverRepository.findAll()).thenReturn(List.of(driver1, driver2));
        when(driverMapper.toDto(driver1)).thenReturn(dto1);
        when(driverMapper.toDto(driver2)).thenReturn(dto2);

        // Act
        List<DriverDto> result = driverService.findAll();

        // Assert
        assertEquals(2, result.size());
        assertEquals(dto1, result.get(0));
        assertEquals(dto2, result.get(1));
        verify(driverRepository).findAll();
    }

    @Test
    void findAll_whenEmpty_returnsEmptyList() {
        // Arrange
        when(driverRepository.findAll()).thenReturn(List.of());

        // Act
        List<DriverDto> result = driverService.findAll();

        // Assert
        assertTrue(result.isEmpty());
    }

    @Test
    void findResultsBySlug_withAllFilters_returnsMappedResults() {
        // Arrange
        Result raceResult = buildResult(1, "finished", "race");

        when(resultRepository.findFilteredResults("max-verstappen", 2024, "Silverstone", "race"))
                .thenReturn(List.of(raceResult));

        // Act
        List<DriverResultDto> results = driverService.findResultsBySlug(
                "max-verstappen", 2024, "Silverstone", "race");

        // Assert
        assertEquals(1, results.size());
        DriverResultDto dto = results.get(0);
        assertEquals("British Grand Prix", dto.eventName());
        assertEquals("british-gp-2024", dto.eventSlug());
        assertEquals("f1", dto.seriesSlug());
        assertEquals(1, dto.position());
        assertEquals("+0.5s", dto.gap());
        assertEquals("finished", dto.status());
        assertEquals(2024, dto.year());
        assertEquals("Silverstone", dto.circuitName());
        assertEquals("race", dto.sessionType());

        verify(resultRepository).findFilteredResults("max-verstappen", 2024, "Silverstone", "race");
    }

    @Test
    void findResultsBySlug_withNoFilters_passesNulls() {
        // Arrange
        when(resultRepository.findFilteredResults("max-verstappen", null, null, null))
                .thenReturn(List.of());

        // Act
        List<DriverResultDto> results = driverService.findResultsBySlug(
                "max-verstappen", null, null, null);

        // Assert
        assertTrue(results.isEmpty());
        verify(resultRepository).findFilteredResults("max-verstappen", null, null, null);
    }

    @Test
    void findResultsBySlug_mapsMultipleResults() {
        // Arrange
        Result result1 = buildResult(1, "finished", "race");
        Result result2 = buildResult(3, "finished", "qualifying");

        when(resultRepository.findFilteredResults("max-verstappen", 2024, null, null))
                .thenReturn(List.of(result1, result2));

        // Act
        List<DriverResultDto> results = driverService.findResultsBySlug(
                "max-verstappen", 2024, null, null);

        // Assert
        assertEquals(2, results.size());
        assertEquals(1, results.get(0).position());
        assertEquals(3, results.get(1).position());
    }

    @Test
    void findCircuitsByDriverSlug_returnsCircuitNames() {
        // Arrange
        List<String> circuits = List.of("Monza", "Silverstone", "Spa-Francorchamps");
        when(resultRepository.findDistinctCircuitNamesByDriverSlug("max-verstappen"))
                .thenReturn(circuits);

        // Act
        List<String> result = driverService.findCircuitsByDriverSlug("max-verstappen");

        // Assert
        assertEquals(3, result.size());
        assertEquals("Monza", result.get(0));
        assertEquals("Silverstone", result.get(1));
        assertEquals("Spa-Francorchamps", result.get(2));
        verify(resultRepository).findDistinctCircuitNamesByDriverSlug("max-verstappen");
    }

    @Test
    void findCircuitsByDriverSlug_whenNoResults_returnsEmptyList() {
        // Arrange
        when(resultRepository.findDistinctCircuitNamesByDriverSlug("unknown"))
                .thenReturn(List.of());

        // Act
        List<String> result = driverService.findCircuitsByDriverSlug("unknown");

        // Assert
        assertTrue(result.isEmpty());
    }

    @Test
    void findSeasonsByDriverSlug_returnsSeasonsDescending() {
        // Arrange
        List<Integer> seasons = List.of(2024, 2023, 2022);
        when(resultRepository.findDistinctSeasonsByDriverSlug("max-verstappen"))
                .thenReturn(seasons);

        // Act
        List<Integer> result = driverService.findSeasonsByDriverSlug("max-verstappen");

        // Assert
        assertEquals(3, result.size());
        assertEquals(2024, result.get(0));
        assertEquals(2023, result.get(1));
        assertEquals(2022, result.get(2));
        verify(resultRepository).findDistinctSeasonsByDriverSlug("max-verstappen");
    }

    @Test
    void findSeasonsByDriverSlug_whenNoResults_returnsEmptyList() {
        // Arrange
        when(resultRepository.findDistinctSeasonsByDriverSlug("unknown"))
                .thenReturn(List.of());

        // Act
        List<Integer> result = driverService.findSeasonsByDriverSlug("unknown");

        // Assert
        assertTrue(result.isEmpty());
    }

    private Driver buildDriver(Long id, String name, Integer number, String slug) {
        Team team = new Team();
        team.setId(1L);
        team.setName("Red Bull Racing");
        team.setColor("#3671C6");

        Driver driver = new Driver();
        driver.setId(id);
        driver.setName(name);
        driver.setNumber(number);
        driver.setSlug(slug);
        driver.setNationality("Dutch");
        driver.setTeam(team);
        return driver;
    }

    private Result buildResult(int position, String status, String sessionType) {
        Series series = new Series();
        series.setId(1L);
        series.setSlug("f1");

        Season season = new Season();
        season.setId(1L);
        season.setYear(2024);
        season.setSeries(series);

        Circuit circuit = new Circuit();
        circuit.setId(1L);
        circuit.setName("Silverstone");

        Event event = new Event();
        event.setId(1L);
        event.setName("British Grand Prix");
        event.setSlug("british-gp-2024");
        event.setStartDate(LocalDate.of(2024, 7, 7));
        event.setSeason(season);
        event.setCircuit(circuit);

        Session session = new Session();
        session.setId(1L);
        session.setType(sessionType);
        session.setEvent(event);

        Result result = new Result();
        result.setId(1L);
        result.setPosition(position);
        result.setGap("+0.5s");
        result.setStatus(status);
        result.setSession(session);

        return result;
    }
}

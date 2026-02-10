package com.pitwall.service;

import com.pitwall.dto.DriverDto;
import com.pitwall.exception.ResourceNotFoundException;
import com.pitwall.mapper.DriverMapper;
import com.pitwall.model.Driver;
import com.pitwall.model.Team;
import com.pitwall.repository.DriverRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DriverServiceTest {

    @Mock
    private DriverRepository driverRepository;

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
}

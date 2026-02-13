package com.pitwall.service;

import com.pitwall.dto.ConstructorStandingDto;
import com.pitwall.dto.StandingDto;
import com.pitwall.model.ConstructorStanding;
import com.pitwall.model.Driver;
import com.pitwall.model.DriverStanding;
import com.pitwall.model.Season;
import com.pitwall.model.Series;
import com.pitwall.model.Team;
import com.pitwall.repository.ConstructorStandingRepository;
import com.pitwall.repository.DriverStandingRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StandingsServiceTest {

    @Mock
    private DriverStandingRepository driverStandingRepository;

    @Mock
    private ConstructorStandingRepository constructorStandingRepository;

    @InjectMocks
    private StandingsService standingsService;

    @Test
    void findDriverStandings_returnsStandingsForSeriesAndYear() {
        // Arrange
        DriverStanding standing = buildDriverStanding(1, "Max Verstappen", "max-verstappen", 1, "Red Bull Racing", "#3671C6", 575.0, 19);

        when(driverStandingRepository.findBySeasonSeriesSlugAndSeasonYearOrderByPositionAsc("f1", 2025))
                .thenReturn(List.of(standing));

        // Act
        List<StandingDto> result = standingsService.findDriverStandings("f1", 2025);

        // Assert
        assertEquals(1, result.size());
        StandingDto dto = result.get(0);
        assertEquals(1, dto.position());
        assertEquals("Max Verstappen", dto.driverName());
        assertEquals("max-verstappen", dto.driverSlug());
        assertEquals(1, dto.driverNumber());
        assertEquals("Red Bull Racing", dto.teamName());
        assertEquals("#3671C6", dto.teamColor());
        assertEquals(575.0, dto.points());
        assertEquals(19, dto.wins());
    }

    @Test
    void findDriverStandings_whenNoneExist_returnsEmptyList() {
        // Arrange
        when(driverStandingRepository.findBySeasonSeriesSlugAndSeasonYearOrderByPositionAsc("f1", 2030))
                .thenReturn(Collections.emptyList());

        // Act
        List<StandingDto> result = standingsService.findDriverStandings("f1", 2030);

        // Assert
        assertTrue(result.isEmpty());
    }

    @Test
    void findConstructorStandings_returnsStandingsForSeriesAndYear() {
        // Arrange
        ConstructorStanding standing = buildConstructorStanding(1, "Red Bull Racing", "#3671C6", 860.0, 21);

        when(constructorStandingRepository.findBySeasonSeriesSlugAndSeasonYearOrderByPositionAsc("f1", 2025))
                .thenReturn(List.of(standing));

        // Act
        List<ConstructorStandingDto> result = standingsService.findConstructorStandings("f1", 2025);

        // Assert
        assertEquals(1, result.size());
        ConstructorStandingDto dto = result.get(0);
        assertEquals(1, dto.position());
        assertEquals("Red Bull Racing", dto.teamName());
        assertEquals("#3671C6", dto.teamColor());
        assertEquals(860.0, dto.points());
        assertEquals(21, dto.wins());
    }

    @Test
    void findConstructorStandings_whenNoneExist_returnsEmptyList() {
        // Arrange
        when(constructorStandingRepository.findBySeasonSeriesSlugAndSeasonYearOrderByPositionAsc("f1", 2030))
                .thenReturn(Collections.emptyList());

        // Act
        List<ConstructorStandingDto> result = standingsService.findConstructorStandings("f1", 2030);

        // Assert
        assertTrue(result.isEmpty());
    }

    private DriverStanding buildDriverStanding(int position, String driverName, String driverSlug,
                                                int driverNumber, String teamName, String teamColor,
                                                double points, int wins) {
        Series series = new Series();
        series.setId(1L);
        series.setName("Formula 1");
        series.setSlug("f1");
        series.setColorPrimary("#E10600");

        Season season = new Season();
        season.setId(1L);
        season.setSeries(series);
        season.setYear(2025);

        Team team = new Team();
        team.setId(1L);
        team.setName(teamName);
        team.setShortName(teamName);
        team.setColor(teamColor);

        Driver driver = new Driver();
        driver.setId(1L);
        driver.setName(driverName);
        driver.setSlug(driverSlug);
        driver.setNumber(driverNumber);
        driver.setTeam(team);

        DriverStanding standing = new DriverStanding();
        standing.setId(1L);
        standing.setSeason(season);
        standing.setDriver(driver);
        standing.setPosition(position);
        standing.setPoints(BigDecimal.valueOf(points));
        standing.setWins(wins);
        return standing;
    }

    private ConstructorStanding buildConstructorStanding(int position, String teamName, String teamColor,
                                                          double points, int wins) {
        Series series = new Series();
        series.setId(1L);
        series.setName("Formula 1");
        series.setSlug("f1");
        series.setColorPrimary("#E10600");

        Season season = new Season();
        season.setId(1L);
        season.setSeries(series);
        season.setYear(2025);

        Team team = new Team();
        team.setId(1L);
        team.setName(teamName);
        team.setShortName(teamName);
        team.setColor(teamColor);

        ConstructorStanding standing = new ConstructorStanding();
        standing.setId(1L);
        standing.setSeason(season);
        standing.setTeam(team);
        standing.setPosition(position);
        standing.setPoints(BigDecimal.valueOf(points));
        standing.setWins(wins);
        return standing;
    }
}

package com.pitwall.service;

import com.pitwall.dto.ConstructorStandingDto;
import com.pitwall.dto.StandingDto;
import com.pitwall.model.ConstructorStanding;
import com.pitwall.model.Driver;
import com.pitwall.model.DriverStanding;
import com.pitwall.model.Team;
import com.pitwall.repository.ConstructorStandingRepository;
import com.pitwall.repository.DriverStandingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class StandingsService {

    private final DriverStandingRepository driverStandingRepository;
    private final ConstructorStandingRepository constructorStandingRepository;

    public StandingsService(DriverStandingRepository driverStandingRepository,
                            ConstructorStandingRepository constructorStandingRepository) {
        this.driverStandingRepository = driverStandingRepository;
        this.constructorStandingRepository = constructorStandingRepository;
    }

    public List<StandingDto> findDriverStandings(String seriesSlug, int year) {
        return driverStandingRepository
                .findBySeasonSeriesSlugAndSeasonYearOrderByPositionAsc(seriesSlug, year)
                .stream()
                .map(this::toDriverStandingDto)
                .toList();
    }

    public List<ConstructorStandingDto> findConstructorStandings(String seriesSlug, int year) {
        return constructorStandingRepository
                .findBySeasonSeriesSlugAndSeasonYearOrderByPositionAsc(seriesSlug, year)
                .stream()
                .map(this::toConstructorStandingDto)
                .toList();
    }

    private StandingDto toDriverStandingDto(DriverStanding standing) {
        Driver driver = standing.getDriver();
        Team team = driver.getTeam();
        return new StandingDto(
                standing.getPosition(),
                driver.getName(),
                driver.getSlug(),
                driver.getNumber(),
                team != null ? team.getName() : null,
                team != null ? team.getColor() : null,
                standing.getPoints().doubleValue(),
                standing.getWins()
        );
    }

    private ConstructorStandingDto toConstructorStandingDto(ConstructorStanding standing) {
        Team team = standing.getTeam();
        return new ConstructorStandingDto(
                standing.getPosition(),
                team.getName(),
                team.getColor(),
                standing.getPoints().doubleValue(),
                standing.getWins()
        );
    }
}

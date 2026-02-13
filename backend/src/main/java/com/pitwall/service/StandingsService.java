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

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

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

    public List<StandingDto> findDriverStandings(String seriesSlug, int year, String className) {
        List<DriverStanding> standings = (className != null && !className.isBlank())
                ? driverStandingRepository.findBySeasonSeriesSlugAndSeasonYearAndClassNameOrderByPositionAsc(seriesSlug, year, className)
                : driverStandingRepository.findBySeasonSeriesSlugAndSeasonYearOrderByPositionAsc(seriesSlug, year);
        return standings.stream().map(this::toDriverStandingDto).toList();
    }

    public List<StandingDto> findDriverStandings(String seriesSlug, int year) {
        return findDriverStandings(seriesSlug, year, null);
    }

    public List<ConstructorStandingDto> findConstructorStandings(String seriesSlug, int year, String className) {
        List<ConstructorStanding> standings = (className != null && !className.isBlank())
                ? constructorStandingRepository.findBySeasonSeriesSlugAndSeasonYearAndClassNameOrderByPositionAsc(seriesSlug, year, className)
                : constructorStandingRepository.findBySeasonSeriesSlugAndSeasonYearOrderByPositionAsc(seriesSlug, year);
        return standings.stream().map(this::toConstructorStandingDto).toList();
    }

    public List<ConstructorStandingDto> findConstructorStandings(String seriesSlug, int year) {
        return findConstructorStandings(seriesSlug, year, null);
    }

    public List<String> findAvailableClasses(String seriesSlug, int year) {
        Set<String> classes = new LinkedHashSet<>();
        classes.addAll(driverStandingRepository.findDistinctClassNamesBySeason(seriesSlug, year));
        classes.addAll(constructorStandingRepository.findDistinctClassNamesBySeason(seriesSlug, year));
        return classes.stream().filter(name -> name != null && !name.isBlank()).toList();
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
                standing.getClassName(),
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
                standing.getClassName(),
                standing.getPoints().doubleValue(),
                standing.getWins()
        );
    }
}

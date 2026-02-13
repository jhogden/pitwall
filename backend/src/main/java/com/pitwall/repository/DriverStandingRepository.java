package com.pitwall.repository;

import com.pitwall.model.DriverStanding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DriverStandingRepository extends JpaRepository<DriverStanding, Long> {

    List<DriverStanding> findBySeasonSeriesSlugAndSeasonYearOrderByPositionAsc(String slug, int year);

    List<DriverStanding> findBySeasonSeriesSlugAndSeasonYearAndClassNameOrderByPositionAsc(
            String slug, int year, String className);

    @Query("select distinct ds.className from DriverStanding ds where ds.season.series.slug = ?1 and ds.season.year = ?2 order by ds.className")
    List<String> findDistinctClassNamesBySeason(String slug, int year);
}

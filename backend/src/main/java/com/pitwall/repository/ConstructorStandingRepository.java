package com.pitwall.repository;

import com.pitwall.model.ConstructorStanding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConstructorStandingRepository extends JpaRepository<ConstructorStanding, Long> {

    List<ConstructorStanding> findBySeasonSeriesSlugAndSeasonYearOrderByPositionAsc(String slug, int year);

    List<ConstructorStanding> findBySeasonSeriesSlugAndSeasonYearAndClassNameOrderByPositionAsc(
            String slug, int year, String className);

    @Query("select distinct cs.className from ConstructorStanding cs where cs.season.series.slug = ?1 and cs.season.year = ?2 order by cs.className")
    List<String> findDistinctClassNamesBySeason(String slug, int year);
}

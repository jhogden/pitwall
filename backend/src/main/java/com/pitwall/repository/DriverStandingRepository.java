package com.pitwall.repository;

import com.pitwall.model.DriverStanding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DriverStandingRepository extends JpaRepository<DriverStanding, Long> {

    List<DriverStanding> findBySeasonSeriesSlugAndSeasonYearOrderByPositionAsc(String slug, int year);
}

package com.pitwall.repository;

import com.pitwall.model.ConstructorStanding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConstructorStandingRepository extends JpaRepository<ConstructorStanding, Long> {

    List<ConstructorStanding> findBySeasonSeriesSlugAndSeasonYearOrderByPositionAsc(String slug, int year);
}

package com.pitwall.repository;

import com.pitwall.model.Season;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SeasonRepository extends JpaRepository<Season, Long> {

    Optional<Season> findBySeriesIdAndYear(Long seriesId, int year);

    List<Season> findBySeriesSlug(String slug);
}

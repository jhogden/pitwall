package com.pitwall.repository;

import com.pitwall.model.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {

    List<Team> findBySeriesId(Long seriesId);

    List<Team> findBySeriesSlug(String slug);
}

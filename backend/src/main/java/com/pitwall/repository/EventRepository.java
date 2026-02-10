package com.pitwall.repository;

import com.pitwall.model.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findBySeasonSeriesSlugAndStatusOrderByStartDate(String slug, String status);

    Optional<Event> findBySlug(String slug);

    List<Event> findByStatusOrderByStartDate(String status);

    List<Event> findByStartDateBetweenOrderByStartDate(LocalDate start, LocalDate end);

    List<Event> findBySeasonSeriesSlugOrderByStartDate(String seriesSlug);
}

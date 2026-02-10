package com.pitwall.repository;

import com.pitwall.model.Driver;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DriverRepository extends JpaRepository<Driver, Long> {

    Optional<Driver> findBySlug(String slug);

    List<Driver> findByTeamSeriesSlug(String seriesSlug);
}

package com.pitwall.repository;

import com.pitwall.model.LapTelemetry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LapTelemetryRepository extends JpaRepository<LapTelemetry, Long> {

    List<LapTelemetry> findBySessionIdOrderByLapNumberAscPositionAsc(Long sessionId);
}

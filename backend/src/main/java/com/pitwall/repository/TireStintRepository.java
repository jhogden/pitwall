package com.pitwall.repository;

import com.pitwall.model.TireStint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TireStintRepository extends JpaRepository<TireStint, Long> {

    List<TireStint> findBySessionIdOrderByDriverIdAscStintNumberAsc(Long sessionId);
}

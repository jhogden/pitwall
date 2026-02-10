package com.pitwall.repository;

import com.pitwall.model.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SessionRepository extends JpaRepository<Session, Long> {

    List<Session> findByEventIdOrderByStartTime(Long eventId);

    List<Session> findByEventSlug(String slug);
}

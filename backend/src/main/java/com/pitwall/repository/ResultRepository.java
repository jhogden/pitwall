package com.pitwall.repository;

import com.pitwall.model.Result;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResultRepository extends JpaRepository<Result, Long> {

    List<Result> findBySessionIdOrderByPosition(Long sessionId);

    List<Result> findBySessionIdAndClassNameOrderByPosition(Long sessionId, String className);

    @Query("select distinct r.className from Result r where r.session.id = ?1 order by r.className")
    List<String> findDistinctClassNamesBySessionId(Long sessionId);

    List<Result> findByDriverIdOrderBySessionStartTimeDesc(Long driverId);

    List<Result> findByDriverSlugAndSessionTypeAndSessionEventSeasonYearOrderBySessionStartTimeAsc(
            String slug, String sessionType, int year);

    List<Result> findByDriverSlugAndSessionTypeOrderBySessionStartTimeDesc(
            String slug, String sessionType);
}

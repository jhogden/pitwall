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

    @Query("SELECT r FROM Result r " +
           "JOIN FETCH r.session s " +
           "JOIN FETCH s.event e " +
           "JOIN FETCH e.circuit " +
           "JOIN FETCH e.season se " +
           "JOIN FETCH se.series " +
           "WHERE r.driver.slug = :slug " +
           "AND (:year IS NULL OR se.year = :year) " +
           "AND (:circuitName IS NULL OR e.circuit.name = :circuitName) " +
           "AND (:sessionType IS NULL OR s.type = :sessionType) " +
           "ORDER BY s.startTime ASC")
    List<Result> findFilteredResults(
            @org.springframework.data.repository.query.Param("slug") String slug,
            @org.springframework.data.repository.query.Param("year") Integer year,
            @org.springframework.data.repository.query.Param("circuitName") String circuitName,
            @org.springframework.data.repository.query.Param("sessionType") String sessionType);

    @Query("SELECT DISTINCT e.circuit.name FROM Result r " +
           "JOIN r.session s " +
           "JOIN s.event e " +
           "WHERE r.driver.slug = :slug " +
           "ORDER BY e.circuit.name")
    List<String> findDistinctCircuitNamesByDriverSlug(
            @org.springframework.data.repository.query.Param("slug") String slug);

    @Query("SELECT DISTINCT se.year FROM Result r " +
           "JOIN r.session s " +
           "JOIN s.event e " +
           "JOIN e.season se " +
           "WHERE r.driver.slug = :slug " +
           "ORDER BY se.year DESC")
    List<Integer> findDistinctSeasonsByDriverSlug(
            @org.springframework.data.repository.query.Param("slug") String slug);
}

package com.pitwall.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "tire_stints")
public class TireStint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private Session session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id")
    private Driver driver;

    @Column(name = "stint_number")
    private Integer stintNumber;

    @Column(name = "compound")
    private String compound;

    @Column(name = "lap_start")
    private Integer lapStart;

    @Column(name = "lap_end")
    private Integer lapEnd;

    @Column(name = "tyre_age_at_start")
    private Integer tyreAgeAtStart;

    @Column(name = "is_new_tyre")
    private Boolean isNewTyre;

    @Column(name = "source")
    private String source;

    @Column(name = "created_at")
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public Session getSession() {
        return session;
    }

    public Driver getDriver() {
        return driver;
    }

    public Integer getStintNumber() {
        return stintNumber;
    }

    public String getCompound() {
        return compound;
    }

    public Integer getLapStart() {
        return lapStart;
    }

    public Integer getLapEnd() {
        return lapEnd;
    }

    public Integer getTyreAgeAtStart() {
        return tyreAgeAtStart;
    }

    public Boolean getIsNewTyre() {
        return isNewTyre;
    }

    public String getSource() {
        return source;
    }
}

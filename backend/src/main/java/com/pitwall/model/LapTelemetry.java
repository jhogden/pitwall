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
@Table(name = "lap_telemetry")
public class LapTelemetry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private Session session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id")
    private Driver driver;

    @Column(name = "car_number")
    private String carNumber;

    @Column(name = "lap_number")
    private Integer lapNumber;

    @Column(name = "position")
    private Integer position;

    @Column(name = "lap_time")
    private String lapTime;

    @Column(name = "sector1_time")
    private String sector1Time;

    @Column(name = "sector2_time")
    private String sector2Time;

    @Column(name = "sector3_time")
    private String sector3Time;

    @Column(name = "sector4_time")
    private String sector4Time;

    @Column(name = "average_speed_kph")
    private String averageSpeedKph;

    @Column(name = "top_speed_kph")
    private String topSpeedKph;

    @Column(name = "session_elapsed")
    private String sessionElapsed;

    @Column(name = "lap_timestamp")
    private Instant lapTimestamp;

    @Column(name = "is_valid")
    private Boolean isValid;

    @Column(name = "crossing_pit_finish_lane")
    private Boolean crossingPitFinishLane;

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

    public String getCarNumber() {
        return carNumber;
    }

    public Integer getLapNumber() {
        return lapNumber;
    }

    public Integer getPosition() {
        return position;
    }

    public String getLapTime() {
        return lapTime;
    }

    public String getSector1Time() {
        return sector1Time;
    }

    public String getSector2Time() {
        return sector2Time;
    }

    public String getSector3Time() {
        return sector3Time;
    }

    public String getSector4Time() {
        return sector4Time;
    }

    public String getAverageSpeedKph() {
        return averageSpeedKph;
    }

    public String getTopSpeedKph() {
        return topSpeedKph;
    }

    public String getSessionElapsed() {
        return sessionElapsed;
    }

    public Instant getLapTimestamp() {
        return lapTimestamp;
    }

    public Boolean getIsValid() {
        return isValid;
    }

    public Boolean getCrossingPitFinishLane() {
        return crossingPitFinishLane;
    }
}

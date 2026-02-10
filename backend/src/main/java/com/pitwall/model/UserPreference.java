package com.pitwall.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_preferences")
public class UserPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "followed_series", columnDefinition = "jsonb")
    private String followedSeries;

    @Column(name = "followed_teams", columnDefinition = "jsonb")
    private String followedTeams;

    @Column(name = "followed_drivers", columnDefinition = "jsonb")
    private String followedDrivers;

    public UserPreference() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getFollowedSeries() {
        return followedSeries;
    }

    public void setFollowedSeries(String followedSeries) {
        this.followedSeries = followedSeries;
    }

    public String getFollowedTeams() {
        return followedTeams;
    }

    public void setFollowedTeams(String followedTeams) {
        this.followedTeams = followedTeams;
    }

    public String getFollowedDrivers() {
        return followedDrivers;
    }

    public void setFollowedDrivers(String followedDrivers) {
        this.followedDrivers = followedDrivers;
    }
}

package com.pitwall.service;

import com.pitwall.dto.TeamDto;
import com.pitwall.model.Team;
import com.pitwall.repository.TeamRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TeamService {

    private final TeamRepository teamRepository;

    public TeamService(TeamRepository teamRepository) {
        this.teamRepository = teamRepository;
    }

    public List<TeamDto> findBySeriesSlug(String seriesSlug) {
        return teamRepository.findBySeriesSlug(seriesSlug).stream()
                .map(this::toDto)
                .toList();
    }

    private TeamDto toDto(Team team) {
        return new TeamDto(
                team.getId(),
                team.getName(),
                team.getShortName(),
                team.getColor(),
                team.getSeries().getSlug()
        );
    }
}

package com.pitwall.controller;

import com.pitwall.dto.TeamDto;
import com.pitwall.service.TeamService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/teams")
public class TeamController {

    private final TeamService teamService;

    public TeamController(TeamService teamService) {
        this.teamService = teamService;
    }

    @GetMapping("/{seriesSlug}")
    public ResponseEntity<List<TeamDto>> getTeamsBySeriesSlug(@PathVariable String seriesSlug) {
        return ResponseEntity.ok(teamService.findBySeriesSlug(seriesSlug));
    }
}

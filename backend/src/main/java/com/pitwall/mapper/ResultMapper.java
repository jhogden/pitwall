package com.pitwall.mapper;

import com.pitwall.dto.ResultDto;
import com.pitwall.model.Driver;
import com.pitwall.model.Result;
import com.pitwall.model.Team;
import org.springframework.stereotype.Component;

@Component
public class ResultMapper {

    public ResultDto toDto(Result result) {
        Driver driver = result.getDriver();
        Team team = driver.getTeam();
        return new ResultDto(
                result.getId(),
                result.getPosition(),
                driver.getName(),
                driver.getNumber(),
                team != null ? team.getName() : null,
                team != null ? team.getColor() : null,
                result.getTime(),
                result.getLaps(),
                result.getGap(),
                result.getStatus()
        );
    }
}

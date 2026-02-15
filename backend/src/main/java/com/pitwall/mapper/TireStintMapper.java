package com.pitwall.mapper;

import com.pitwall.dto.TireStintDto;
import com.pitwall.model.Driver;
import com.pitwall.model.Team;
import com.pitwall.model.TireStint;
import org.springframework.stereotype.Component;

@Component
public class TireStintMapper {

    public TireStintDto toDto(TireStint stint) {
        Driver driver = stint.getDriver();
        Team team = driver != null ? driver.getTeam() : null;
        return new TireStintDto(
                stint.getId(),
                stint.getStintNumber(),
                stint.getCompound(),
                stint.getLapStart(),
                stint.getLapEnd(),
                stint.getTyreAgeAtStart(),
                stint.getIsNewTyre(),
                stint.getSource(),
                driver != null ? driver.getName() : null,
                driver != null ? driver.getNumber() : null,
                team != null ? team.getName() : null,
                team != null ? team.getColor() : null
        );
    }
}

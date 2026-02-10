package com.pitwall.mapper;

import com.pitwall.dto.DriverDto;
import com.pitwall.model.Driver;
import com.pitwall.model.Team;
import org.springframework.stereotype.Component;

@Component
public class DriverMapper {

    public DriverDto toDto(Driver driver) {
        Team team = driver.getTeam();
        return new DriverDto(
                driver.getId(),
                driver.getName(),
                driver.getNumber(),
                team != null ? team.getName() : null,
                team != null ? team.getColor() : null,
                driver.getNationality(),
                driver.getSlug()
        );
    }
}

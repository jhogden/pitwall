package com.pitwall.mapper;

import com.pitwall.dto.CircuitDto;
import com.pitwall.model.Circuit;
import org.springframework.stereotype.Component;

@Component
public class CircuitMapper {

    public CircuitDto toDto(Circuit circuit) {
        return new CircuitDto(
                circuit.getId(),
                circuit.getName(),
                circuit.getCountry(),
                circuit.getCity(),
                circuit.getTrackMapUrl(),
                circuit.getTimezone()
        );
    }
}

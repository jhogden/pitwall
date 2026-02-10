package com.pitwall.mapper;

import com.pitwall.dto.SeriesDto;
import com.pitwall.model.Series;
import org.springframework.stereotype.Component;

@Component
public class SeriesMapper {

    public SeriesDto toDto(Series series) {
        return new SeriesDto(
                series.getId(),
                series.getName(),
                series.getSlug(),
                series.getColorPrimary(),
                series.getColorSecondary(),
                series.getLogoUrl()
        );
    }
}

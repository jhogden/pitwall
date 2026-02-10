package com.pitwall.service;

import com.pitwall.dto.SeriesDto;
import com.pitwall.exception.ResourceNotFoundException;
import com.pitwall.mapper.SeriesMapper;
import com.pitwall.model.Series;
import com.pitwall.repository.SeriesRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SeriesServiceTest {

    @Mock
    private SeriesRepository seriesRepository;

    @Mock
    private SeriesMapper seriesMapper;

    @InjectMocks
    private SeriesService seriesService;

    @Test
    void findAll_returnsAllSeriesMappedToDto() {
        // Arrange
        Series f1 = buildSeries(1L, "Formula 1", "f1", "#E10600");
        Series fe = buildSeries(2L, "Formula E", "fe", "#00A3E0");
        List<Series> entities = List.of(f1, fe);

        SeriesDto f1Dto = new SeriesDto(1L, "Formula 1", "f1", "#E10600", "#FFFFFF", null);
        SeriesDto feDto = new SeriesDto(2L, "Formula E", "fe", "#00A3E0", "#FFFFFF", null);

        when(seriesRepository.findAll()).thenReturn(entities);
        when(seriesMapper.toDto(f1)).thenReturn(f1Dto);
        when(seriesMapper.toDto(fe)).thenReturn(feDto);

        // Act
        List<SeriesDto> result = seriesService.findAll();

        // Assert
        assertEquals(2, result.size());
        assertEquals(f1Dto, result.get(0));
        assertEquals(feDto, result.get(1));
        verify(seriesRepository).findAll();
        verify(seriesMapper).toDto(f1);
        verify(seriesMapper).toDto(fe);
    }

    @Test
    void findBySlug_whenExists_returnsDto() {
        // Arrange
        Series series = buildSeries(1L, "Formula 1", "f1", "#E10600");
        SeriesDto dto = new SeriesDto(1L, "Formula 1", "f1", "#E10600", "#FFFFFF", null);

        when(seriesRepository.findBySlug("f1")).thenReturn(Optional.of(series));
        when(seriesMapper.toDto(series)).thenReturn(dto);

        // Act
        SeriesDto result = seriesService.findBySlug("f1");

        // Assert
        assertNotNull(result);
        assertEquals(dto, result);
        verify(seriesRepository).findBySlug("f1");
        verify(seriesMapper).toDto(series);
    }

    @Test
    void findBySlug_whenNotFound_throwsResourceNotFoundException() {
        // Arrange
        when(seriesRepository.findBySlug("unknown")).thenReturn(Optional.empty());

        // Act & Assert
        ResourceNotFoundException exception = assertThrows(
                ResourceNotFoundException.class,
                () -> seriesService.findBySlug("unknown")
        );

        assertTrue(exception.getMessage().contains("Series"));
        assertTrue(exception.getMessage().contains("unknown"));
        verify(seriesRepository).findBySlug("unknown");
        verifyNoInteractions(seriesMapper);
    }

    private Series buildSeries(Long id, String name, String slug, String color) {
        Series series = new Series();
        series.setId(id);
        series.setName(name);
        series.setSlug(slug);
        series.setColorPrimary(color);
        series.setColorSecondary("#FFFFFF");
        return series;
    }
}

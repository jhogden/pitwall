package com.pitwall.service;

import com.pitwall.dto.TireStintDto;
import com.pitwall.mapper.TireStintMapper;
import com.pitwall.model.TireStint;
import com.pitwall.repository.TireStintRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TireStintServiceTest {

    @Mock
    private TireStintRepository tireStintRepository;

    @Mock
    private TireStintMapper tireStintMapper;

    @InjectMocks
    private TireStintService tireStintService;

    @Test
    void findBySessionId_mapsRepositoryRows() {
        TireStint s1 = org.mockito.Mockito.mock(TireStint.class);
        TireStint s2 = org.mockito.Mockito.mock(TireStint.class);
        TireStintDto d1 = new TireStintDto(1L, 1, "SOFT", 1, 12, 0, true, "fastf1", "Driver A", 1, "Team A", "#111111");
        TireStintDto d2 = new TireStintDto(2L, 2, "MEDIUM", 13, 28, 4, false, "fastf1", "Driver A", 1, "Team A", "#111111");

        when(tireStintRepository.findBySessionIdOrderByDriverIdAscStintNumberAsc(99L)).thenReturn(List.of(s1, s2));
        when(tireStintMapper.toDto(s1)).thenReturn(d1);
        when(tireStintMapper.toDto(s2)).thenReturn(d2);

        List<TireStintDto> result = tireStintService.findBySessionId(99L);

        assertEquals(2, result.size());
        assertEquals("SOFT", result.get(0).compound());
        assertEquals("MEDIUM", result.get(1).compound());
        verify(tireStintRepository).findBySessionIdOrderByDriverIdAscStintNumberAsc(99L);
    }
}

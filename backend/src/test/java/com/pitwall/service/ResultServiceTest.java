package com.pitwall.service;

import com.pitwall.dto.ResultDto;
import com.pitwall.mapper.ResultMapper;
import com.pitwall.model.Driver;
import com.pitwall.model.Result;
import com.pitwall.model.Team;
import com.pitwall.repository.ResultRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResultServiceTest {

    @Mock
    private ResultRepository resultRepository;

    @Mock
    private ResultMapper resultMapper;

    @InjectMocks
    private ResultService resultService;

    @Test
    void findBySessionId_returnsMappedResults() {
        // Arrange
        Long sessionId = 10L;
        Result result1 = buildResult(1L, 1, "Max Verstappen");
        Result result2 = buildResult(2L, 2, "Lewis Hamilton");
        List<Result> results = List.of(result1, result2);

        ResultDto dto1 = new ResultDto(1L, 1, "Max Verstappen", 1, "Red Bull Racing", "#3671C6", "1:32:45.123", 57, null, "finished");
        ResultDto dto2 = new ResultDto(2L, 2, "Lewis Hamilton", 44, "Mercedes", "#27F4D2", "1:32:50.456", 57, "+5.333", "finished");

        when(resultRepository.findBySessionIdOrderByPosition(sessionId)).thenReturn(results);
        when(resultMapper.toDto(result1)).thenReturn(dto1);
        when(resultMapper.toDto(result2)).thenReturn(dto2);

        // Act
        List<ResultDto> resultDtos = resultService.findBySessionId(sessionId);

        // Assert
        assertEquals(2, resultDtos.size());
        assertEquals(dto1, resultDtos.get(0));
        assertEquals(dto2, resultDtos.get(1));
        verify(resultRepository).findBySessionIdOrderByPosition(sessionId);
        verify(resultMapper).toDto(result1);
        verify(resultMapper).toDto(result2);
    }

    @Test
    void findBySessionId_whenNoResults_returnsEmptyList() {
        // Arrange
        Long sessionId = 99L;
        when(resultRepository.findBySessionIdOrderByPosition(sessionId)).thenReturn(Collections.emptyList());

        // Act
        List<ResultDto> resultDtos = resultService.findBySessionId(sessionId);

        // Assert
        assertTrue(resultDtos.isEmpty());
        verify(resultRepository).findBySessionIdOrderByPosition(sessionId);
        verifyNoInteractions(resultMapper);
    }

    private Result buildResult(Long id, int position, String driverName) {
        Team team = new Team();
        team.setName("Red Bull Racing");
        team.setColor("#3671C6");

        Driver driver = new Driver();
        driver.setName(driverName);
        driver.setNumber(1);
        driver.setTeam(team);

        Result result = new Result();
        result.setId(id);
        result.setPosition(position);
        result.setDriver(driver);
        result.setStatus("finished");
        return result;
    }
}

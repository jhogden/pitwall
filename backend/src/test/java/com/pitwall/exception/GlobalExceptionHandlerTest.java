package com.pitwall.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handleNotFound_returns404WithMessage() {
        // Arrange
        ResourceNotFoundException exception = new ResourceNotFoundException("Series", "f1");

        // Act
        ResponseEntity<ApiError> response = handler.handleNotFound(exception);

        // Assert
        assertEquals(404, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(404, response.getBody().status());
        assertEquals("Not Found", response.getBody().error());
        assertTrue(response.getBody().message().contains("Series"));
        assertTrue(response.getBody().message().contains("f1"));
        assertNotNull(response.getBody().timestamp());
    }

    @Test
    void handleDuplicate_returns409WithMessage() {
        // Arrange
        DuplicateResourceException exception = new DuplicateResourceException("User", "test@example.com");

        // Act
        ResponseEntity<ApiError> response = handler.handleDuplicate(exception);

        // Assert
        assertEquals(409, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(409, response.getBody().status());
        assertEquals("Conflict", response.getBody().error());
        assertTrue(response.getBody().message().contains("User"));
        assertTrue(response.getBody().message().contains("test@example.com"));
        assertNotNull(response.getBody().timestamp());
    }

    @Test
    void handleInvalidCredentials_returns401() {
        // Arrange
        InvalidCredentialsException exception = new InvalidCredentialsException();

        // Act
        ResponseEntity<ApiError> response = handler.handleInvalidCredentials(exception);

        // Assert
        assertEquals(401, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(401, response.getBody().status());
        assertEquals("Unauthorized", response.getBody().error());
        assertEquals("Invalid email or password", response.getBody().message());
        assertNotNull(response.getBody().timestamp());
    }
}

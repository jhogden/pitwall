package com.pitwall.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pitwall.dto.AuthRequest;
import com.pitwall.dto.AuthResponse;
import com.pitwall.dto.RegisterRequest;
import com.pitwall.dto.UserPreferenceDto;
import com.pitwall.exception.DuplicateResourceException;
import com.pitwall.exception.InvalidCredentialsException;
import com.pitwall.exception.ResourceNotFoundException;
import com.pitwall.model.User;
import com.pitwall.model.UserPreference;
import com.pitwall.repository.UserPreferenceRepository;
import com.pitwall.repository.UserRepository;
import com.pitwall.security.JwtUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserPreferenceRepository userPreferenceRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtils jwtUtils;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private AuthService authService;

    @Test
    void register_withNewEmail_createsUserAndReturnsToken() {
        // Arrange
        RegisterRequest request = new RegisterRequest("test@example.com", "password123", "Test User");

        when(userRepository.existsByEmail("test@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("hashedPassword");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(1L);
            return user;
        });
        when(jwtUtils.generateToken("test@example.com")).thenReturn("jwt-token-123");

        // Act
        AuthResponse response = authService.register(request);

        // Assert
        assertNotNull(response);
        assertEquals("jwt-token-123", response.token());
        assertEquals("test@example.com", response.email());
        assertEquals("Test User", response.displayName());

        verify(userRepository).existsByEmail("test@example.com");
        verify(userRepository).save(any(User.class));
        verify(userPreferenceRepository).save(any(UserPreference.class));
        verify(jwtUtils).generateToken("test@example.com");

        ArgumentCaptor<UserPreference> prefCaptor = ArgumentCaptor.forClass(UserPreference.class);
        verify(userPreferenceRepository).save(prefCaptor.capture());
        UserPreference savedPref = prefCaptor.getValue();
        assertEquals("[]", savedPref.getFollowedSeries());
        assertEquals("[]", savedPref.getFollowedTeams());
        assertEquals("[]", savedPref.getFollowedDrivers());
    }

    @Test
    void register_withExistingEmail_throwsDuplicateResourceException() {
        // Arrange
        RegisterRequest request = new RegisterRequest("existing@example.com", "password123", "Test User");
        when(userRepository.existsByEmail("existing@example.com")).thenReturn(true);

        // Act & Assert
        DuplicateResourceException exception = assertThrows(
                DuplicateResourceException.class,
                () -> authService.register(request)
        );

        assertTrue(exception.getMessage().contains("User"));
        assertTrue(exception.getMessage().contains("existing@example.com"));
        verify(userRepository).existsByEmail("existing@example.com");
        verify(userRepository, never()).save(any());
    }

    @Test
    void login_withValidCredentials_returnsToken() {
        // Arrange
        AuthRequest request = new AuthRequest("test@example.com", "password123");
        User user = buildUser(1L, "test@example.com", "Test User", "hashedPassword");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password123", "hashedPassword")).thenReturn(true);
        when(jwtUtils.generateToken("test@example.com")).thenReturn("jwt-token-456");

        // Act
        AuthResponse response = authService.login(request);

        // Assert
        assertNotNull(response);
        assertEquals("jwt-token-456", response.token());
        assertEquals("test@example.com", response.email());
        assertEquals("Test User", response.displayName());
        verify(userRepository).findByEmail("test@example.com");
        verify(passwordEncoder).matches("password123", "hashedPassword");
        verify(jwtUtils).generateToken("test@example.com");
    }

    @Test
    void login_withInvalidEmail_throwsInvalidCredentialsException() {
        // Arrange
        AuthRequest request = new AuthRequest("unknown@example.com", "password123");
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(
                InvalidCredentialsException.class,
                () -> authService.login(request)
        );

        verify(userRepository).findByEmail("unknown@example.com");
        verifyNoInteractions(passwordEncoder);
    }

    @Test
    void login_withWrongPassword_throwsInvalidCredentialsException() {
        // Arrange
        AuthRequest request = new AuthRequest("test@example.com", "wrongPassword");
        User user = buildUser(1L, "test@example.com", "Test User", "hashedPassword");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongPassword", "hashedPassword")).thenReturn(false);

        // Act & Assert
        assertThrows(
                InvalidCredentialsException.class,
                () -> authService.login(request)
        );

        verify(userRepository).findByEmail("test@example.com");
        verify(passwordEncoder).matches("wrongPassword", "hashedPassword");
        verifyNoInteractions(jwtUtils);
    }

    @Test
    void getPreferences_returnsDeserializedPreferences() {
        // Arrange
        String email = "test@example.com";
        User user = buildUser(1L, email, "Test User", "hashedPassword");
        UserPreference preference = buildUserPreference(1L, user,
                "[\"f1\",\"fe\"]",
                "[\"red-bull\"]",
                "[\"max-verstappen\"]"
        );

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(userPreferenceRepository.findByUserId(1L)).thenReturn(Optional.of(preference));

        // Act
        UserPreferenceDto result = authService.getPreferences(email);

        // Assert
        assertNotNull(result);
        assertEquals(List.of("f1", "fe"), result.followedSeries());
        assertEquals(List.of("red-bull"), result.followedTeams());
        assertEquals(List.of("max-verstappen"), result.followedDrivers());
        verify(userRepository).findByEmail(email);
        verify(userPreferenceRepository).findByUserId(1L);
    }

    @Test
    void updatePreferences_savesSerializedPreferences() {
        // Arrange
        String email = "test@example.com";
        User user = buildUser(1L, email, "Test User", "hashedPassword");
        UserPreference existingPref = buildUserPreference(1L, user, "[]", "[]", "[]");

        UserPreferenceDto dtoToSave = new UserPreferenceDto(
                List.of("f1", "wec"),
                List.of("ferrari"),
                List.of("charles-leclerc", "carlos-sainz")
        );

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(userPreferenceRepository.findByUserId(1L)).thenReturn(Optional.of(existingPref));

        // Act
        UserPreferenceDto result = authService.updatePreferences(email, dtoToSave);

        // Assert
        assertEquals(dtoToSave, result);

        ArgumentCaptor<UserPreference> captor = ArgumentCaptor.forClass(UserPreference.class);
        verify(userPreferenceRepository).save(captor.capture());
        UserPreference saved = captor.getValue();
        assertEquals("[\"f1\",\"wec\"]", saved.getFollowedSeries());
        assertEquals("[\"ferrari\"]", saved.getFollowedTeams());
        assertEquals("[\"charles-leclerc\",\"carlos-sainz\"]", saved.getFollowedDrivers());
    }

    private User buildUser(Long id, String email, String displayName, String passwordHash) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setDisplayName(displayName);
        user.setPasswordHash(passwordHash);
        user.setCreatedAt(Instant.now());
        return user;
    }

    private UserPreference buildUserPreference(Long id, User user, String series, String teams, String drivers) {
        UserPreference pref = new UserPreference();
        pref.setId(id);
        pref.setUser(user);
        pref.setFollowedSeries(series);
        pref.setFollowedTeams(teams);
        pref.setFollowedDrivers(drivers);
        return pref;
    }
}

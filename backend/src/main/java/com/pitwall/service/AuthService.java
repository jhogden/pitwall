package com.pitwall.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collections;
import java.util.List;

@Service
public class AuthService {

    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {};

    private final UserRepository userRepository;
    private final UserPreferenceRepository userPreferenceRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final ObjectMapper objectMapper;

    public AuthService(UserRepository userRepository,
                       UserPreferenceRepository userPreferenceRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtils jwtUtils,
                       ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.userPreferenceRepository = userPreferenceRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new DuplicateResourceException("User", request.email());
        }

        User user = new User();
        user.setEmail(request.email());
        user.setDisplayName(request.displayName());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setCreatedAt(Instant.now());
        userRepository.save(user);

        UserPreference preferences = new UserPreference();
        preferences.setUser(user);
        preferences.setFollowedSeries("[]");
        preferences.setFollowedTeams("[]");
        preferences.setFollowedDrivers("[]");
        userPreferenceRepository.save(preferences);

        String token = jwtUtils.generateToken(user.getEmail());
        return new AuthResponse(token, user.getEmail(), user.getDisplayName());
    }

    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        String token = jwtUtils.generateToken(user.getEmail());
        return new AuthResponse(token, user.getEmail(), user.getDisplayName());
    }

    public UserPreferenceDto getPreferences(String email) {
        User user = findUserByEmail(email);
        UserPreference preferences = userPreferenceRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("UserPreference", email));

        return new UserPreferenceDto(
                parseJsonArray(preferences.getFollowedSeries()),
                parseJsonArray(preferences.getFollowedTeams()),
                parseJsonArray(preferences.getFollowedDrivers())
        );
    }

    @Transactional
    public UserPreferenceDto updatePreferences(String email, UserPreferenceDto dto) {
        User user = findUserByEmail(email);
        UserPreference preferences = userPreferenceRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    UserPreference newPreferences = new UserPreference();
                    newPreferences.setUser(user);
                    return newPreferences;
                });

        preferences.setFollowedSeries(toJsonArray(dto.followedSeries()));
        preferences.setFollowedTeams(toJsonArray(dto.followedTeams()));
        preferences.setFollowedDrivers(toJsonArray(dto.followedDrivers()));
        userPreferenceRepository.save(preferences);

        return dto;
    }

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", email));
    }

    private List<String> parseJsonArray(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, STRING_LIST_TYPE);
        } catch (JsonProcessingException e) {
            return Collections.emptyList();
        }
    }

    private String toJsonArray(List<String> list) {
        if (list == null || list.isEmpty()) {
            return "[]";
        }
        try {
            return objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }
}

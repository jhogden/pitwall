package com.pitwall.controller;

import com.pitwall.dto.UserPreferenceDto;
import com.pitwall.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users/me")
public class UserController {

    private final AuthService authService;

    public UserController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/preferences")
    public ResponseEntity<UserPreferenceDto> getPreferences() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(authService.getPreferences(email));
    }

    @PutMapping("/preferences")
    public ResponseEntity<UserPreferenceDto> updatePreferences(@RequestBody UserPreferenceDto preferences) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(authService.updatePreferences(email, preferences));
    }
}

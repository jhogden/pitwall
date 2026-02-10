package com.pitwall.dto;

public record AuthResponse(
        String token,
        String email,
        String displayName
) {
}

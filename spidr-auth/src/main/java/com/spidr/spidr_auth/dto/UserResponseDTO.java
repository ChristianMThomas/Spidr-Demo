package com.spidr.spidr_auth.dto;

import com.spidr.spidr_auth.model.users;
import lombok.Getter;

/**
 * Sanitised user representation — never exposes verificationCode, resetCode,
 * failedLoginAttempts, lockoutUntil, or any other internal security fields.
 */
@Getter
public class UserResponseDTO {

    private final String id;
    private final String username;
    private final String email;
    private final String role;
    private final boolean enabled;

    public UserResponseDTO(users user) {
        this.id       = user.getId();
        this.username = user.getDisplayUsername();
        this.email    = user.getEmail();
        this.role     = user.getRole();
        this.enabled  = user.isEnabled();
    }
}

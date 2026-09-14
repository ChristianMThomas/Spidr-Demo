package com.spidr.spidr_auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterUserDTO {

    @NotBlank(message = "Username is required")
    @Pattern(regexp = "^[a-zA-Z0-9_]{3,20}$",
             message = "Username must be 3–20 characters and contain only letters, numbers, and underscores")
    private String username;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    // Strength rules are enforced by PasswordPolicy in AuthService so the client
    // gets one readable {error} instead of the generic "Validation failed".
    @NotBlank(message = "Password is required")
    private String password;
}

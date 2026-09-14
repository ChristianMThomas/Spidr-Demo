package com.spidr.spidr_auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ResetPasswordDTO {

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    // Strength rules are enforced by PasswordPolicy in AuthService.
    @NotBlank(message = "New password is required")
    private String newPassword;
}

package com.spidr.spidr_auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChangePasswordDTO {

    @NotBlank(message = "Current password is required")
    private String currentPassword;

    // Strength rules are enforced by PasswordPolicy in UserService.
    @NotBlank(message = "New password is required")
    private String newPassword;
}

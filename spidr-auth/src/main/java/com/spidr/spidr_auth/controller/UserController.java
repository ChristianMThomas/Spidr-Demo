package com.spidr.spidr_auth.controller;

import com.spidr.spidr_auth.dto.ChangePasswordDTO;
import com.spidr.spidr_auth.dto.UserResponseDTO;
import com.spidr.spidr_auth.model.users;
import com.spidr.spidr_auth.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // ── Get current authenticated user — sanitised DTO (no sensitive fields) ─

    @GetMapping("/me")
    public ResponseEntity<UserResponseDTO> getCurrentUser() {
        users user = userService.getCurrentUser();
        return ResponseEntity.ok(new UserResponseDTO(user));
    }

    // ── Get all users — admin only, sanitised DTO (AUTH-Q9) ──────────────────

    @GetMapping("/all")
    public ResponseEntity<List<UserResponseDTO>> getAllUsers() {
        List<UserResponseDTO> dtos = userService.getAllUsers().stream()
                .map(UserResponseDTO::new)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    // ── Change password (AUTH-Q1) ─────────────────────────────────────────────

    @PatchMapping("/change-password")
    public ResponseEntity<?> changePassword(@Valid @RequestBody ChangePasswordDTO dto) {
        userService.changePassword(dto.getCurrentPassword(), dto.getNewPassword());
        return ResponseEntity.ok(Map.of("message", "Password changed successfully."));
    }

    // ── Delete account (AUTH-Q1) ──────────────────────────────────────────────

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteAccount() {
        userService.deleteAccount();
        return ResponseEntity.noContent().build();
    }
}

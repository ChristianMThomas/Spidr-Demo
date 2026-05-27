package com.spidr.spidr_auth.service;

import com.spidr.spidr_auth.model.users;
import com.spidr.spidr_auth.repository.userRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final userRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    // ── Get current authenticated user ────────────────────────────────────────

    public users getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (users) auth.getPrincipal();
    }

    // ── Get all users ─────────────────────────────────────────────────────────

    public List<users> getAllUsers() {
        return userRepo.findAll();
    }

    // ── Get user by ID ────────────────────────────────────────────────────────

    public users getUserById(String id) {
        return userRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // ── Update username ───────────────────────────────────────────────────────

    public users updateUsername(String newUsername) {
        users user = getCurrentUser();

        if (userRepo.existsByUsername(newUsername)) {
            throw new RuntimeException("Username already taken");
        }

        user.setUsername(newUsername);
        return userRepo.save(user);
    }

    // ── Change password ───────────────────────────────────────────────────────

    public void changePassword(String currentPassword, String newPassword) {
        users user = getCurrentUser();

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new RuntimeException("Current password is incorrect");
        }

        if (newPassword.length() < 8) {
            throw new RuntimeException("New password must be at least 8 characters");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepo.save(user);
    }

    // ── Delete account ────────────────────────────────────────────────────────

    public void deleteAccount() {
        users user = getCurrentUser();
        userRepo.deleteById(user.getId());
    }
}

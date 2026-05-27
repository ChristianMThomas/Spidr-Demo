package com.spidr.spidr_auth.service;

import com.spidr.spidr_auth.dto.ForgotPasswordDTO;
import com.spidr.spidr_auth.dto.LoginUserDTO;
import com.spidr.spidr_auth.dto.RegisterUserDTO;
import com.spidr.spidr_auth.dto.ResetPasswordDTO;
import com.spidr.spidr_auth.dto.VerifyResetCodeDTO;
import com.spidr.spidr_auth.dto.VerifyUserDTO;
import com.spidr.spidr_auth.model.users;
import com.spidr.spidr_auth.repository.userRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final userRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final EmailService emailService;

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCKOUT_MINUTES     = 15;
    private static final int MAX_RESEND_PER_DAY  = 3;

    private final SecureRandom secureRandom = new SecureRandom();

    // ── Register ──────────────────────────────────────────────────────────────

    public users register(RegisterUserDTO dto) {
        String email    = dto.getEmail().toLowerCase().trim();
        String username = dto.getUsername().trim();

        if (userRepo.existsByEmail(email)) {
            throw new RuntimeException("Email already in use");
        }
        if (userRepo.existsByUsername(username)) {
            throw new RuntimeException("Username already taken");
        }

        users user = new users();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setEnabled(false);
        user.setRole("ROLE_USER");
        user.setVerificationCode(generateVerificationCode());
        user.setVerificationExpiration(LocalDateTime.now().plusMinutes(15));

        userRepo.save(user);
        emailService.sendVerificationEmail(user.getEmail(), user.getDisplayUsername(), user.getVerificationCode());

        return user;
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    public users login(LoginUserDTO dto) {
        String email = dto.getEmail().toLowerCase().trim();

        users user = userRepo.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        // Check lockout before attempting authentication
        if (!user.isAccountNonLocked()) {
            throw new RuntimeException("Account is temporarily locked due to too many failed attempts. Try again later.");
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, dto.getPassword())
            );
        } catch (BadCredentialsException e) {
            int attempts = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(attempts);

            if (attempts >= MAX_FAILED_ATTEMPTS) {
                user.setLockoutUntil(LocalDateTime.now().plusMinutes(LOCKOUT_MINUTES));
                user.setFailedLoginAttempts(0);
                userRepo.save(user);
                throw new RuntimeException(
                        "Too many failed attempts. Account locked for " + LOCKOUT_MINUTES + " minutes.");
            }

            userRepo.save(user);
            int remaining = MAX_FAILED_ATTEMPTS - attempts;
            throw new RuntimeException(
                    "Invalid email or password. " + remaining + " attempt(s) remaining before lockout.");
        }

        if (!user.isEnabled()) {
            throw new RuntimeException("Account not verified. Please check your email.");
        }

        // Successful login — clear failed-attempt counters
        user.setFailedLoginAttempts(0);
        user.setLockoutUntil(null);
        userRepo.save(user);

        return user;
    }

    // ── Verify OTP ────────────────────────────────────────────────────────────

    public void verifyUser(VerifyUserDTO dto) {
        users user = userRepo.findByEmail(dto.getEmail().toLowerCase().trim())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getVerificationExpiration() == null ||
                LocalDateTime.now().isAfter(user.getVerificationExpiration())) {
            throw new RuntimeException("Verification code has expired. Please request a new one.");
        }

        if (!user.getVerificationCode().equals(dto.getVerificationCode())) {
            throw new RuntimeException("Invalid verification code.");
        }

        user.setEnabled(true);
        user.setVerificationCode(null);
        user.setVerificationExpiration(null);
        userRepo.save(user);
    }

    // ── Resend OTP ────────────────────────────────────────────────────────────

    public void resendVerificationCode(String email) {
        String normalizedEmail = email.toLowerCase().trim();
        users user = userRepo.findByEmail(normalizedEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.isEnabled()) {
            throw new RuntimeException("Account is already verified.");
        }

        // Rate limit: max 3 resends per 24 hours per account
        LocalDateTime now = LocalDateTime.now();
        if (user.getResendWindowStart() == null
                || now.isAfter(user.getResendWindowStart().plusHours(24))) {
            user.setResendCount(0);
            user.setResendWindowStart(now);
        }

        if (user.getResendCount() >= MAX_RESEND_PER_DAY) {
            throw new RuntimeException(
                    "Too many resend requests. Maximum " + MAX_RESEND_PER_DAY
                    + " resends are allowed per 24 hours.");
        }

        user.setResendCount(user.getResendCount() + 1);
        user.setVerificationCode(generateVerificationCode());
        user.setVerificationExpiration(now.plusMinutes(15));
        userRepo.save(user);

        emailService.sendVerificationEmail(user.getEmail(), user.getDisplayUsername(), user.getVerificationCode());
    }

    // ── Load User ─────────────────────────────────────────────────────────────

    public users loadUser(String email) {
        return userRepo.findByEmail(email.toLowerCase().trim())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // ── Forgot Password ───────────────────────────────────────────────────────

    public void forgotPassword(ForgotPasswordDTO dto) {
        users user = userRepo.findByEmail(dto.getEmail().toLowerCase().trim())
                .orElseThrow(() -> new RuntimeException("No account found for that email."));

        user.setResetCode(generateVerificationCode());
        user.setResetCodeExpiration(LocalDateTime.now().plusMinutes(15));
        user.setResetVerified(false);
        userRepo.save(user);

        emailService.sendPasswordResetEmail(user.getEmail(), user.getDisplayUsername(), user.getResetCode());
    }

    // ── Verify Reset Code ─────────────────────────────────────────────────────

    public void verifyResetCode(VerifyResetCodeDTO dto) {
        users user = userRepo.findByEmail(dto.getEmail().toLowerCase().trim())
                .orElseThrow(() -> new RuntimeException("No account found for that email."));

        if (user.getResetCode() == null || user.getResetCodeExpiration() == null) {
            throw new RuntimeException("No password reset was requested for this account.");
        }

        if (LocalDateTime.now().isAfter(user.getResetCodeExpiration())) {
            throw new RuntimeException("Reset code has expired. Please request a new one.");
        }

        if (!user.getResetCode().equals(dto.getResetCode())) {
            throw new RuntimeException("Invalid reset code.");
        }

        user.setResetVerified(true);
        userRepo.save(user);
    }

    // ── Reset Password ────────────────────────────────────────────────────────

    public void resetPassword(ResetPasswordDTO dto) {
        users user = userRepo.findByEmail(dto.getEmail().toLowerCase().trim())
                .orElseThrow(() -> new RuntimeException("No account found for that email."));

        if (!user.isResetVerified()) {
            throw new RuntimeException("Reset code not verified. Please verify your code first.");
        }

        if (user.getResetCodeExpiration() == null
                || LocalDateTime.now().isAfter(user.getResetCodeExpiration())) {
            throw new RuntimeException("Reset session has expired. Please start over.");
        }

        user.setPassword(passwordEncoder.encode(dto.getNewPassword()));
        user.setResetCode(null);
        user.setResetCodeExpiration(null);
        user.setResetVerified(false);
        userRepo.save(user);

        // Notify user that their password was changed (AUTH-Q8)
        emailService.sendPasswordResetConfirmationEmail(user.getEmail(), user.getDisplayUsername());
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private String generateVerificationCode() {
        // SecureRandom — cryptographically strong (AUTH-Q2)
        return String.valueOf(secureRandom.nextInt(900000) + 100000);
    }
}

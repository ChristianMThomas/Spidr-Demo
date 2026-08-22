package com.spidr.spidr_auth.controller;

import com.spidr.spidr_auth.dto.ForgotPasswordDTO;
import com.spidr.spidr_auth.dto.LoginUserDTO;
import com.spidr.spidr_auth.dto.RegisterUserDTO;
import com.spidr.spidr_auth.dto.ResendOtpDTO;
import com.spidr.spidr_auth.dto.ResetPasswordDTO;
import com.spidr.spidr_auth.dto.VerifyResetCodeDTO;
import com.spidr.spidr_auth.dto.VerifyUserDTO;
import com.spidr.spidr_auth.model.users;
import com.spidr.spidr_auth.responses.LoginResponse;
import com.spidr.spidr_auth.service.AuthService;
import com.spidr.spidr_auth.service.JwtService;
import com.spidr.spidr_auth.service.RateLimiterService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;
    private final RateLimiterService rateLimiter;

    // ── Sign Up — 5 per hour per IP ───────────────────────────────────────────

    @PostMapping("/signup")
    public ResponseEntity<?> register(
            @Valid @RequestBody RegisterUserDTO dto,
            HttpServletRequest request) {
        rateLimiter.check(clientIp(request) + ":signup", 5, 3600);
        authService.register(dto);
        return ResponseEntity.ok(Map.of(
                "message", "Account created. Check your email for a verification code."
        ));
    }

    // ── Login — 10/15min per IP AND per email ─────────────────────────────────

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @Valid @RequestBody LoginUserDTO dto,
            HttpServletRequest request) {
        String ip = clientIp(request);
        String email = normalize(dto.getEmail());
        rateLimiter.check(ip + ":login", 10, 900);
        rateLimiter.check(email + ":login", 10, 900);
        users user = authService.login(dto);
        String token = jwtService.generateToken(user);
        return ResponseEntity.ok(new LoginResponse(token, jwtService.getExpirationTime()));
    }

    // ── Verify OTP — 10/15min per IP AND per email (brute-force OTP guard) ────

    @PostMapping("/verify")
    public ResponseEntity<?> verify(
            @Valid @RequestBody VerifyUserDTO dto,
            HttpServletRequest request) {
        String ip = clientIp(request);
        String email = normalize(dto.getEmail());
        rateLimiter.check(ip + ":verify", 10, 900);
        rateLimiter.check(email + ":verify", 10, 900);
        authService.verifyUser(dto);
        users user = authService.loadUser(dto.getEmail());
        String token = jwtService.generateToken(user);
        return ResponseEntity.ok(new LoginResponse(token, jwtService.getExpirationTime()));
    }

    // ── Resend OTP — 5/hour per IP AND 3/hour per email (account-level daily cap in AuthService) ──

    @PostMapping("/resend")
    public ResponseEntity<?> resend(
            @Valid @RequestBody ResendOtpDTO dto,
            HttpServletRequest request) {
        String ip = clientIp(request);
        String email = normalize(dto.getEmail());
        rateLimiter.check(ip + ":resend", 5, 3600);
        rateLimiter.check(email + ":resend", 3, 3600);
        authService.resendVerificationCode(dto.getEmail());
        return ResponseEntity.ok(Map.of("message", "New verification code sent."));
    }

    // ── Forgot Password — 3/hour per IP AND per email ─────────────────────────

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(
            @Valid @RequestBody ForgotPasswordDTO dto,
            HttpServletRequest request) {
        String ip = clientIp(request);
        String email = normalize(dto.getEmail());
        rateLimiter.check(ip + ":forgot", 3, 3600);
        rateLimiter.check(email + ":forgot", 3, 3600);
        authService.forgotPassword(dto);
        return ResponseEntity.ok(Map.of("message", "Password reset code sent to your email."));
    }

    // ── Verify Reset Code — 10/15min per IP AND per email (brute-force code guard) ─────

    @PostMapping("/verify-reset-code")
    public ResponseEntity<?> verifyResetCode(
            @Valid @RequestBody VerifyResetCodeDTO dto,
            HttpServletRequest request) {
        String ip = clientIp(request);
        String email = normalize(dto.getEmail());
        rateLimiter.check(ip + ":verify-reset", 10, 900);
        rateLimiter.check(email + ":verify-reset", 10, 900);
        authService.verifyResetCode(dto);
        return ResponseEntity.ok(Map.of("message", "Code verified. You may now reset your password."));
    }

    // ── Reset Password — 10/15min per IP AND per email ────────────────────────

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(
            @Valid @RequestBody ResetPasswordDTO dto,
            HttpServletRequest request) {
        String ip = clientIp(request);
        String email = normalize(dto.getEmail());
        rateLimiter.check(ip + ":reset", 10, 900);
        rateLimiter.check(email + ":reset", 10, 900);
        authService.resetPassword(dto);
        return ResponseEntity.ok(Map.of("message", "Password reset successfully. You can now log in."));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return (forwarded != null && !forwarded.isBlank())
                ? forwarded.split(",")[0].trim()
                : request.getRemoteAddr();
    }

    private String normalize(String email) {
        return email == null ? "" : email.toLowerCase().trim();
    }
}

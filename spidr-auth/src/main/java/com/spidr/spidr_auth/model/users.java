package com.spidr.spidr_auth.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.AccessLevel;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
public class users implements UserDetails {

    @Id
    private String id;

    @Indexed(unique = true)
    private String username;

    @Indexed(unique = true)
    private String email;

    private String password;

    private String verificationCode;
    private LocalDateTime verificationExpiration;

    private String resetCode;
    private LocalDateTime resetCodeExpiration;
    private boolean resetVerified;

    private String role = "ROLE_USER";

    @Getter(AccessLevel.NONE)
    private boolean enabled;

    // ── Account lockout (AUTH-M2) ─────────────────────────────────────────────
    private int failedLoginAttempts = 0;
    private LocalDateTime lockoutUntil;

    // ── Resend OTP rate limit (AUTH-M5) ──────────────────────────────────────
    private int resendCount = 0;
    private LocalDateTime resendWindowStart;

    // ── Display username accessor ─────────────────────────────────────────────
    // Lombok cannot generate getUsername() because UserDetails already defines it
    // (returning email as the principal identifier). Use getDisplayUsername() to
    // retrieve the user's chosen display name.

    public String getDisplayUsername() {
        return username;
    }

    // ── UserDetails overrides ─────────────────────────────────────────────────

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority(role));
    }

    @Override
    public String getPassword() {
        return password;
    }

    /** Returns email — this is the Spring Security principal identifier. */
    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    /** Returns false while a lockout is in effect, true otherwise. */
    @Override
    public boolean isAccountNonLocked() {
        return lockoutUntil == null || LocalDateTime.now().isAfter(lockoutUntil);
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }
}

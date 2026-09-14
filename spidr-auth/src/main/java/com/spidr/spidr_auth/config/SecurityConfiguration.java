package com.spidr.spidr_auth.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.ArrayList;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfiguration {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    /**
     * Whether to allow http://localhost origins through CORS. True for local
     * development; application-railway.properties sets it false so the
     * production deployment does not accept credentialed requests from a page
     * served on a visitor's own machine.
     */
    @Value("${app.cors.allow-local-dev:true}")
    private boolean allowLocalDevOrigins;

    // ── Security Filter Chain ─────────────────────────────────────────────────

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // Disable CSRF — we use stateless JWT, no session cookies to protect
            .csrf(AbstractHttpConfigurer::disable)

            // Attach our CORS config
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // Route-level access rules
            .authorizeHttpRequests(auth -> auth
                // CORS preflight — must pass before any auth check
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Public auth endpoints — no token needed
                .requestMatchers(
                    "/auth/signup",
                    "/auth/login",
                    "/auth/verify",
                    "/auth/resend",
                    "/auth/forgot-password",
                    "/auth/verify-reset-code",
                    "/auth/reset-password"
                ).permitAll()
                // Admin-only endpoints
                .requestMatchers("/users/all").hasRole("ADMIN")
                // Everything else requires a valid JWT
                .anyRequest().authenticated()
            )

            // Stateless — no HTTP session, every request must carry its JWT
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )

            // Wire in our JWT filter
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // ── CORS Configuration ────────────────────────────────────────────────────

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // Allowed origins. NOTE: an Origin header is scheme://host[:port] and
        // never carries a path, so the two ".../login" entries that used to sit
        // in this list could never match anything - they are dropped.
        List<String> origins = new ArrayList<>(List.of(
            "https://spidrapp.infinitetechteam.com",
            "https://www.spidrapp.infinitetechteam.com",
            "app://.",
            "file://"
        ));

        // Dev-only origins. These were previously hardcoded into the same list
        // used by the Railway deployment, which - combined with
        // setAllowCredentials(true) below - let any page on a victim's
        // localhost make credentialed calls against production auth.
        if (allowLocalDevOrigins) {
            origins.addAll(List.of(
                "http://localhost:5173",
                "http://localhost:4000",
                "http://localhost:3000"
            ));
        }

        config.setAllowedOrigins(origins);

        // Allowed HTTP methods
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));

        // Allowed headers — must include Authorization for JWT
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));

        // Expose Authorization header to the frontend
        config.setExposedHeaders(List.of("Authorization"));

        // Allow credentials (needed for cookie-based flows if added later)
        config.setAllowCredentials(true);

        // Cache preflight response for 1 hour
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}

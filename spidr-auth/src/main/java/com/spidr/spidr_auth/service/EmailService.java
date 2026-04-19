package com.spidr.spidr_auth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String RESEND_URL = "https://api.resend.com/emails";

    @Value("${resend.api-key}")
    private String apiKey;

    @Value("${mail.from}")
    private String mailFrom;

    @Autowired
    private ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @PostConstruct
    private void init() {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY is not set — transactional emails will not be sent");
        } else {
            log.info("EmailService ready — from: {}", mailFrom);
        }
    }

    @Async
    public void sendVerificationEmail(String to, String username, String code) {
        send(to, "Spidr — Verify Your Account", buildVerificationEmail(username, code));
    }

    @Async
    public void sendLoginOtpEmail(String to, String username, String code) {
        send(to, "Spidr — Your Login Code", buildLoginOtpEmail(username, code));
    }

    @Async
    public void sendPasswordResetEmail(String to, String username, String code) {
        send(to, "Spidr — Password Reset Code", buildPasswordResetEmail(username, code));
    }

    @Async
    public void sendPasswordResetConfirmationEmail(String to, String username) {
        send(to, "Spidr — Password Changed Successfully", buildPasswordResetConfirmationEmail(username));
    }

    private void send(String to, String subject, String html) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Cannot send email to {} — RESEND_API_KEY is not configured", to);
            return;
        }
        try {
            ObjectNode payload = objectMapper.createObjectNode();
            payload.put("from", mailFrom);
            payload.putArray("to").add(to);
            payload.put("subject", subject);
            payload.put("html", html);

            String body = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(RESEND_URL))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                log.error("Resend API error {}: {}", response.statusCode(), response.body());
            } else {
                log.info("Email sent to {} subject='{}' — status {}", to, subject, response.statusCode());
            }
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    // ── Email Templates ───────────────────────────────────────────────────────

    private String buildVerificationEmail(String username, String code) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; background: #0a0a0a; color: #ffffff; padding: 32px; border-radius: 12px;">
                    <h1 style="color: #FF3333; font-size: 24px; margin-bottom: 4px;">SPIDR</h1>
                    <p style="color: #888; font-size: 12px; margin-top: 0;">VERIFY YOUR ACCOUNT</p>
                    <hr style="border-color: #222; margin: 24px 0;">
                    <p>Hey <strong>%s</strong>,</p>
                    <p>Enter this code to verify your Spidr account:</p>
                    <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #FF3333;">%s</span>
                    </div>
                    <p style="color: #888; font-size: 13px;">This code expires in <strong>15 minutes</strong>. If you didn't create a Spidr account, ignore this email.</p>
                </div>
                """.formatted(username, code);
    }

    private String buildLoginOtpEmail(String username, String code) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; background: #0a0a0a; color: #ffffff; padding: 32px; border-radius: 12px;">
                    <h1 style="color: #FF3333; font-size: 24px; margin-bottom: 4px;">SPIDR</h1>
                    <p style="color: #888; font-size: 12px; margin-top: 0;">LOGIN VERIFICATION</p>
                    <hr style="border-color: #222; margin: 24px 0;">
                    <p>Hey <strong>%s</strong>,</p>
                    <p>Your login code is:</p>
                    <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #FF3333;">%s</span>
                    </div>
                    <p style="color: #888; font-size: 13px;">This code expires in <strong>15 minutes</strong>. If this wasn't you, secure your account immediately.</p>
                </div>
                """.formatted(username, code);
    }

    private String buildPasswordResetEmail(String username, String code) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; background: #0a0a0a; color: #ffffff; padding: 32px; border-radius: 12px;">
                    <h1 style="color: #FF3333; font-size: 24px; margin-bottom: 4px;">SPIDR</h1>
                    <p style="color: #888; font-size: 12px; margin-top: 0;">OVERRIDE PROTOCOL</p>
                    <hr style="border-color: #222; margin: 24px 0;">
                    <p>Hey <strong>%s</strong>,</p>
                    <p>Your password reset code is:</p>
                    <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #FF3333;">%s</span>
                    </div>
                    <p style="color: #888; font-size: 13px;">This code expires in <strong>15 minutes</strong>. If you didn't request this, ignore this email — your password has not been changed.</p>
                </div>
                """.formatted(username, code);
    }

    private String buildPasswordResetConfirmationEmail(String username) {
        return """
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; background: #0a0a0a; color: #ffffff; padding: 32px; border-radius: 12px;">
                    <h1 style="color: #FF3333; font-size: 24px; margin-bottom: 4px;">SPIDR</h1>
                    <p style="color: #888; font-size: 12px; margin-top: 0;">SECURITY ALERT</p>
                    <hr style="border-color: #222; margin: 24px 0;">
                    <p>Hey <strong>%s</strong>,</p>
                    <p>Your Spidr password was <strong>changed successfully</strong>.</p>
                    <p style="color: #888; font-size: 13px;">If you did not make this change, contact support immediately and secure your account.</p>
                </div>
                """.formatted(username);
    }
}

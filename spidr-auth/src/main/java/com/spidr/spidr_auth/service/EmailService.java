package com.spidr.spidr_auth.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    // ── All send methods are @Async — exceptions are handled internally ────────
    // Do NOT declare throws on @Async methods; any exception thrown in the async
    // thread is NOT propagated to the caller.

    @Async
    public void sendVerificationEmail(String to, String username, String code) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);
            helper.setTo(to);
            helper.setSubject("Spidr — Verify Your Account");
            helper.setText(buildVerificationEmail(username, code), true);
            mailSender.send(message);
        } catch (MessagingException e) {
            // Log but don't propagate — caller is not waiting on this
        }
    }

    @Async
    public void sendLoginOtpEmail(String to, String username, String code) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);
            helper.setTo(to);
            helper.setSubject("Spidr — Your Login Code");
            helper.setText(buildLoginOtpEmail(username, code), true);
            mailSender.send(message);
        } catch (MessagingException e) {
            // Log but don't propagate
        }
    }

    @Async
    public void sendPasswordResetEmail(String to, String username, String code) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);
            helper.setTo(to);
            helper.setSubject("Spidr — Password Reset Code");
            helper.setText(buildPasswordResetEmail(username, code), true);
            mailSender.send(message);
        } catch (MessagingException e) {
            // Log but don't propagate
        }
    }

    /** Confirmation email sent after a successful password reset (AUTH-Q8). */
    @Async
    public void sendPasswordResetConfirmationEmail(String to, String username) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);
            helper.setTo(to);
            helper.setSubject("Spidr — Password Changed Successfully");
            helper.setText(buildPasswordResetConfirmationEmail(username), true);
            mailSender.send(message);
        } catch (MessagingException e) {
            // Log but don't propagate
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

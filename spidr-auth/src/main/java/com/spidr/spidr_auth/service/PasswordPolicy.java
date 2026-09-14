package com.spidr.spidr_auth.service;

import java.util.regex.Pattern;

/**
 * Password strength rules for every flow that sets a password (signup, reset,
 * change). Mirrored client-side in spidr-client/src/lib/passwordPolicy.js and
 * spidr-client/mobile/lib/passwordPolicy.ts — keep all three in step.
 *
 * Login deliberately does NOT run this: accounts created before the policy
 * existed must still be able to sign in.
 */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;

    public static final String REQUIREMENTS_MESSAGE =
            "Password must be at least 8 characters with no spaces and include an uppercase letter, "
            + "a lowercase letter, a number, and a special character.";

    private static final Pattern UPPER   = Pattern.compile("[A-Z]");
    private static final Pattern LOWER   = Pattern.compile("[a-z]");
    private static final Pattern DIGIT   = Pattern.compile("[0-9]");
    private static final Pattern SPECIAL = Pattern.compile("[^A-Za-z0-9\\s]");
    private static final Pattern SPACE   = Pattern.compile("\\s");

    private PasswordPolicy() {}

    public static boolean isStrong(String password) {
        return password != null
                && password.length() >= MIN_LENGTH
                && UPPER.matcher(password).find()
                && LOWER.matcher(password).find()
                && DIGIT.matcher(password).find()
                && SPECIAL.matcher(password).find()
                && !SPACE.matcher(password).find();
    }

    /** Throws with a user-facing message; GlobalExceptionHandler maps it to 400 {error}. */
    public static void requireStrong(String password) {
        if (!isStrong(password)) {
            throw new RuntimeException(REQUIREMENTS_MESSAGE);
        }
    }
}

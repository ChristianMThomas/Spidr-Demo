/**
 * Password strength rules for signup, reset, and change-password.
 *
 * Mirrors spidr-auth PasswordPolicy.java (the real gate) and the web copy in
 * spidr-client/src/lib/passwordPolicy.js — keep all three in step. Login never
 * runs this, so pre-policy accounts can still sign in.
 */

export type PasswordRuleResult = { id: string; label: string; passed: boolean };

export const PASSWORD_RULES: { id: string; label: string; test: (pw: string) => boolean }[] = [
  { id: 'length',  label: 'At least 8 characters',               test: (pw) => pw.length >= 8 },
  { id: 'case',    label: 'An uppercase and a lowercase letter', test: (pw) => /[A-Z]/.test(pw) && /[a-z]/.test(pw) },
  { id: 'special', label: 'A special character (e.g. ! @ # $)',  test: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
  { id: 'alnum',   label: 'A number and a letter',               test: (pw) => /[0-9]/.test(pw) && /[A-Za-z]/.test(pw) },
  { id: 'spaces',  label: 'No spaces',                           test: (pw) => pw.length > 0 && !/\s/.test(pw) },
];

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters with no spaces and include an uppercase letter, a lowercase letter, a number, and a special character.';

export function checkPassword(password = ''): PasswordRuleResult[] {
  return PASSWORD_RULES.map(({ id, label, test }) => ({ id, label, passed: test(password) }));
}

export function isPasswordStrong(password = ''): boolean {
  return PASSWORD_RULES.every(({ test }) => test(password));
}

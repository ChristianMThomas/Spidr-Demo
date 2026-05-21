// Shared HS256 secret resolver for verifying Spring Boot-issued JWTs.
//
// Spring Boot's JwtService base64-decodes the secret before signing, so Node
// must decode the same way to verify. In dev (no JWT_SECRET set) we fall back to
// Spring Boot's documented application.properties dev secret so tokens from
// either service are cross-compatible out of the box. In production JWT_SECRET
// is required — we throw rather than silently using the public dev fallback.
const SPRING_BOOT_DEV_FALLBACK =
  'c3BpZHItZGV2LWZhbGxiYWNrLXNlY3JldC1rZXktcGxlYXNlLXNldC1pbi1lbnY=';

const getSecret = () => {
  const raw = process.env.JWT_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    return Buffer.from(SPRING_BOOT_DEV_FALLBACK, 'base64');
  }
  return Buffer.from(raw, 'base64');
};

module.exports = { getSecret };

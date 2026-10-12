package com.orderflow.common;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;

public class JwtUtil {
  private final SecretKey key;
  private final long ttlMs = 12 * 3600_000L;
  public JwtUtil(String secret) {
    byte[] b = secret.getBytes(StandardCharsets.UTF_8);
    if (b.length < 32) { byte[] p = new byte[32]; System.arraycopy(b, 0, p, 0, b.length); b = p; }
    this.key = Keys.hmacShaKeyFor(b);
  }
  public String issue(String email) {
    return Jwts.builder().subject(email).issuedAt(new Date())
      .expiration(new Date(System.currentTimeMillis() + ttlMs)).signWith(key).compact();
  }
  public String verify(String token) {
    return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload().getSubject();
  }
}

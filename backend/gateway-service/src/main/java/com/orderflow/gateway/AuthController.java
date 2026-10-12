package com.orderflow.gateway;

import com.orderflow.common.JwtUtil;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final JwtUtil jwt;
  public AuthController(JwtUtil jwt) { this.jwt = jwt; }

  // Simple email-only login (no password) for the demo. Prod would verify properly.
  @PostMapping("/login")
  public Map<String, String> login(@RequestBody Map<String, String> body) {
    String email = body.getOrDefault("email", "");
    if (!email.contains("@")) throw new IllegalArgumentException("valid email required");
    return Map.of("email", email, "token", jwt.issue(email), "tokenType", "Bearer");
  }
}

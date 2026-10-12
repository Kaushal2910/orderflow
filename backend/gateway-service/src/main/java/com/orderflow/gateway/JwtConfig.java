package com.orderflow.gateway;

import com.orderflow.common.JwtUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JwtConfig {
  @Bean JwtUtil jwtUtil(@Value("${jwt.secret:orderflow-dev-secret-please-change-32chars}") String s) { return new JwtUtil(s); }
}

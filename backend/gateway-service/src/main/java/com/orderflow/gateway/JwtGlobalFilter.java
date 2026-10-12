package com.orderflow.gateway;

import com.orderflow.common.JwtUtil;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class JwtGlobalFilter implements GlobalFilter, Ordered {
  private final JwtUtil jwt;
  public JwtGlobalFilter(JwtUtil jwt) { this.jwt = jwt; }

  @Override
  public Mono<Void> filter(ServerWebExchange ex, GatewayFilterChain chain) {
    String p = ex.getRequest().getPath().value();
    if (p.startsWith("/api/auth") || p.equals("/actuator/health")) return chain.filter(ex);
    String a = ex.getRequest().getHeaders().getFirst("Authorization");
    if (a == null || !a.startsWith("Bearer ")) {
      ex.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
      return ex.getResponse().setComplete();
    }
    try {
      String sub = jwt.verify(a.substring(7));
      var authed = ex.getRequest().mutate().header("X-User-Email", sub).build();
      return chain.filter(ex.mutate().request(authed).build());
    }
    catch (Exception e) {
      ex.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
      return ex.getResponse().setComplete();
    }
  }
  @Override public int getOrder() { return -100; }
}

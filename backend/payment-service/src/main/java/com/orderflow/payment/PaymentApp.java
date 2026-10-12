package com.orderflow.payment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@SpringBootApplication
@RestController
@RequestMapping("/api/payments")
public class PaymentApp {
  public static void main(String[] args) { SpringApplication.run(PaymentApp.class, args); }

  // Mock charge. Pass {"fail":true} to simulate a decline (tests retry UX).
  @PostMapping("/confirm")
  public Map<String, Object> confirm(@RequestBody Map<String, Object> body) {
    if (Boolean.TRUE.equals(body.get("fail"))) throw new Declined("mock payment declined");
    return Map.of("status", "PAID", "txn", "txn-" + System.currentTimeMillis());
  }

  @ResponseStatus(org.springframework.http.HttpStatus.PAYMENT_REQUIRED)
  static class Declined extends RuntimeException { Declined(String m) { super(m); } }
}

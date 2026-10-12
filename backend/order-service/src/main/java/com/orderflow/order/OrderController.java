package com.orderflow.order;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {
  private final OrderService svc;
  private final OrderRepo repo;
  private final RestTemplate rest = new RestTemplate();
  private final String invBase;
  private final String payBase;

  public OrderController(OrderService svc, OrderRepo repo,
      @Value("${services.inventory-base-url:http://localhost:8082}") String invBase,
      @Value("${services.payment-base-url:http://localhost:8083}") String payBase) {
    this.svc = svc; this.repo = repo; this.invBase = invBase; this.payBase = payBase;
  }

  @PostMapping
  @SuppressWarnings("unchecked")
  public Map<String, Object> create(@RequestHeader("Idempotency-Key") String key,
      @RequestBody Map<String, Object> body) {
    // Replay safety first: same key returns the ORIGINAL order, no double booking.
    var existing = repo.findByIdempotencyKey(key);
    if (existing.isPresent()) return toDto(existing.get());

    String email = (String) body.get("email");
    String holdId = (String) body.get("holdId");
    List<String> seats;
    int total;
    String showId = "";
    String time = "";
    if (holdId != null && !holdId.isBlank()) {
      // Real flow: consume the seat hold (inventory) -> seats become SOLD.
      Map<String, Object> hold = rest.postForObject(invBase + "/api/inventory/consume",
        Map.of("holdId", holdId), Map.class);
      if (hold == null) throw new IllegalStateException("hold consume failed");
      seats = (List<String>) hold.get("seats");
      showId = (String) hold.get("showId");
      time = (String) hold.get("time");
      total = seats.size() * ((Number) hold.getOrDefault("unitPrice", 299)).intValue();
    } else {
      seats = (List<String>) body.getOrDefault("seats", List.of());
      total = ((Number) body.getOrDefault("total", 0)).intValue();
    }
    // Mock payment (pass failPayment=true to simulate a decline; order is NOT saved).
    boolean fail = Boolean.TRUE.equals(body.get("failPayment"));
    try {
      rest.postForObject(payBase + "/api/payments/confirm",
        Map.of("amount", total, "fail", fail), Map.class);
    } catch (HttpClientErrorException e) {
      throw new Declined("mock payment declined");
    }
    Order o = svc.place(key, holdId, email, seats, total);
    o.showId = showId; o.time = time;
    repo.save(o);
    return toDto(o); // in prod: publish order.created to Kafka here
  }

  @GetMapping("/{id}")
  public Map<String, Object> one(@PathVariable String id) {
    return toDto(repo.findById(id).orElseThrow(() -> new NoSuchElementException("order not found")));
  }

  @GetMapping
  public List<Map<String, Object>> mine(@RequestParam String email) {
    return repo.findByEmail(email).stream().map(this::toDto).toList();
  }

  private Map<String, Object> toDto(Order o) {
    String now = Instant.now().toString();
    Map<String, Object> dto = new LinkedHashMap<>();
    dto.put("orderId", o.orderId);
    dto.put("email", o.email == null ? "" : o.email);
    dto.put("showId", o.showId == null ? "" : o.showId);
    dto.put("time", o.time == null ? "" : o.time);
    dto.put("seats", o.seats);
    dto.put("total", o.total);
    dto.put("status", o.status);
    dto.put("timeline", List.of(
      Map.of("k", "CREATED", "at", now, "on", true),
      Map.of("k", "SEAT_RESERVED", "at", now, "on", true),
      Map.of("k", "PAID", "at", now, "on", true),
      Map.of("k", "NOTIFIED", "at", now, "on", true)));
    return dto;
  }

  @ResponseStatus(org.springframework.http.HttpStatus.PAYMENT_REQUIRED)
  static class Declined extends RuntimeException { Declined(String m) { super(m); } }
}

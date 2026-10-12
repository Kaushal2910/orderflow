package com.orderflow.order;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

// Idempotent order placement: replaying the same Idempotency-Key
// returns the ORIGINAL order, never books twice.
// Prod flow: consume hold (inventory) -> mock payment -> publish order.created (Kafka).
@Service
public class OrderService {
  private final OrderRepo repo;
  public OrderService(OrderRepo repo) { this.repo = repo; }

  @Transactional
  public synchronized Order place(String idemKey, String holdId, String email, List<String> seats, int total) {
    return repo.findByIdempotencyKey(idemKey).orElseGet(() -> {
      Order o = new Order();
      o.orderId = "ord-" + UUID.randomUUID().toString().substring(0, 8);
      o.idempotencyKey = idemKey;
      o.holdId = holdId; o.email = email;
      o.seats = new ArrayList<>(seats); o.total = total;
      o.status = "NOTIFIED"; // CREATED -> SEAT_RESERVED -> PAID -> NOTIFIED (Kafka chain in prod)
      return repo.save(o);
    });
  }
}

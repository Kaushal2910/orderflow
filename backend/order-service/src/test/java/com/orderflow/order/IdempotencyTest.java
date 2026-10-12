package com.orderflow.order;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@Import(OrderService.class)
class IdempotencyTest {
  @Autowired OrderService svc;
  @Autowired OrderRepo repo;

  @Test
  void replaySameKey_sharesOneOrder() {
    String key = "key-123";
    Order a = svc.place(key, "hold-1", "a@mail.com", List.of("R1C1", "R1C2"), 598);
    Order b = svc.place(key, "hold-1", "a@mail.com", List.of("R1C1", "R1C2"), 598);
    assertEquals(a.orderId, b.orderId);
    assertEquals(1, repo.count());
  }

  @Test
  void differentKeys_createDifferentOrders() {
    svc.place("k1", "h1", "a@mail.com", List.of("R1C1"), 299);
    svc.place("k2", "h2", "a@mail.com", List.of("R1C2"), 299);
    assertEquals(2, repo.count());
  }
}

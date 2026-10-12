package com.orderflow.order;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface OrderRepo extends JpaRepository<Order, String> {
  Optional<Order> findByIdempotencyKey(String k);
  List<Order> findByEmail(String email);
}

package com.orderflow.order;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity(name = "orders")
public class Order {
  @Id public String orderId;
  @Column(unique = true) public String idempotencyKey;
  public String holdId;
  public String email;
  public String showId;
  public String time;
  @ElementCollection(fetch = FetchType.EAGER)
  public List<String> seats = new ArrayList<>();
  public int total;
  public String status = "CREATED";
}

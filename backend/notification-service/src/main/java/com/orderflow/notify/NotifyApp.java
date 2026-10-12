package com.orderflow.notify;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@SpringBootApplication
@RestController
@RequestMapping("/api/notifications")
public class NotifyApp {
  private static final Logger log = LoggerFactory.getLogger(NotifyApp.class);
  public static void main(String[] args) { SpringApplication.run(NotifyApp.class, args); }

  // Prod: consumes order/payment events from Kafka and sends email/SMS.
  // Local (no broker): listener auto-startup is off; POST below simulates it.
  @KafkaListener(topics = "order.created", groupId = "notify", autoStartup = "${kafka.autostart:false}")
  public void onOrderCreated(String payload) {
    log.info("NOTIFY order.created -> {}", payload);
  }

  @PostMapping("/send")
  public Map<String, String> send(@RequestBody Map<String, String> body) {
    log.info("NOTIFY to={} msg={}", body.get("email"), body.get("message"));
    return Map.of("status", "SENT");
  }
}

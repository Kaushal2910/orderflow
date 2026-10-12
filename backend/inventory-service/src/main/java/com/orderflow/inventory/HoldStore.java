package com.orderflow.inventory;

import org.springframework.stereotype.Service;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

// Seat-hold store. Local/dev: in-memory map with 5-min TTL.
// Prod (docker profile): same API backed by Redis (see application.yml + RedisConfig note).
// Kafka: hold created -> publishes inventory.held (stubbed as log locally).
@Service
public class HoldStore {
  public record Hold(String holdId, String showId, String time, List<String> seats, String email, long expiresAt) {}
  private final Map<String, Hold> holds = new ConcurrentHashMap<>();
  private final Set<String> sold = ConcurrentHashMap.newKeySet();
  private static final long TTL_MS = 5 * 60_000L;

  public synchronized Hold hold(String showId, String time, List<String> seats, String email) {
    evict();
    List<String> blocked = seats.stream().filter(s -> !isFree(showId, time, s)).toList();
    if (!blocked.isEmpty()) throw new IllegalStateException("Already taken: " + String.join(",", blocked));
    Hold h = new Hold("hold-" + UUID.randomUUID().toString().substring(0, 8), showId, time, List.copyOf(seats), email, System.currentTimeMillis() + TTL_MS);
    holds.put(h.holdId(), h);
    return h;
  }

  public synchronized Hold consume(String holdId) {
    evict();
    Hold h = holds.remove(holdId);
    if (h == null) throw new IllegalStateException("Hold expired or unknown. Hold seats again.");
    h.seats().forEach(s -> sold.add(h.showId() + "@" + h.time() + "@" + s));
    return h;
  }

  public synchronized String status(String showId, String time, String seat) {
    evict();
    String k = showId + "@" + time + "@" + seat;
    if (sold.contains(k)) return "SOLD";
    boolean held = holds.values().stream().anyMatch(h ->
      h.showId().equals(showId) && h.time().equals(time) && h.expiresAt() > System.currentTimeMillis() && h.seats().contains(seat));
    return held ? "HELD" : "FREE";
  }

  private boolean isFree(String showId, String time, String seat) { return "FREE".equals(status(showId, time, seat)); }
  private void evict() {
    long now = System.currentTimeMillis();
    holds.entrySet().removeIf(e -> e.getValue().expiresAt() < now);
  }
}

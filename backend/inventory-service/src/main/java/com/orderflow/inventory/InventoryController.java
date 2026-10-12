package com.orderflow.inventory;

import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {
  private final HoldStore holds;
  private final ShowRepo shows;
  public InventoryController(HoldStore holds, ShowRepo shows) { this.holds = holds; this.shows = shows; }

  @GetMapping
  public Map<String, Object> seatMap(@RequestParam String showId, @RequestParam String time) {
    List<Map<String, Object>> seats = new ArrayList<>();
    for (int r = 1; r <= 8; r++) for (int c = 1; c <= 15; c++) {
      String id = "R" + r + "C" + c;
      seats.add(Map.of("id", id, "row", r, "col", c, "status", holds.status(showId, time, id)));
    }
    return Map.of("showId", showId, "time", time, "seats", seats);
  }

  @PostMapping("/hold")
  public HoldStore.Hold hold(@RequestBody Map<String, Object> body,
      @RequestHeader(value = "X-User-Email", required = false) String email) {
    String showId = (String) body.get("showId");
    String time = (String) body.get("time");
    @SuppressWarnings("unchecked")
    List<String> seats = (List<String>) body.get("seats");
    return holds.hold(showId, time, seats, email == null ? "guest" : email);
  }

  // Called by order-service to atomically convert a hold into sold seats.
  @PostMapping("/consume")
  public Map<String, Object> consume(@RequestBody Map<String, String> body) {
    HoldStore.Hold h = holds.consume(body.get("holdId"));
    int unit = shows.findById(h.showId()).map(s -> s.price).orElse(299);
    return Map.of("holdId", h.holdId(), "showId", h.showId(), "time", h.time(),
      "seats", h.seats(), "email", h.email(), "unitPrice", unit);
  }
}

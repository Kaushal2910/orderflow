package com.orderflow.inventory;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import java.util.List;

class HoldStoreTest {
  @Test
  void doubleBooking_sameSeat_rejected() {
    HoldStore s = new HoldStore();
    s.hold("show-1", "18:00", List.of("R1C1"), "a@mail.com");
    assertThrows(IllegalStateException.class,
      () -> s.hold("show-1", "18:00", List.of("R1C1"), "b@mail.com"));
  }

  @Test
  void consume_marksSold() {
    HoldStore s = new HoldStore();
    var h = s.hold("show-1", "18:00", List.of("R2C3"), "a@mail.com");
    s.consume(h.holdId());
    assertEquals("SOLD", s.status("show-1", "18:00", "R2C3"));
  }
}

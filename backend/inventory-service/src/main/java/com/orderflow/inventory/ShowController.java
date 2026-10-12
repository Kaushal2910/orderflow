package com.orderflow.inventory;

import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

// Easy CRUD so you can add movies at last. Mirrors the UI Admin page.
@RestController
@RequestMapping("/api/shows")
public class ShowController {
  private final ShowRepo repo;
  public ShowController(ShowRepo repo) { this.repo = repo; }

  @GetMapping public List<Show> list() { return repo.findAll(); }
  @GetMapping("/{id}") public Show one(@PathVariable String id) {
    return repo.findById(id).orElseThrow(() -> new NotFound("show not found"));
  }
  @PostMapping public Show create(@RequestBody Show s) {
    if (s.id == null || s.id.isBlank()) s.id = "show-" + UUID.randomUUID().toString().substring(0, 8);
    return repo.save(s);
  }
  @PutMapping("/{id}") public Show update(@PathVariable String id, @RequestBody Show patch) {
    Show s = repo.findById(id).orElseThrow(() -> new NotFound("show not found"));
    if (patch.title != null) s.title = patch.title;
    if (patch.genre != null) s.genre = patch.genre;
    if (patch.poster != null) s.poster = patch.poster;
    if (patch.durationMin > 0) s.durationMin = patch.durationMin;
    if (patch.price > 0) s.price = patch.price;
    if (patch.times != null && !patch.times.isEmpty()) s.times = patch.times;
    return repo.save(s);
  }
  @DeleteMapping("/{id}") public void remove(@PathVariable String id) { repo.deleteById(id); }

  @ResponseStatus(org.springframework.http.HttpStatus.NOT_FOUND)
  static class NotFound extends RuntimeException { NotFound(String m) { super(m); } }
}

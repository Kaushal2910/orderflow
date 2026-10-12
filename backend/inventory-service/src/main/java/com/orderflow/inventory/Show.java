package com.orderflow.inventory;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "shows")
public class Show {
  @Id public String id;
  public String title;
  public String genre = "Custom";
  public int durationMin = 120;
  public int price = 299;
  public String poster = "🎬";
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "show_times", joinColumns = @JoinColumn(name = "show_id"))
  @Column(name = "slot")
  public List<String> times = new ArrayList<>();
}

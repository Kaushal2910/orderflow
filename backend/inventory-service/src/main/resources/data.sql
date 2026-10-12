INSERT INTO shows (id, title, genre, duration_min, price, poster) VALUES
 ('show-dune', 'Dune: Part Two', 'Sci-Fi', 166, 349, '🏜️'),
 ('show-batman', 'The Batman', 'Action', 176, 299, '🦇'),
 ('show-ghibli', 'Spirited Away (4K)', 'Anime', 125, 249, '🐉');
INSERT INTO show_times (show_id, slot) VALUES
 ('show-dune', '18:00'), ('show-dune', '21:30'),
 ('show-batman', '17:00'), ('show-batman', '20:30'),
 ('show-ghibli', '15:00'), ('show-ghibli', '19:00');

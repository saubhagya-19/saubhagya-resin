-- Adds every shop product that is not already in the products table
INSERT INTO products (name, price, active)
SELECT 'OCEAN WAVE CLOCK', 1899, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'OCEAN WAVE CLOCK');
INSERT INTO products (name, price, active)
SELECT 'GEODE AGATE CLOCK', 2299, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'GEODE AGATE CLOCK');
INSERT INTO products (name, price, active)
SELECT 'MARBLE TEXTURE CLOCK', 1650, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'MARBLE TEXTURE CLOCK');
INSERT INTO products (name, price, active)
SELECT 'BLACK & GOLD CLOCK', 1999, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'BLACK & GOLD CLOCK');
INSERT INTO products (name, price, active)
SELECT 'Flower Preservation Frame', 1299, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Flower Preservation Frame');
INSERT INTO products (name, price, active)
SELECT 'Ocean Wave Photo Frame', 3499, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Ocean Wave Photo Frame');
INSERT INTO products (name, price, active)
SELECT 'Ganesh Frame', 1699, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Ganesh Frame');
INSERT INTO products (name, price, active)
SELECT 'Varmala Preservation Frame', 2499, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Varmala Preservation Frame');
INSERT INTO products (name, price, active)
SELECT 'Rose Jhumka', 499, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Rose Jhumka');
INSERT INTO products (name, price, active)
SELECT 'Floral Pendant Set', 649, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Floral Pendant Set');
INSERT INTO products (name, price, active)
SELECT 'Ocean Wave Pendant', 599, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Ocean Wave Pendant');
INSERT INTO products (name, price, active)
SELECT 'Geode Crystal Pendant', 649, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Geode Crystal Pendant');
INSERT INTO products (name, price, active)
SELECT 'ALPHABET RESIN KEYCHAIN', 299, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'ALPHABET RESIN KEYCHAIN');
INSERT INTO products (name, price, active)
SELECT 'OCEAN WAVE KEYCHAIN', 349, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'OCEAN WAVE KEYCHAIN');
INSERT INTO products (name, price, active)
SELECT 'PHOTO MEMORY KEYCHAIN', 399, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'PHOTO MEMORY KEYCHAIN');
INSERT INTO products (name, price, active)
SELECT 'GEODE CRYSTAL KEYCHAIN', 279, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'GEODE CRYSTAL KEYCHAIN');
INSERT INTO products (name, price, active)
SELECT 'PINK GANESHA POOJA THALI', 1299, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'PINK GANESHA POOJA THALI');
INSERT INTO products (name, price, active)
SELECT 'ROYAL RED POOJA THALI', 1499, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'ROYAL RED POOJA THALI');
INSERT INTO products (name, price, active)
SELECT 'PEARL WHITE FLORAL THALI', 599, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'PEARL WHITE FLORAL THALI');
INSERT INTO products (name, price, active)
SELECT 'GOLD OM POOJA THALI', 1050, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'GOLD OM POOJA THALI');
INSERT INTO products (name, price, active)
SELECT 'Rose Initial Ring', 399, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Rose Initial Ring');
INSERT INTO products (name, price, active)
SELECT 'Rose Name Bracelet', 899, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Rose Name Bracelet');
INSERT INTO products (name, price, active)
SELECT 'Rose Kundan Earrings (Pink)', 699, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Rose Kundan Earrings (Pink)');
INSERT INTO products (name, price, active)
SELECT 'Rose Bloom Earrings (White)', 599, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Rose Bloom Earrings (White)');
INSERT INTO products (name, price, active)
SELECT 'Rose Petal Bangle (Gold Foil)', 799, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Rose Petal Bangle (Gold Foil)');
INSERT INTO products (name, price, active)
SELECT 'Rose Petal Bangle (Red)', 799, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Rose Petal Bangle (Red)');
INSERT INTO products (name, price, active)
SELECT 'Rose Heart Charm', 349, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Rose Heart Charm');
INSERT INTO products (name, price, active)
SELECT 'Rose Petal Phone Case', 599, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Rose Petal Phone Case');
INSERT INTO products (name, price, active)
SELECT 'SHUBH LABH T-LIGHT HOLDER', 999, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'SHUBH LABH T-LIGHT HOLDER');
INSERT INTO products (name, price, active)
SELECT 'FLORAL EMBEDDED HOLDER', 1249, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'FLORAL EMBEDDED HOLDER');
INSERT INTO products (name, price, active)
SELECT 'OCEAN WAVE T-LIGHT', 599, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'OCEAN WAVE T-LIGHT');
INSERT INTO products (name, price, active)
SELECT 'GEODE CRYSTAL HOLDER', 649, 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'GEODE CRYSTAL HOLDER');

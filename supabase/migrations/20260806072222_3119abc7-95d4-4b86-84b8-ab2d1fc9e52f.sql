UPDATE public.products SET brand = NULL, manufacturer = NULL WHERE brand IS NOT NULL OR manufacturer IS NOT NULL;

UPDATE public.products SET
  description_ru = regexp_replace(regexp_replace(coalesce(description_ru,''), '(?i)masteraform[^[:space:],;.]*', ' ', 'g'), '(?i)(мастера\s*форм[а-яіїєґ]*|днепропетровск[а-яё]*|дніпропетровськ[а-яіїєґ]*|\mднепр\M|\mдніпро\M)', ' ', 'g'),
  description_uk = regexp_replace(regexp_replace(coalesce(description_uk,''), '(?i)masteraform[^[:space:],;.]*', ' ', 'g'), '(?i)(майстра?\s*форм[а-яіїєґ]*|мастера\s*форм[а-яё]*|дніпропетровськ[а-яіїєґ]*|\mдніпро\M)', ' ', 'g');
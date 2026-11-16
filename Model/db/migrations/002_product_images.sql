UPDATE products
SET image_path = '/products/' || id || '.jpg'
WHERE image_path = '/products/placeholder.svg'
  AND id IN (
    'chocolate-belga', 'baunilha-frutas-vermelhas', 'red-velvet', 'limao-siciliano',
    'cenoura-chocolate', 'doce-de-leite', 'coco-queimado', 'morango-creme',
    'cafe-chocolate', 'pistache'
  );

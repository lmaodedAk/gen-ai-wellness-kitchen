// Utility: map recipe titles to curated food images
// Uses ordered Array (not Object) so longer/more specific keywords match first

/**
 * Get a curated food image URL based on the recipe title.
 * Uses ordered keyword matching — longer/more specific keywords first.
 * Uses Unsplash Source API for dynamic fallback images.
 */
export function recipeImage(title: string): string {
  if (!title) return unsplash('Indian food healthy plate')
  
  const t = title.toLowerCase()
  
  // Check LONGER/MORE SPECIFIC keywords first
  const mappings: [string, string][] = [
    // === BENGALI ===
    ['chirer polao',       unsplash('Bengali poha flattened rice dish')],
    ['aloo posto',         unsplash('Bengali aloo posto potato poppy seeds')],
    ['shorshe ilish',      unsplash('hilsa fish mustard Bengali')],
    ['macher jhol',        unsplash('Bengali fish curry macher jhol')],
    ['mishti doi',         unsplash('Bengali sweet yogurt mishti doi')],
    ['rasgulla',           unsplash('rasgulla Bengali sweet')],
    ['luchi',              unsplash('Bengali luchi puri fried bread')],
    ['begun bhaja',        unsplash('Bengali eggplant fried begun')],
    ['khichuri',           unsplash('Bengali khichdi khichuri rice lentil')],

    // === BREAKFAST ===
    ['oats porridge',      'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?w=800&q=80'],
    ['masala oats',        'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?w=800&q=80'],
    ['oats',               'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?w=800&q=80'],
    ['porridge',           'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?w=800&q=80'],
    ['poha',               'https://images.unsplash.com/photo-1567337710282-00832b415979?w=800&q=80'],
    ['upma',               'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80'],
    ['idli',               'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80'],
    ['dosa',               'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80'],
    ['uttapam',            'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80'],
    ['aloo paratha',       'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80'],
    ['paratha',            'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80'],
    ['roti',               'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80'],
    ['naan',               'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80'],
    ['smoothie',           'https://images.unsplash.com/photo-1502741224143-90386d7f8c82?w=800&q=80'],
    ['chai',               'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80'],
    ['tea',                'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80'],

    // === RICE DISHES ===
    ['biryani',            'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80'],
    ['pulao',              'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=800&q=80'],
    ['polao',              'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=800&q=80'],
    ['fried rice',         'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&q=80'],
    ['khichdi',            'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=800&q=80'],
    ['rice',               'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=800&q=80'],

    // === CURRIES ===
    ['butter chicken',     'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&q=80'],
    ['chicken curry',      'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&q=80'],
    ['palak paneer',       'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80'],
    ['paneer tikka',       'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80'],
    ['paneer',             'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80'],
    ['dal makhani',        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80'],
    ['dal tadka',          'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80'],
    ['moong dal',          'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80'],
    ['dal',                'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&q=80'],
    ['chole bhature',      'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80'],
    ['chole',              'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80'],
    ['rajma',              'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80'],
    ['sambar',             'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80'],
    ['curry',              'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80'],
    ['korma',              'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80'],
    ['masala',             'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80'],
    ['tandoori',           'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80'],
    ['tikka',              'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80'],

    // === PROTEIN / NON-VEG ===
    ['mutton',             'https://images.unsplash.com/photo-1545247181-516773cae754?w=800&q=80'],
    ['chicken',            'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&q=80'],
    ['fish curry',         'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80'],
    ['fish',               'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80'],
    ['prawn',              'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800&q=80'],
    ['egg bhurji',         'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80'],
    ['egg',                'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80'],

    // === VEGAN / HEALTHY ===
    ['tofu',               unsplash('tofu stir fry healthy plant based')],
    ['edamame',            unsplash('edamame green beans healthy')],
    ['seitan',             unsplash('seitan wheat protein vegan')],
    ['lentil',             unsplash('lentil soup healthy vegetarian')],
    ['quinoa',             unsplash('quinoa salad bowl healthy')],
    ['avocado',            unsplash('avocado toast healthy breakfast')],
    ['salad',              'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80'],
    ['soup',               'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80'],

    // === STREET FOOD ===
    ['pav bhaji',          'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=80'],
    ['vada pav',           'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=80'],
    ['samosa',             'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80'],
    ['chaat',              'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=80'],

    // === WORLD CUISINE ===
    ['pasta',              'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=800&q=80'],
    ['pizza',              'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80'],
    ['burger',             'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80'],
    ['sandwich',           'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=800&q=80'],
    ['noodles',            'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80'],
    ['manchurian',         'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80'],
    ['sushi',              unsplash('sushi Japanese food rolls')],
    ['ramen',              unsplash('ramen Japanese noodle soup bowl')],
    ['falafel',            unsplash('falafel Mediterranean street food')],
    ['hummus',             unsplash('hummus pita bread Mediterranean')],
    ['taco',               unsplash('tacos Mexican street food')],

    // === SWEETS / DESSERT ===
    ['halwa',              'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=800&q=80'],
    ['kheer',              'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=800&q=80'],
    ['ladoo',              'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=800&q=80'],
    ['gulab jamun',        'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=800&q=80'],
    
    // === SNACKS ===
    ['almond',             unsplash('roasted almonds nuts healthy snack')],
    ['walnut',             unsplash('walnuts nuts healthy snack')],
    ['nuts',               unsplash('mixed nuts healthy snack')],
    ['roasted',            unsplash('roasted snacks healthy')],
    ['sprout',             unsplash('sprouts salad healthy vegan')],
  ]
  
  // Use Array (not Object) so order is preserved
  for (const [keyword, url] of mappings) {
    if (t.includes(keyword)) return url
  }
  
  // Dynamic fallback — use dish title as Unsplash search query
  return unsplash(title)
}

/**
 * Dynamic Unsplash image search URL
 * Uses Unsplash Source which picks a random suitable image
 */
function unsplash(query: string): string {
  // Encode query for URL safety
  const encoded = encodeURIComponent(query.slice(0, 60))
  // Use picsum as truly reliable fallback (Unsplash Source deprecated)
  // We use a seeded hash from the query for consistent images per dish
  const seed = query.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
  const positiveHash = Math.abs(seed)
  // Use curated food photography collection from Unsplash
  const FOOD_IDS = [
    '1585937421612-70a008356fbe', '1546833999-b9f581a1996d',
    '1601050690597-df0568f70950', '1563379091339-03b21ab4a4f8',
    '1516684732162-798a0062be99', '1512621776951-a57141f2eefd',
    '1565557623262-b51c2513a641', '1603894584373-5ac82b2ae398',
    '1589301760014-d929f3979dbc', '1567337710282-00832b415979',
    '1495214783159-3503fd1b572d', '1532550907401-a500c9a57435',
    '1599487488170-d11ec9c172f0', '1547592180-85f173990554',
    '1569718212165-3a8278d5f624', '1606491956689-2ea866880c84',
  ]
  const imageId = FOOD_IDS[positiveHash % FOOD_IDS.length]
  return `https://images.unsplash.com/photo-${imageId}?w=800&q=80`
}

// Backward compat alias
export const foodImage = recipeImage

/**
 * Get a smaller thumbnail for meal planner slots
 */
export function foodThumb(title: string): string {
  return recipeImage(title).replace('w=800', 'w=120').replace('q=80', 'q=60')
}

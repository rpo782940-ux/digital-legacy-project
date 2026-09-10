<?php
/**
 * Configuration for the Techno Forma data bridge.
 *
 * Copy this file to config.php on the HostUkraine hosting and fill in the real
 * values. config.php must never be committed to the repository.
 *
 * Two completely independent connections:
 *   CATALOG_* -> masteraf_new  (old OpenCart shop, READ ONLY, never written to)
 *   SHOP_*    -> new database  (customers / orders / cart of the new site)
 */

return [
    // Shared secret. Must be identical to MYSQL_BRIDGE_SECRET in the new site.
    'secret' => 'PUT-A-LONG-RANDOM-STRING-HERE',

    // Максимальное расхождение времени запроса в секундах.
    'max_skew' => 300,

    'catalog' => [
        'host'     => 'masteraf.mysql.tools',
        'port'     => 3306,
        'database' => 'masteraf_new',
        // MySQL user with SELECT privilege only.
        'user'     => 'masteraf_ro',
        'password' => '',
        'prefix'   => 'oc_',
        // OpenCart language_id values used by the old shop.
        'lang_ru'  => 1,
        'lang_uk'  => 2,
        // Store id used by the old shop (usually 0).
        'store_id' => 0,
    ],

    'shop' => [
        'host'     => 'masteraf.mysql.tools',
        'port'     => 3306,
        'database' => 'masteraf_shop',
        'user'     => 'masteraf_shop',
        'password' => '',
    ],
];

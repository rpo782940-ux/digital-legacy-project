<?php
/**
 * Configuration for the Techno Forma data bridge.
 *
 * Copy this file to config.php on the HostUkraine hosting and fill in the real
 * values. config.php must never be committed to the repository.
 *
 * Two completely independent connections:
 *   catalog -> masteraf_new           (old OpenCart shop, READ ONLY)
 *   shop    -> masteraf_technoforma   (customers / orders / cart of the new site)
 */

return [
    // Shared secret. Must be identical to MYSQL_BRIDGE_SECRET in the new site.
    // The new site currently signs with: MasteraForm_Secret_Bridge_2026_SecureKey
    'secret' => 'MasteraForm_Secret_Bridge_2026_SecureKey',

    // Максимальное расхождение времени запроса в секундах.
    'max_skew' => 300,

    'catalog' => [
        'host'     => 'masteraf.mysql.tools',
        'port'     => 3306,
        'database' => 'masteraf_new',
        // MySQL user with SELECT privilege only.
        'user'     => 'PUT-CATALOG-DB-USER-HERE',
        'password' => 'PUT-CATALOG-DB-PASSWORD-HERE',
        // The old shop uses unprefixed tables (product, category, ...).
        'prefix'   => '',
        // OpenCart language_id values of the old shop (table `language`).
        'lang_ru'  => 1,
        'lang_uk'  => 2,
        // Store id used by the old shop (usually 0).
        'store_id' => 0,
    ],

    'shop' => [
        'host'     => 'masteraf.mysql.tools',
        'port'     => 3306,
        'database' => 'masteraf_technoforma',
        'user'     => 'PUT-SHOP-DB-USER-HERE',
        'password' => 'PUT-SHOP-DB-PASSWORD-HERE',
    ],
];

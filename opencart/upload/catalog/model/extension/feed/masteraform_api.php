<?php
/**
 * MasteraForm Sync REST API - model layer (OpenCart 3.0.x).
 *
 * Reads the standard OpenCart catalog tables only. No third-party modules,
 * no XML, no temporary tables.
 */
class ModelExtensionFeedMasteraformApi extends Model {

	private $languages = null;

	private function languages() {
		if ($this->languages === null) {
			$this->languages = array();
			$query = $this->db->query("SELECT language_id, code FROM " . DB_PREFIX . "language WHERE status = '1'");
			foreach ($query->rows as $row) {
				$this->languages[(int)$row['language_id']] = $this->shortCode($row['code']);
			}
		}
		return $this->languages;
	}

	private function shortCode($code) {
		$code = strtolower(substr($code, 0, 2));
		return $code === 'ua' ? 'uk' : $code;
	}

	public function getLanguageCodes() {
		return array_values(array_unique($this->languages()));
	}

	public function getCounts() {
		$categories = $this->db->query("SELECT COUNT(*) AS total FROM " . DB_PREFIX . "category WHERE status = '1'")->row['total'];
		$products   = $this->db->query("SELECT COUNT(*) AS total FROM " . DB_PREFIX . "product WHERE status = '1'")->row['total'];

		return array('categories' => (int)$categories, 'products' => (int)$products);
	}

	public function getCategories() {
		$categories = array();

		$query = $this->db->query("
			SELECT c.category_id, c.parent_id, c.image, c.sort_order, c.status, c.date_modified
			FROM " . DB_PREFIX . "category c
			WHERE c.status = '1'
			ORDER BY c.parent_id ASC, c.sort_order ASC
		");

		foreach ($query->rows as $row) {
			$categories[(int)$row['category_id']] = array(
				'id'            => (int)$row['category_id'],
				'parent_id'     => (int)$row['parent_id'],
				'image'         => $this->imageUrl($row['image']),
				'sort_order'    => (int)$row['sort_order'],
				'date_modified' => $row['date_modified'],
				'seo_url'       => $this->seoUrl('category_id=' . (int)$row['category_id']),
				'translations'  => array()
			);
		}

		if (!$categories) {
			return array();
		}

		$descriptions = $this->db->query("
			SELECT category_id, language_id, name, description, meta_title, meta_description
			FROM " . DB_PREFIX . "category_description
			WHERE category_id IN (" . implode(',', array_keys($categories)) . ")
		");

		$languages = $this->languages();

		foreach ($descriptions->rows as $row) {
			$language_id = (int)$row['language_id'];
			if (!isset($languages[$language_id]) || !isset($categories[(int)$row['category_id']])) {
				continue;
			}

			$categories[(int)$row['category_id']]['translations'][$languages[$language_id]] = array(
				'name'             => html_entity_decode($row['name'], ENT_QUOTES, 'UTF-8'),
				'h1'               => html_entity_decode($row['name'], ENT_QUOTES, 'UTF-8'),
				'description'      => html_entity_decode($row['description'], ENT_QUOTES, 'UTF-8'),
				'meta_title'       => html_entity_decode($row['meta_title'], ENT_QUOTES, 'UTF-8'),
				'meta_description' => html_entity_decode($row['meta_description'], ENT_QUOTES, 'UTF-8')
			);
		}

		return array_values($categories);
	}

	public function getTotalProducts($since = '') {
		$sql = "SELECT COUNT(*) AS total FROM " . DB_PREFIX . "product p WHERE p.status = '1'";

		if ($since) {
			$sql .= " AND p.date_modified >= '" . $this->db->escape($since) . "'";
		}

		return (int)$this->db->query($sql)->row['total'];
	}

	public function getProducts($limit, $offset, $since = '') {
		$sql = "
			SELECT p.product_id
			FROM " . DB_PREFIX . "product p
			WHERE p.status = '1'
		";

		if ($since) {
			$sql .= " AND p.date_modified >= '" . $this->db->escape($since) . "'";
		}

		$sql .= " ORDER BY p.date_modified DESC, p.product_id ASC LIMIT " . (int)$offset . "," . (int)$limit;

		$products = array();
		foreach ($this->db->query($sql)->rows as $row) {
			$product = $this->getProduct((int)$row['product_id']);
			if ($product) {
				$products[] = $product;
			}
		}

		return $products;
	}

	public function getActiveProductIds() {
		$ids = array();
		foreach ($this->db->query("SELECT product_id FROM " . DB_PREFIX . "product WHERE status = '1'")->rows as $row) {
			$ids[] = (int)$row['product_id'];
		}
		return $ids;
	}

	public function getProduct($product_id) {
		$product_id = (int)$product_id;

		$query = $this->db->query("
			SELECT p.*, m.name AS manufacturer
			FROM " . DB_PREFIX . "product p
			LEFT JOIN " . DB_PREFIX . "manufacturer m ON (m.manufacturer_id = p.manufacturer_id)
			WHERE p.product_id = '" . $product_id . "'
		");

		if (!$query->num_rows) {
			return null;
		}

		$row = $query->row;
		$languages = $this->languages();

		$product = array(
			'id'            => $product_id,
			'model'         => $row['model'],
			'sku'           => $row['sku'],
			'status'        => (int)$row['status'] === 1,
			'price'         => round((float)$row['price'], 2),
			'special'       => $this->getSpecial($product_id),
			'discounts'     => $this->getDiscounts($product_id),
			'quantity'      => (int)$row['quantity'],
			'in_stock'      => (int)$row['quantity'] > 0 || (int)$row['stock_status_id'] > 0,
			'manufacturer'  => $row['manufacturer'],
			'brand'         => $row['manufacturer'],
			'sort_order'    => (int)$row['sort_order'],
			'date_modified' => $row['date_modified'],
			'seo_url'       => $this->seoUrl('product_id=' . $product_id),
			'image'         => $this->imageUrl($row['image']),
			'gallery'       => $this->getGallery($product_id),
			'categories'    => $this->getProductCategories($product_id),
			'attributes'    => array(),
			'translations'  => array()
		);

		$descriptions = $this->db->query("
			SELECT language_id, name, description, meta_title, meta_description, meta_keyword, tag
			FROM " . DB_PREFIX . "product_description
			WHERE product_id = '" . $product_id . "'
		");

		foreach ($descriptions->rows as $description) {
			$language_id = (int)$description['language_id'];
			if (!isset($languages[$language_id])) {
				continue;
			}

			$product['translations'][$languages[$language_id]] = array(
				'name'             => html_entity_decode($description['name'], ENT_QUOTES, 'UTF-8'),
				'h1'               => html_entity_decode($description['name'], ENT_QUOTES, 'UTF-8'),
				'description'      => html_entity_decode($description['description'], ENT_QUOTES, 'UTF-8'),
				'meta_title'       => html_entity_decode($description['meta_title'], ENT_QUOTES, 'UTF-8'),
				'meta_description' => html_entity_decode($description['meta_description'], ENT_QUOTES, 'UTF-8'),
				'tags'             => array_values(array_filter(array_map('trim', explode(',', (string)$description['tag']))))
			);
		}

		$attributes = $this->db->query("
			SELECT pa.attribute_id, pa.language_id, pa.text, ad.name
			FROM " . DB_PREFIX . "product_attribute pa
			LEFT JOIN " . DB_PREFIX . "attribute_description ad
				ON (ad.attribute_id = pa.attribute_id AND ad.language_id = pa.language_id)
			WHERE pa.product_id = '" . $product_id . "'
		");

		foreach ($attributes->rows as $attribute) {
			$language_id = (int)$attribute['language_id'];
			if (!isset($languages[$language_id])) {
				continue;
			}

			$product['attributes'][] = array(
				'language' => $languages[$language_id],
				'name'     => html_entity_decode((string)$attribute['name'], ENT_QUOTES, 'UTF-8'),
				'value'    => html_entity_decode((string)$attribute['text'], ENT_QUOTES, 'UTF-8')
			);
		}

		return $product;
	}

	private function getSpecial($product_id) {
		$query = $this->db->query("
			SELECT price FROM " . DB_PREFIX . "product_special
			WHERE product_id = '" . (int)$product_id . "'
				AND ((date_start = '0000-00-00' OR date_start < NOW()) AND (date_end = '0000-00-00' OR date_end > NOW()))
			ORDER BY priority ASC, price ASC
			LIMIT 1
		");

		return $query->num_rows ? round((float)$query->row['price'], 2) : null;
	}

	private function getDiscounts($product_id) {
		$discounts = array();

		$query = $this->db->query("
			SELECT quantity, price FROM " . DB_PREFIX . "product_discount
			WHERE product_id = '" . (int)$product_id . "'
				AND ((date_start = '0000-00-00' OR date_start < NOW()) AND (date_end = '0000-00-00' OR date_end > NOW()))
			ORDER BY quantity ASC
		");

		foreach ($query->rows as $row) {
			$discounts[] = array('quantity' => (int)$row['quantity'], 'price' => round((float)$row['price'], 2));
		}

		return $discounts;
	}

	private function getGallery($product_id) {
		$gallery = array();

		$query = $this->db->query("
			SELECT image FROM " . DB_PREFIX . "product_image
			WHERE product_id = '" . (int)$product_id . "'
			ORDER BY sort_order ASC
		");

		foreach ($query->rows as $row) {
			$url = $this->imageUrl($row['image']);
			if ($url && !in_array($url, $gallery, true)) {
				$gallery[] = $url;
			}
		}

		return $gallery;
	}

	private function getProductCategories($product_id) {
		$categories = array();

		$query = $this->db->query("
			SELECT category_id FROM " . DB_PREFIX . "product_to_category
			WHERE product_id = '" . (int)$product_id . "'
		");

		foreach ($query->rows as $row) {
			$categories[] = (int)$row['category_id'];
		}

		return $categories;
	}

	/** Always the untouched original file, never a resized cache copy. */
	private function imageUrl($image) {
		if (!$image) {
			return null;
		}

		return rtrim(HTTPS_SERVER ? HTTPS_SERVER : HTTP_SERVER, '/') . '/image/' . str_replace('%2F', '/', rawurlencode($image));
	}

	private function seoUrl($keyValue) {
		$query = $this->db->query("
			SELECT keyword FROM " . DB_PREFIX . "seo_url
			WHERE query = '" . $this->db->escape($keyValue) . "'
			ORDER BY seo_url_id ASC LIMIT 1
		");

		return $query->num_rows ? $query->row['keyword'] : null;
	}
}

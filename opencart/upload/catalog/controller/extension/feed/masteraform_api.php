<?php
/**
 * MasteraForm Sync REST API (OpenCart 3.0.x)
 *
 * Public JSON API used by the new site to pull the catalog.
 * Route: index.php?route=extension/feed/masteraform_api/<method>
 *
 * Auth: header `X-Api-Key` (or ?key=) must match the value configured in
 * admin -> Extensions -> Feeds -> MasteraForm Sync API, which is stored in the
 * standard OpenCart settings table (`feed_masteraform_api_key`).
 *
 * Methods:
 *   /ping        -> service info
 *   /categories  -> all categories with SEO + descriptions per language
 *   /products    -> paginated products (limit, page, since)
 *   /product     -> single product (product_id)
 *   /deleted     -> ids of products that are no longer active
 */
class ControllerExtensionFeedMasteraformApi extends Controller {

	public function index() {
		$this->ping();
	}

	public function ping() {
		if (!$this->authorize()) { return; }

		$this->load->model('extension/feed/masteraform_api');

		$this->respond(array(
			'service'   => 'masteraform-sync',
			'version'   => '1.0.0',
			'opencart'  => VERSION,
			'languages' => $this->model_extension_feed_masteraform_api->getLanguageCodes(),
			'counts'    => $this->model_extension_feed_masteraform_api->getCounts(),
			'server_time' => date('c')
		));
	}

	public function categories() {
		if (!$this->authorize()) { return; }

		$this->load->model('extension/feed/masteraform_api');

		$this->respond(array(
			'categories' => $this->model_extension_feed_masteraform_api->getCategories()
		));
	}

	public function products() {
		if (!$this->authorize()) { return; }

		$this->load->model('extension/feed/masteraform_api');

		$limit = isset($this->request->get['limit']) ? (int)$this->request->get['limit'] : 200;
		$limit = max(1, min($limit, 500));
		$page  = isset($this->request->get['page']) ? max(1, (int)$this->request->get['page']) : 1;
		$since = isset($this->request->get['since']) ? trim($this->request->get['since']) : '';

		$total = $this->model_extension_feed_masteraform_api->getTotalProducts($since);
		$rows  = $this->model_extension_feed_masteraform_api->getProducts($limit, ($page - 1) * $limit, $since);

		$this->respond(array(
			'page'        => $page,
			'limit'       => $limit,
			'total'       => $total,
			'total_pages' => (int)ceil($total / $limit),
			'since'       => $since,
			'products'    => $rows
		));
	}

	public function product() {
		if (!$this->authorize()) { return; }

		$this->load->model('extension/feed/masteraform_api');

		$product_id = isset($this->request->get['product_id']) ? (int)$this->request->get['product_id'] : 0;
		$product = $this->model_extension_feed_masteraform_api->getProduct($product_id);

		if (!$product) {
			$this->respond(array('error' => 'product_not_found'), 404);
			return;
		}

		$this->respond(array('product' => $product));
	}

	public function deleted() {
		if (!$this->authorize()) { return; }

		$this->load->model('extension/feed/masteraform_api');

		$this->respond(array(
			'active_ids' => $this->model_extension_feed_masteraform_api->getActiveProductIds()
		));
	}

	private function authorize() {
		$expected = (string)$this->config->get('feed_masteraform_api_key');

		$provided = '';
		if (isset($this->request->server['HTTP_X_API_KEY'])) {
			$provided = (string)$this->request->server['HTTP_X_API_KEY'];
		} elseif (isset($this->request->get['key'])) {
			$provided = (string)$this->request->get['key'];
		}

		if ($expected === '' || !hash_equals($expected, $provided)) {
			$this->respond(array('error' => 'unauthorized'), 401);
			return false;
		}

		return true;
	}

	private function respond($payload, $status = 200) {
		$this->response->addHeader('HTTP/1.1 ' . $status);
		$this->response->addHeader('Content-Type: application/json; charset=utf-8');
		$this->response->addHeader('Cache-Control: no-store');
		$this->response->setOutput(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
	}
}

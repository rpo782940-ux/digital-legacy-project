<?php
/**
 * Admin settings screen for the MasteraForm Sync REST API (OpenCart 3.0.x).
 * Extensions -> Feeds -> MasteraForm Sync API
 */
class ControllerExtensionFeedMasteraformApi extends Controller {

	private $error = array();

	public function index() {
		$this->load->language('extension/feed/masteraform_api');
		$this->document->setTitle($this->language->get('heading_title'));
		$this->load->model('setting/setting');

		if (($this->request->server['REQUEST_METHOD'] == 'POST') && $this->validate()) {
			$this->model_setting_setting->editSetting('feed_masteraform_api', $this->request->post);
			$this->session->data['success'] = $this->language->get('text_success');
			$this->response->redirect($this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=feed', true));
		}

		$data = array();
		$data['heading_title'] = $this->language->get('heading_title');
		$data['entry_status']  = $this->language->get('entry_status');
		$data['entry_key']     = $this->language->get('entry_key');
		$data['entry_url']     = $this->language->get('entry_url');
		$data['button_save']   = $this->language->get('button_save');
		$data['button_cancel'] = $this->language->get('button_cancel');
		$data['text_edit']     = $this->language->get('text_edit');
		$data['error_warning'] = isset($this->error['warning']) ? $this->error['warning'] : '';

		$data['action'] = $this->url->link('extension/feed/masteraform_api', 'user_token=' . $this->session->data['user_token'], true);
		$data['cancel'] = $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=feed', true);

		$data['feed_masteraform_api_status'] = $this->request->post['feed_masteraform_api_status']
			?? $this->config->get('feed_masteraform_api_status');

		$data['feed_masteraform_api_key'] = $this->request->post['feed_masteraform_api_key']
			?? $this->config->get('feed_masteraform_api_key');

		$data['api_url'] = HTTP_CATALOG . 'index.php?route=extension/feed/masteraform_api';

		$data['header']      = $this->load->controller('common/header');
		$data['column_left'] = $this->load->controller('common/column_left');
		$data['footer']      = $this->load->controller('common/footer');

		$this->response->setOutput($this->load->view('extension/feed/masteraform_api', $data));
	}

	private function validate() {
		if (!$this->user->hasPermission('modify', 'extension/feed/masteraform_api')) {
			$this->error['warning'] = $this->language->get('error_permission');
		}

		if (empty($this->request->post['feed_masteraform_api_key']) || strlen($this->request->post['feed_masteraform_api_key']) < 24) {
			$this->error['warning'] = $this->language->get('error_key');
		}

		return !$this->error;
	}
}

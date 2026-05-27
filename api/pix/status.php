<?php

require_once dirname(__DIR__) . '/_bootstrap.php';

handle_options('GET');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(405, array('message' => 'Method not allowed'));
}

$id = isset($_GET['id']) ? trim((string) $_GET['id']) : '';
if ($id === '') {
    json_response(400, array('message' => 'ID ausente.'));
}

try {
    $response = nexus_request('GET', '/api/pix/' . rawurlencode($id), null);
    proxy_json_response($response);
} catch (Throwable $error) {
    json_response(500, array('message' => $error->getMessage() ?: 'Falha ao processar a requisicao.'));
}


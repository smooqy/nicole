<?php

require_once dirname(__DIR__) . '/_bootstrap.php';

handle_options('POST');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, array('message' => 'Method not allowed'));
}

try {
    $payload = read_json_body();
    $response = nexus_request('POST', '/api/pix/create', nexus_payload($payload));
    proxy_json_response($response);
} catch (Throwable $error) {
    json_response(500, array('message' => $error->getMessage() ?: 'Falha ao processar a requisicao.'));
}


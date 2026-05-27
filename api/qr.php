<?php

require_once __DIR__ . '/_bootstrap.php';

handle_options('GET');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(405, array('message' => 'Method not allowed'));
}

$data = isset($_GET['data']) ? (string) $_GET['data'] : '';
if ($data === '') {
    json_response(400, array('message' => 'Codigo PIX ausente.'));
}

try {
    $url = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=png&data=' . rawurlencode(substr($data, 0, 4096));
    $response = http_request('GET', $url, array(), null);
    if ($response['status'] >= 400) {
        json_response(502, array('message' => 'Falha ao gerar QR Code.'));
    }
    http_response_code(200);
    header('Content-Type: image/png');
    header('Cache-Control: no-store');
    echo $response['body'];
    exit;
} catch (Throwable $error) {
    json_response(500, array('message' => 'Falha ao gerar QR Code.'));
}


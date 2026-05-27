<?php

function app_env($name) {
    static $env = null;
    if ($env === null) {
        $env = array();
        $path = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
        if (is_file($path) && is_readable($path)) {
            $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || strpos($line, '#') === 0 || strpos($line, '=') === false) {
                    continue;
                }
                list($key, $rawValue) = explode('=', $line, 2);
                $key = trim($key);
                $rawValue = trim($rawValue);
                $rawValue = trim($rawValue, "\"'");
                if ($key !== '') {
                    $env[$key] = $rawValue;
                }
            }
        }
    }

    if (isset($env[$name]) && $env[$name] !== '') {
        return $env[$name];
    }

    $value = getenv($name);
    if ($value !== false && $value !== '') {
        return $value;
    }

    return '';
}

function cors_headers($methods) {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: ' . $methods . ',OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type,Authorization');
    header('Access-Control-Max-Age: 86400');
}

function handle_options($methods) {
    cors_headers($methods);
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function json_response($status, $payload) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_json_body() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    if (!is_array($data)) {
        json_response(400, array('message' => 'JSON invalido.'));
    }
    return $data;
}

function nexus_payload($payload) {
    $amount = isset($payload['amount']) ? (float) $payload['amount'] : 0;
    if (!is_finite($amount) || $amount <= 0) {
        json_response(400, array('message' => 'Valor do PIX invalido.'));
    }

    $description = isset($payload['description']) ? (string) $payload['description'] : 'Nicole Rodrigues';
    $externalId = isset($payload['external_id']) ? (string) $payload['external_id'] : 'nicole-' . time();

    $body = array(
        'amount' => round($amount, 2),
        'description' => substr($description, 0, 120),
        'external_id' => substr($externalId, 0, 80),
    );

    $webhookUrl = isset($payload['webhook_url']) ? (string) $payload['webhook_url'] : app_env('NEXUSPAG_WEBHOOK_URL');
    if ($webhookUrl !== '') {
        $body['webhook_url'] = $webhookUrl;
    }

    return $body;
}

function http_request($method, $url, $headers, $body = null) {
    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt($curl, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl, CURLOPT_HEADER, true);
        curl_setopt($curl, CURLOPT_TIMEOUT, 45);
        curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
        if ($body !== null) {
            curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
        }
        $raw = curl_exec($curl);
        if ($raw === false) {
            $error = curl_error($curl);
            curl_close($curl);
            throw new Exception($error ?: 'Falha ao conectar.');
        }
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $headerSize = (int) curl_getinfo($curl, CURLINFO_HEADER_SIZE);
        $responseBody = substr($raw, $headerSize);
        $contentType = curl_getinfo($curl, CURLINFO_CONTENT_TYPE);
        curl_close($curl);
        return array('status' => $status ?: 500, 'body' => $responseBody, 'content_type' => $contentType ?: 'application/json; charset=utf-8');
    }

    $context = stream_context_create(array(
        'http' => array(
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'content' => $body,
            'timeout' => 45,
            'ignore_errors' => true,
        ),
    ));
    $responseBody = file_get_contents($url, false, $context);
    if ($responseBody === false) {
        throw new Exception('Falha ao conectar.');
    }

    $status = 500;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $matches)) {
        $status = (int) $matches[1];
    }
    return array('status' => $status, 'body' => $responseBody, 'content_type' => 'application/json; charset=utf-8');
}

function nexus_request($method, $path, $payload = null) {
    $apiKey = app_env('NEXUSPAG_API_KEY');
    if ($apiKey === '') {
        json_response(500, array('message' => 'NEXUSPAG_API_KEY nao configurada no cPanel.'));
    }

    $body = $payload === null ? null : json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $headers = array(
        'x-api-key: ' . $apiKey,
        'Content-Type: application/json',
    );
    if ($body !== null) {
        $headers[] = 'Content-Length: ' . strlen($body);
    }

    return http_request($method, 'https://nexuspag.com' . $path, $headers, $body);
}

function proxy_json_response($response) {
    $status = isset($response['status']) ? (int) $response['status'] : 500;
    $body = isset($response['body']) ? (string) $response['body'] : '';

    if (($status === 401 || $status === 403) && trim($body) === '') {
        json_response($status, array(
            'message' => 'NexusPag recusou a chave da API na hospedagem. Confira o NEXUSPAG_API_KEY do arquivo .env enviado para o public_html.'
        ));
    }

    if (trim($body) === '') {
        json_response($status, array('message' => 'A API de pagamento retornou uma resposta vazia.'));
    }

    http_response_code($status);
    header('Content-Type: ' . ($response['content_type'] ?: 'application/json; charset=utf-8'));
    header('Cache-Control: no-store');
    echo $body;
    exit;
}

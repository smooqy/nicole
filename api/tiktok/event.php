<?php

require_once dirname(__DIR__) . '/_bootstrap.php';

handle_options('POST');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, array('message' => 'Method not allowed'));
}

function tiktok_hash_value($value) {
    $value = trim((string) $value);
    if ($value === '') {
        return '';
    }
    return hash('sha256', strtolower($value));
}

function tiktok_client_ip() {
    $headers = array('HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR');
    foreach ($headers as $header) {
        if (empty($_SERVER[$header])) {
            continue;
        }
        $value = (string) $_SERVER[$header];
        if ($header === 'HTTP_X_FORWARDED_FOR') {
            $parts = explode(',', $value);
            $value = trim($parts[0]);
        }
        if ($value !== '') {
            return $value;
        }
    }
    return '';
}

function tiktok_compact($payload) {
    $out = array();
    foreach ($payload as $key => $value) {
        if ($value !== null && $value !== '') {
            $out[$key] = $value;
        }
    }
    return $out;
}

function tiktok_event_payload($input) {
    $pixelId = app_env('TIKTOK_PIXEL_ID');
    if ($pixelId === '') {
        $pixelId = 'D8BNOO3C77U6KT5BR3B0';
    }

    $eventName = isset($input['event']) ? (string) $input['event'] : '';
    if ($eventName === '') {
        json_response(400, array('message' => 'Evento ausente.'));
    }

    $eventId = isset($input['event_id']) ? (string) $input['event_id'] : $eventName . '_' . time() . '_' . bin2hex(random_bytes(4));
    $properties = isset($input['properties']) && is_array($input['properties']) ? $input['properties'] : array();
    $userInput = isset($input['user']) && is_array($input['user']) ? $input['user'] : array();
    $pageInput = isset($input['page']) && is_array($input['page']) ? $input['page'] : array();

    $user = tiktok_compact(array(
        'ttclid' => isset($userInput['ttclid']) ? (string) $userInput['ttclid'] : '',
        'ttp' => isset($userInput['ttp']) ? (string) $userInput['ttp'] : '',
        'email' => isset($userInput['email']) ? tiktok_hash_value($userInput['email']) : '',
        'phone' => isset($userInput['phone']) ? tiktok_hash_value(preg_replace('/\D+/', '', (string) $userInput['phone'])) : '',
        'external_id' => isset($userInput['external_id']) ? tiktok_hash_value($userInput['external_id']) : '',
        'ip' => tiktok_client_ip(),
        'user_agent' => isset($_SERVER['HTTP_USER_AGENT']) ? (string) $_SERVER['HTTP_USER_AGENT'] : '',
    ));

    $page = tiktok_compact(array(
        'url' => isset($pageInput['url']) ? (string) $pageInput['url'] : '',
        'referrer' => isset($pageInput['referrer']) ? (string) $pageInput['referrer'] : '',
    ));

    $event = array(
        'event' => $eventName,
        'event_time' => isset($input['event_time']) ? (int) $input['event_time'] : time(),
        'event_id' => $eventId,
        'user' => $user,
        'properties' => $properties,
    );

    if (!empty($page)) {
        $event['page'] = $page;
    }

    $payload = array(
        'event_source' => 'web',
        'event_source_id' => $pixelId,
        'data' => array($event),
    );

    $testCode = app_env('TIKTOK_TEST_EVENT_CODE');
    if ($testCode !== '') {
        $payload['test_event_code'] = $testCode;
    }

    return $payload;
}

try {
    $token = app_env('TIKTOK_EVENTS_API_TOKEN');
    if ($token === '') {
        json_response(500, array('message' => 'TIKTOK_EVENTS_API_TOKEN nao configurado.'));
    }

    $input = read_json_body();
    $payload = tiktok_event_payload($input);
    $response = http_request(
        'POST',
        'https://business-api.tiktok.com/open_api/v1.3/event/track/',
        array(
            'Access-Token: ' . $token,
            'Content-Type: application/json',
        ),
        json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    );

    $body = trim((string) $response['body']);
    $decoded = $body !== '' ? json_decode($body, true) : null;
    json_response(
        ($response['status'] >= 200 && $response['status'] < 300) ? 200 : 502,
        array(
            'ok' => $response['status'] >= 200 && $response['status'] < 300,
            'event_id' => $payload['data'][0]['event_id'],
            'tiktok' => is_array($decoded) ? $decoded : $body,
        )
    );
} catch (Throwable $error) {
    json_response(500, array('message' => $error->getMessage() ?: 'Falha ao enviar evento TikTok.'));
}

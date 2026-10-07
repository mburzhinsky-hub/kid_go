<?php
declare(strict_types=1);

require __DIR__ . '/src/bootstrap.php';

use Kg\ApiException;
use Kg\App;
use Kg\Config;
use Kg\Request;
use Kg\Response;

ini_set('display_errors', '0');
Config::load();

try {
    $req = Request::fromGlobals();
} catch (ApiException $e) {
    Response::error($e)->send();
    exit;
}
App::router()->dispatch($req)->send();

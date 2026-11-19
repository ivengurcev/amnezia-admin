#include "HttpServer.hpp"
#include <algorithm>
#include <nlohmann/json.hpp>
#include <exception>
#include <iostream>
#include <string>
#include "config/ClientConfig.hpp"
#include "security/Password.hpp"
#include <cstdint>
#include <string_view>
#include <thread>
#include <stdexcept>


namespace {

    enum class SetupPageState {
        Active,
        Expired,
        Error
    };

    void renderSetupPage(
        httplib::Response& res,
        const std::string& token,
        SetupPageState state
    ) {
        res.status = state == SetupPageState::Active ? 200 :
                    state == SetupPageState::Expired ? 410 : 500;

        res.set_header("Cache-Control", "no-store");
        res.set_header("Referrer-Policy", "no-referrer");

        std::string html = R"html(
    <!doctype html>
    <html lang="ru">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Получение VPN-конфигурации</title>
        <link rel="stylesheet" href="/assets/theme.css">
        <link rel="stylesheet" href="/assets/setup.css">
    </head>
    <body>
    <main>
    )html";

        switch (state) {
            case SetupPageState::Active:
                html += R"html(
                    <div class="icon">↓</div>
                    <h1>Ваш VPN готов</h1>
                    <p>Скачайте конфигурацию и импортируйте её
                    в приложение AmneziaWG.</p>
                )html";

                html += "<form method=\"POST\" action=\"/setup/"
                    + token + "/redeem\">";

                html += R"html(
                    <button type="submit">Скачать конфигурацию</button>
                    </form>
                    <small>Ссылка одноразовая. Сохраните скачанный файл.</small>
                )html";
                break;

            case SetupPageState::Expired:
                html += R"html(
                    <div class="icon">×</div>
                    <h1>Ссылка недействительна</h1>
                    <p>Ссылка уже использована или срок её действия истёк.
                    Запросите новую ссылку у администратора.</p>
                )html";
                break;

            case SetupPageState::Error:
                html += R"html(
                    <div class="icon">!</div>
                    <h1>Не удалось получить конфигурацию</h1>
                    <p>Произошла ошибка при подготовке файла.
                    Попробуйте ещё раз.</p>
                )html";

                html += "<form method=\"POST\" action=\"/setup/"
                    + token + "/redeem\">";

                html += R"html(
                    <button type="submit">Повторить попытку</button>
                    </form>
                )html";
                break;
        }

        html += "</main></body></html>";

        res.set_content(html, "text/html; charset=utf-8");
    }
    std::optional<std::string> sessionCookie(
        const httplib::Request& req
    ) {
        if (!req.has_header("Cookie")) {
            return std::nullopt;
        }
        const std::string cookieHeader = req.get_header_value("Cookie");
        std::string_view cookies{cookieHeader};
        constexpr std::string_view name = "awg_session=";

        while (!cookies.empty()) {
            const auto end = cookies.find(';');
            auto cookie = cookies.substr(0, end);

            cookie.remove_prefix(
                std::min(cookie.find_first_not_of(' '), cookie.size())
            );

            if (cookie.starts_with(name)) {
                return std::string{cookie.substr(name.size())};
            }

            if (end == std::string_view::npos) {
                break;
            }

            cookies.remove_prefix(end + 1);
        }

        return std::nullopt;
    }
}


HttpServer::HttpServer(        
    const std::string& host,
    int port,
    const std::string& adminHost,
    int adminPort,    
    AwgDriver& awg,
    PeerService& peer,
    PeerStore& store,
    LinkService& links,
    const std::string& endpointHost,
    const std::string& setupBaseUrl,
    bool devMode
): 
    host_(host), 
    port_(port), 
    adminHost_(adminHost),
    adminPort_(adminPort),
    awg_(awg),
    peer_(peer),
    store_(store),
    links_(links),
    endpointHost_(endpointHost),
    setupBaseUrl_(setupBaseUrl),
    devMode_(devMode)     
{
    publicServer_.set_socket_options([](auto sock) {
        httplib::set_socket_opt(sock, SOL_SOCKET, SO_REUSEADDR, 1);
    });    
}


bool HttpServer::run() {
    registerPublicRoutes();
    registerAdminRoutes();

    // Существующий обработчик исключений нужно
    // зарегистрировать для обоих серверов.

    if (!adminServer_.bind_to_port(adminHost_, adminPort_)) {
        std::cerr << "Failed to bind admin server\n";
        return false;
    }

    if (!publicServer_.bind_to_port(host_, port_)) {
        std::cerr << "Failed to bind public server\n";
        return false;
    }

    std::thread adminThread{[this] {
        if (!adminServer_.listen_after_bind()) {
            std::cerr << "Admin server stopped or failed\n";
        }
    }};

    const bool publicOk = publicServer_.listen_after_bind();

    adminServer_.stop();
    adminThread.join();

    return publicOk;
}

void HttpServer::registerPublicRoutes() {
    // GET /setup/:token
    // POST /setup/:token/redeem
    publicServer_.Get(
        R"(/assets/(theme|setup)\.css)",
        [](const httplib::Request& req, httplib::Response& res) {
            const auto name = req.matches[1].str();

            res.set_file_content(
                "/app/web/assets/" + name + ".css",
                "text/css"
            );
        }
    );

    publicServer_.Get(R"(/setup/([0-9a-f]{64}))",
        [this](const httplib::Request& req, httplib::Response& res) {
            const auto token = req.matches[1].str();

            try {
                const bool valid = links_.peek(token).has_value();

                renderSetupPage(
                    res,
                    token,
                    valid ? SetupPageState::Active : SetupPageState::Expired
                );
            } catch (const std::exception& e) {
                std::cerr << "Setup page error: " << e.what() << '\n';
                renderSetupPage(res, token, SetupPageState::Error);
            }
        }
    );

    publicServer_.Post(R"(/setup/([0-9a-f]{64})/redeem)",
        [this](const httplib::Request& req, httplib::Response& res) {
            const auto token = req.matches[1].str();

            try {
                auto publicKey = links_.peek(token);

                if (!publicKey) {
                    renderSetupPage(res, token, SetupPageState::Expired);
                    return;
                }

                auto peer = store_.find(*publicKey);

                if (!peer) {
                    renderSetupPage(res, token, SetupPageState::Expired);
                    return;
                }

                config::ClientConfigOptions options{
                    .endpointHost = endpointHost_
                };

                auto content = config::generateClientConfig(
                    *peer,
                    awg_.getInterfaceConfig(),
                    options
                );

                if (!links_.redeem(token)) {
                    renderSetupPage(res, token, SetupPageState::Expired);
                    return;
                }

                res.set_header("Cache-Control", "no-store");
                res.set_header(
                    "Content-Disposition",
                    "attachment; filename=\"amnezia.conf\""
                );
                res.set_content(content, "application/octet-stream");

            } catch (const std::exception& e) {
                std::cerr << "Setup redeem error: " << e.what() << '\n';
                renderSetupPage(res, token, SetupPageState::Error);
            }
        }
    );    
}

void HttpServer::registerAdminRoutes() {
    if (!adminServer_.set_mount_point("/", "/app/web")) {
        throw std::runtime_error{"Не найдены статические файлы React"};
    }
    adminServer_.set_exception_handler(
        [](const httplib::Request&, httplib::Response& res, std::exception_ptr ep) {
            try {
                std::rethrow_exception(ep);
            } catch (const std::exception& e) {
                std::cerr << "HTTP error: " << e.what() << '\n';
            } catch (...) {
                std::cerr << "Unknown HTTP error\n";
            }

            res.status = 500;
            res.set_content(
                R"({"error":"Internal Server Error"})",
                "application/json"
            );
        }
    );    

    adminServer_.Get("/health",
        [](const httplib::Request&, httplib::Response& res) {
            res.set_content("OK", "text/plain");
        }
    );

    adminServer_.set_pre_routing_handler(
        [this](const httplib::Request& req, httplib::Response& res) {
            using Result = httplib::Server::HandlerResponse;

            if (req.path == "/health") {
                return Result::Unhandled;
            }

            if (!devMode_ && !store_.isAdminIp(req.remote_addr)) {
                res.status = 404;
                return Result::Handled;
            }

            // Эти маршруты сами управляют авторизацией.
            if ((req.path == "/api/auth/login" && req.method == "POST") ||
                (req.path == "/api/auth/me" && req.method == "GET") ||
                (req.path == "/api/auth/logout" && req.method == "POST")) {
                return Result::Unhandled;
            }

            // Разрешаем загрузку React и статических файлов.
            if ((req.method == "GET" || req.method == "HEAD") &&
                req.path != "/api" &&
                !req.path.starts_with("/api/")) {
                return Result::Unhandled;
            }

            if (!authenticatedPeer(req)) {
                res.status = 401;
                res.set_content(
                    R"({"error":"Требуется авторизация"})",
                    "application/json"
                );
                return Result::Handled;
            }

            return Result::Unhandled;
        }
    );

    adminServer_.Get("/api/status", [this](const httplib::Request&, httplib::Response& res) {
        auto port = awg_.getListenPort();
        res.set_content(R"({"listenPort":)" + std::to_string(port) + "}", "application/json");
    });


    adminServer_.Get("/api/peers",
        [this](const httplib::Request&, httplib::Response& res) {
            const auto storedPeers = store_.list();
            const auto activePeers = awg_.getPeersInfo();

            nlohmann::json result = nlohmann::json::array();

            for (const auto& stored : storedPeers) {
                nlohmann::json item = {
                    {"publicKey", stored.publicKey},
                    {"name", stored.name},
                    {"allowedIps", stored.allowedIps},
                    {"isAdmin", stored.isAdmin},
                    {"endpoint", nullptr},
                    {"latestHandshake", 0},
                    {"rx", 0},
                    {"tx", 0}
                };

                const auto it = std::find_if(
                    activePeers.begin(),
                    activePeers.end(),
                    [&](const PeerInfo& peer) {
                        return peer.publicKey == stored.publicKey;
                    }
                );

                if (it != activePeers.end()) {
                    if (!it->endpoint.empty() &&
                        it->endpoint != "(none)") {
                        item["endpoint"] = it->endpoint;
                    }

                    item["latestHandshake"] = it->latestHandshake;
                    item["rx"] = it->rx;
                    item["tx"] = it->tx;
                }

                result.push_back(std::move(item));
            }

            res.set_content(result.dump(), "application/json");
        }
    );


    adminServer_.Post("/api/peers",
        [this](const httplib::Request& req, httplib::Response& res) {
            const auto data = nlohmann::json::parse(
                req.body, nullptr, false
            );

            if (!data.is_object() ||
                (data.contains("name") && !data["name"].is_string())) {
                res.status = 400;
                res.set_content(
                    R"({"error":"Некорректное имя подключения"})",
                    "application/json"
                );
                return;
            }

            std::string name = data.value("name", std::string{});

            const auto first = name.find_first_not_of(" \t\n\r");

            name = first == std::string::npos
                ? ""
                : name.substr(
                    first,
                    name.find_last_not_of(" \t\n\r") - first + 1
                );

            if (name.size() > 400) {
                res.status = 400;
                res.set_content(
                    R"({"error":"Слишком длинное имя"})",
                    "application/json"
                );
                return;
            }

            const auto created = peer_.createPeer(name);

            res.status = 201;
            res.set_content(
                nlohmann::json{
                    {"publicKey", created.publicKey},
                    {"allowedIps", created.allowedIps},
                    {"name", created.name}
                }.dump(),
                "application/json"
            );
        }
    );


    adminServer_.Delete("/api/peers", [this](const httplib::Request& req, httplib::Response& res) {
        auto data = nlohmann::json::parse(req.body);
        auto publicKey = data.at("publicKey").get<std::string>();

        peer_.removePeer(publicKey);
        res.status = 204;
    });

    adminServer_.Post("/api/peers/links",
        [this](const httplib::Request& req, httplib::Response& res) {
            auto data = nlohmann::json::parse(req.body, nullptr, false);

            if (!data.is_object()
                || !data.contains("publicKey")
                || !data["publicKey"].is_string()
                || !data.contains("ttlSeconds")
                || !data["ttlSeconds"].is_number_integer()) {
                res.status = 400;
                res.set_content(R"({"error":"Invalid request"})", "application/json");
                return;
            }

            auto publicKey = data["publicKey"].get<std::string>();
            auto ttl = data["ttlSeconds"].get<std::int64_t>();

            if (ttl <= 0) {
                res.status = 400;
                res.set_content(R"({"error":"Invalid TTL"})", "application/json");
                return;
            }

            if (!store_.find(publicKey)) {
                res.status = 404;
                res.set_content(R"({"error":"Peer not found"})", "application/json");
                return;
            }

            auto token = links_.create(publicKey, ttl);
            auto url = setupBaseUrl_ + "/setup/" + token;

            res.status = 201;
            res.set_header("Cache-Control", "no-store");
            res.set_content(
                nlohmann::json{{"url", url}}.dump(),
                "application/json"
            );
        }
    );    

    adminServer_.Post("/api/auth/login",
        [this](const httplib::Request& req, httplib::Response& res) {
            res.set_header("Cache-Control", "no-store");

            if (req.body.size() > 4096) {
                res.status = 413;
                return;
            }

            const auto data = nlohmann::json::parse(
                req.body, nullptr, false
            );

            if (!data.is_object() ||
                !data.contains("password") ||
                !data["password"].is_string() ||
                (devMode_ && (
                    !data.contains("publicKey") ||
                    !data["publicKey"].is_string()
                ))) {
                res.status = 400;
                res.set_content(
                    R"({"error":"Некорректный запрос"})",
                    "application/json"
                );
                return;
            }

            const auto password = data["password"].get<std::string>();

            if (password.empty() || password.size() > 256) {
                res.status = 400;
                return;
            }

            std::optional<CreatedPeer> peer;

            if (devMode_) {
                const auto publicKey = data["publicKey"].get<std::string>();

                if (publicKey.empty() || publicKey.size() > 128) {
                    res.status = 400;
                    return;
                }

                peer = store_.find(publicKey);
            } else {
                peer = store_.findAdminByIp(req.remote_addr);
            }

            if (!peer || !peer->isAdmin || !peer->passwordHash ||
                !verifyPassword(password, *peer->passwordHash)) {
                res.status = 401;
                res.set_content(
                    R"({"error":"Ошибка авторизации"})",
                    "application/json"
                );
                return;
            }

            const auto token = sessions_.create(peer->publicKey);

            res.set_header(
                "Set-Cookie",
                "awg_session=" + token +
                "; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400"
            );

            res.set_content(
                nlohmann::json{{"name", peer->name}}.dump(),
                "application/json"
            );

            res.set_content(
                nlohmann::json{
                    {"name", peer->name}
                }.dump(),
                "application/json"
            );
        }
    );
    adminServer_.Get("/api/auth/me",
        [this](const httplib::Request& req, httplib::Response& res) {
            res.set_header("Cache-Control", "no-store");

            const auto peer = authenticatedPeer(req);

            if (!peer) {
                res.status = 401;
                return;
            }

            res.set_content(
                nlohmann::json{
                    {"name", peer->name},
                    {"publicKey", peer->publicKey}
                }.dump(),
                "application/json"
            );
        }
    );

    adminServer_.Post("/api/auth/logout",
        [this](const httplib::Request& req, httplib::Response& res) {
            if (const auto token = sessionCookie(req)) {
                sessions_.remove(*token);
            }

            res.set_header(
                "Set-Cookie",
                "awg_session=; Path=/; HttpOnly; "
                "SameSite=Strict; Max-Age=0"
            );
            res.set_header("Cache-Control", "no-store");
            res.status = 204;
        }
    );
}


std::optional<CreatedPeer> HttpServer::authenticatedPeer(
    const httplib::Request& req
) {
    const auto token = sessionCookie(req);

    if (!token) {
        return std::nullopt;
    }

    const auto publicKey = sessions_.find(*token);

    if (!publicKey) {
        return std::nullopt;
    }

    const auto peer = store_.find(*publicKey);

    if (!peer || !peer->isAdmin) {
        return std::nullopt;
    }

    if (!devMode_ &&
        peer->allowedIps != req.remote_addr + "/32") {
        return std::nullopt;
    }

    return peer;
}
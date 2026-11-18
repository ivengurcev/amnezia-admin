#include "HttpServer.hpp"
#include <nlohmann/json.hpp>
#include <exception>
#include <iostream>
#include <string>
#include "config/ClientConfig.hpp"
#include <cstdint>


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
        <style>
            * { box-sizing: border-box; }

            body {
                margin: 0;
                min-height: 100vh;
                display: grid;
                place-items: center;
                padding: 24px;
                background: #f4f5f7;
                color: #20242b;
                font: 16px/1.5 system-ui, sans-serif;
            }

            main {
                width: 100%;
                max-width: 420px;
                padding: 36px 28px;
                background: #fff;
                border: 1px solid #e5e7eb;
                border-radius: 16px;
                box-shadow: 0 8px 32px #00000008;
                text-align: center;
            }

            .icon {
                display: grid;
                place-items: center;
                width: 56px;
                height: 56px;
                margin: 0 auto 20px;
                border-radius: 14px;
                background: #f1f3f5;
                font-size: 28px;
            }

            h1 {
                margin: 0 0 12px;
                font-size: 23px;
                line-height: 1.3;
            }

            p {
                margin: 0 0 24px;
                color: #667085;
            }

            button {
                width: 100%;
                padding: 13px 20px;
                border: 0;
                border-radius: 9px;
                background: #20242b;
                color: #fff;
                font: inherit;
                font-weight: 600;
                cursor: pointer;
            }

            button:hover { background: #383f49; }

            small {
                display: block;
                margin-top: 16px;
                color: #98a2b3;
            }
        </style>
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

}


HttpServer::HttpServer(        
    const std::string& host,
    int port,
    AwgDriver& awg,
    PeerService& peer,
    PeerStore& store,
    LinkService& links,
    const std::string& endpointHost,
    const std::string& setupBaseUrl
): 
    host_(host), 
    port_(port), 
    awg_(awg),
    peer_(peer),
    store_(store),
    links_(links),
    endpointHost_(endpointHost),
    setupBaseUrl_(setupBaseUrl)     
{
    server_.set_socket_options([](auto sock) {
        httplib::set_socket_opt(sock, SOL_SOCKET, SO_REUSEADDR, 1);
    });    
}


bool HttpServer::run() {

    server_.set_exception_handler(
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

    server_.Get("/api/status", [this](const httplib::Request&, httplib::Response& res) {
        auto port = awg_.getListenPort();
        res.set_content(R"({"listenPort":)" + std::to_string(port) + "}", "application/json");
    });

    server_.Get("/api/peers", [this](const httplib::Request&, httplib::Response& res) {
        auto peers = awg_.getPeersInfo();
        nlohmann::json data = nlohmann::json::array();

        for (const auto& peer : peers) {
            data.push_back({
                {"publicKey", peer.publicKey},
                {"endpoint", peer.endpoint},
                {"allowedIps", peer.allowedIps},
                {"latestHandshake", peer.latestHandshake},
                {"rx", peer.rx},
                {"tx", peer.tx}
            });
        }

        res.set_content(data.dump(), "application/json");
    });
    server_.Post("/api/peers", [this](const httplib::Request&, httplib::Response& res) {
        auto created = peer_.createPeer();
        nlohmann::json data = {
            {"publicKey", created.publicKey},
            {"privateKey", created.privateKey},
            {"allowedIps", created.allowedIps}
        };    
        res.status = 201;
        res.set_content(data.dump(), "application/json");
    });
    server_.Delete("/api/peers", [this](const httplib::Request& req, httplib::Response& res) {
        auto data = nlohmann::json::parse(req.body);
        auto publicKey = data.at("publicKey").get<std::string>();

        peer_.removePeer(publicKey);
        res.status = 204;
    });

    server_.Post("/api/peers/links",
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

    // 
    server_.Get(R"(/setup/([0-9a-f]{64}))",
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

    server_.Post(R"(/setup/([0-9a-f]{64})/redeem)",
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

    return server_.listen(host_, port_);
}
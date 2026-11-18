#include "HttpServer.hpp"
#include <nlohmann/json.hpp>
#include <exception>
#include <iostream>
#include <string>
#include "config/ClientConfig.hpp"
#include <cstdint>

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
            auto token = req.matches[1].str();

            res.set_header("Cache-Control", "no-store");
            res.set_header("Referrer-Policy", "no-referrer");

            if (!links_.peek(token)) {
                res.status = 410;
                res.set_content(
                    "Ссылка недействительна или уже использована",
                    "text/plain; charset=utf-8"
                );
                return;
            }
            
            std::string html =
                "<!doctype html>"
                "<html lang=\"ru\">"
                "<head><meta charset=\"utf-8\">"
                "<title>VPN configuration</title></head>"
                "<body><h1>Получение VPN-конфигурации</h1>";

            html += "<form method=\"POST\" action=\"/setup/"
                + token + "/redeem\">";

            html +=
                "<button type=\"submit\">Скачать конфигурацию</button>"
                "</form></body></html>";

            res.set_content(html, "text/html; charset=utf-8");
        }
    );

    server_.Post(R"(/setup/([0-9a-f]{64})/redeem)",
        [this](const httplib::Request& req, httplib::Response& res) {
            auto token = req.matches[1].str();

            auto publicKey = links_.peek(token);

            if (!publicKey) {
                res.status = 410;
                res.set_content("Link expired or already used", "text/plain");
                return;
            }

            auto peer = store_.find(*publicKey);

            if (!peer) {
                res.status = 410;
                res.set_content("Peer no longer exists", "text/plain");
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

            // Конфигурация уже сформирована. Теперь расходуем ссылку.
            if (!links_.redeem(token)) {
                res.status = 410;
                res.set_content("Link expired or already used", "text/plain");
                return;
            }

            res.set_header("Cache-Control", "no-store");
            res.set_header(
                "Content-Disposition",
                "attachment; filename=\"amnezia.conf\""
            );
            res.set_content(content, "application/octet-stream");
        }
    );

    return server_.listen(host_, port_);
}
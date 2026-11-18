#include "HttpServer.hpp"
#include <nlohmann/json.hpp>
#include <exception>
#include <iostream>
#include <string>

HttpServer::HttpServer(const std::string& host, int port, AwgDriver& awg, PeerService& peer): 
    host_(host), 
    port_(port), 
    awg_(awg),
    peer_(peer) 
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

    return server_.listen(host_, port_);
}
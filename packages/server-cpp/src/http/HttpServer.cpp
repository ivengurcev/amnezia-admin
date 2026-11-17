#include "HttpServer.hpp"
#include <exception>
#include <iostream>
#include <string>

HttpServer::HttpServer(const std::string& host, int port, AwgDriver& awg): host_(host), port_(port), awg_(awg) {
    server_.set_socket_options([](auto sock) {
        httplib::set_socket_opt(sock, SOL_SOCKET, SO_REUSEADDR, 1);
    });    
}

bool HttpServer::run() {
    server_.Get("/api/status", [this](const httplib::Request&, httplib::Response& res) {
        try {
            auto port = awg_.getListenPort();
            res.set_content(R"({"listenPort":)" + std::to_string(port) + "}", "application/json");
        } catch (const std::exception& e) {
            res.status = 500;
            std::cerr << e.what() << '\n';
            res.set_content(R"({"error":"Internal Server Error"})", "application/json");
        }
    });
    return server_.listen(host_, port_);
}
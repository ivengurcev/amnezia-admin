#include "HttpServer.hpp"
#include <string>

HttpServer::HttpServer(const std::string& host, int port): host_(host), port_(port) {
    server_.set_socket_options([](auto sock) {
        httplib::set_socket_opt(sock, SOL_SOCKET, SO_REUSEADDR, 1);
    });    
}

bool HttpServer::run() {
    server_.Get("/api/status", [](const httplib::Request& req, httplib::Response& res) {
        res.set_content(R"({"status":"ok"})", "application/json");
    });
    return server_.listen(host_, port_);
}
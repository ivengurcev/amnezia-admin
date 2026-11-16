#pragma once

#include <httplib.h>
#include <string>

class HttpServer {
public:
    HttpServer(const std::string&, int port);
    bool run();

private:
    httplib::Server server_;
    std::string host_;
    int port_;
};
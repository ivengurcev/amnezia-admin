#pragma once

#include <httplib.h>
#include <string>

#include "awg/AwgDriver.hpp"

class HttpServer {
public:
    HttpServer(const std::string&, int port, AwgDriver& awg);
    bool run();

private:
    httplib::Server server_;
    std::string host_;
    int port_;
    AwgDriver& awg_;
};
#pragma once

#include <httplib.h>
#include <string>

#include "awg/AwgDriver.hpp"
#include "peers/PeerService.hpp"

class HttpServer {
public:
    HttpServer(const std::string&, int port, AwgDriver& awg, PeerService& peer);
    bool run();

private:
    httplib::Server server_;
    std::string host_;
    int port_;
    AwgDriver& awg_;
    PeerService& peer_;
};
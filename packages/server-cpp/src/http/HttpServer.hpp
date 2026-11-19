#pragma once

#include <httplib.h>
#include <string>

#include "awg/AwgDriver.hpp"
#include "peers/PeerService.hpp"
#include "peers/PeerStore.hpp"
#include "links/LinkService.hpp"
#include "security/SessionStore.hpp"
#include <optional>

class HttpServer {
public:
    HttpServer(
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
    );
    bool run();
    void registerPublicRoutes();
    void registerAdminRoutes();

private:
    httplib::Server publicServer_;
    httplib::Server adminServer_;
    std::string host_;
    int port_;
    std::string adminHost_;
    int adminPort_;    
    AwgDriver& awg_;
    PeerService& peer_;
    PeerStore& store_;
    LinkService& links_;
    std::string endpointHost_;
    std::string setupBaseUrl_;
    bool devMode_;
    SessionStore sessions_;
    std::optional<CreatedPeer> authenticatedPeer(
        const httplib::Request& req
    );
};
#pragma once

#include <string>

struct CreatedPeer;
struct AwgInterfaceConfig;

namespace config {
    struct ClientConfigOptions {
        std::string endpointHost;
        std::string dns = "1.1.1.1";
        std::string allowedIps = "0.0.0.0/0";
        int persistentKeepalive = 25;
        int mtu = 1280;
    };
    std::string generateClientConfig(
        const CreatedPeer& peer,
        const AwgInterfaceConfig& server,
        const ClientConfigOptions& options
    );
}
#pragma once

#include <string>

struct CreatedPeer;
struct AwgInterfaceConfig;

std::string generateClientConfig(
    const CreatedPeer& peer,
    const AwgInterfaceConfig& server,
    const std::string& endpointHost
);
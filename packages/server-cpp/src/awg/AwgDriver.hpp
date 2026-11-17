#pragma once

#include <cstdint>
#include <string>
#include <vector>


struct PeerInfo {
    std::string publicKey;
    std::string endpoint;
    std::string allowedIps;

    std::uint64_t latestHandshake = 0;
    std::uint64_t rx = 0;
    std::uint64_t tx = 0;
};

class AwgDriver {
public:
    explicit AwgDriver(const std::string& interfaceName);

    int getListenPort() const;
    std::vector<std::string> listPeers() const;
    std::vector<PeerInfo> getPeersInfo() const;

private:
    std::string interfaceName_;
};
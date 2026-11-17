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

struct KeyPair {
    std::string privateKey;
    std::string publicKey;
};

class AwgDriver {
public:
    explicit AwgDriver(const std::string& interfaceName);

    int getListenPort() const;
    std::vector<std::string> listPeers() const;
    std::vector<PeerInfo> getPeersInfo() const;
    void addPeer(
        const std::string& publicKey,
        const std::string& allowedIps
    ) const;
    std::string getInterfaceCidr() const;
    KeyPair generateKeyPair() const;
    
private:
    std::string interfaceName_;
};
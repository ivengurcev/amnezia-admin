#pragma once

#include <string>

class AwgDriver;
class PeerStore;

struct CreatedPeer {
    std::string privateKey;
    std::string publicKey;
    std::string allowedIps;
};

class PeerService {
public:
    explicit PeerService(AwgDriver& awg, PeerStore& store);

    std::string findAvailableIp() const;
    CreatedPeer createPeer() const;
    void removePeer(const std::string& publicKey) const;
    void restorePeers() const;

private:
    AwgDriver& awg_;
    PeerStore& store_;
};
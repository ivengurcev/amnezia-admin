#pragma once

#include <optional>
#include <string>

class AwgDriver;
class PeerStore;

struct CreatedPeer {
    std::string privateKey;
    std::string publicKey;
    std::string allowedIps;

    std::string name;
    bool isAdmin = false;
    std::optional<std::string> passwordHash;
};

class PeerService {
public:
    explicit PeerService(AwgDriver& awg, PeerStore& store);

    std::string findAvailableIp() const;
    void removePeer(const std::string& publicKey) const;
    void restorePeers() const;
    CreatedPeer createPeer(
        const std::string& name = "",
        const std::optional<std::string>& passwordHash = std::nullopt
    ) const;

private:
    AwgDriver& awg_;
    PeerStore& store_;
};
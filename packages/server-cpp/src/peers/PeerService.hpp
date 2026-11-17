#pragma once

#include <string>

class AwgDriver;

struct CreatedPeer {
    std::string privateKey;
    std::string publicKey;
    std::string allowedIps;
};

class PeerService {
public:
    explicit PeerService(AwgDriver& awg);

    std::string findAvailableIp() const;
    CreatedPeer createPeer() const;

private:
    AwgDriver& awg_;
};
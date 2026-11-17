#pragma once

#include <string>

class AwgDriver;

class PeerService {
public:
    explicit PeerService(AwgDriver& awg);

    std::string findAvailableIp() const;
    std::string createPeer(const std::string& publicKey) const;

private:
    AwgDriver& awg_;
};
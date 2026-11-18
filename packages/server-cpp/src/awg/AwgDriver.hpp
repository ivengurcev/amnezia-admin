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

struct AwgInterfaceConfig {
    // Ключи и порт
    std::string privateKey;
    std::string publicKey;
    int listenPort;

    // Junk packets
    int jc;
    int jmin;
    int jmax;

    // Размеры пакетов
    int s1;
    int s2;
    int s3;
    int s4;

    // Заголовки: могут быть числами или диапазонами
    std::string h1;
    std::string h2;
    std::string h3;
    std::string h4;

    // Дополнительные пакеты
    std::string i1;
    std::string i2;
    std::string i3;
    std::string i4;
    std::string i5;

    // AmneziaWG 3.x
    std::string headerProtectionKey;
    std::string contentPaddingAddition;

    // Тайминги: могут быть диапазонами, например "100-120"
    std::string rekeyAfterTime;
    std::string rekeyTimeout;
    std::string rejectAfterTime;
    std::string keepaliveTimeout;
    std::string maxHandshakeAttempts;

    // Переключатели
    bool randomTrailers;
    bool disableCookies;

    // Маркировка пакетов
    std::string fwmark;
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
    void removePeer(const std::string& publicKey) const;
    std::string getInterfaceCidr() const;
    KeyPair generateKeyPair() const;
    AwgInterfaceConfig getInterfaceConfig() const;

private:
    std::string interfaceName_;
};
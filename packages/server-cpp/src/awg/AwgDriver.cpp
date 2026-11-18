#include "AwgDriver.hpp"
#include "process/ProcessRunner.hpp"
#include <nlohmann/json.hpp>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

AwgDriver::AwgDriver(const std::string& interfaceName): interfaceName_(interfaceName) {}

int AwgDriver::getListenPort() const {
    return std::stoi(
        process::runCommand("awg", {"show", interfaceName_, "listen-port"})
    );
}

std::vector<std::string> AwgDriver::listPeers() const {
    std::istringstream stream{
        process::runCommand("awg", {"show", interfaceName_, "peers"})
    };
    std::string line;
    std::vector<std::string> result;
    while (std::getline(stream, line)) {
        // line содержит очередной публичный ключ
        result.push_back(line);
    }
    return result;
}

std::vector<PeerInfo> AwgDriver::getPeersInfo() const {
    std::istringstream linesStream{ process::runCommand("awg", {"show", interfaceName_, "dump"})};
    std::string line;
    std::vector<PeerInfo> result;

    std::getline(linesStream, line); // Пропускаем параметры интерфейса
    while (std::getline(linesStream, line)) {
        // line содержит очередной публичный ключ
        PeerInfo peer;

        std::string presharedKey;
        std::string keepAlive;
        std::istringstream lineStream{line};
        if (!(lineStream 
                >> peer.publicKey 
                >> presharedKey
                >> peer.endpoint
                >> peer.allowedIps
                >> peer.latestHandshake
                >> peer.rx
                >> peer.tx
                >> keepAlive
            )
        ) {
            throw std::runtime_error("Invalid peer data");
        }
        result.push_back(std::move(peer));
    }
    return  result;
}

void AwgDriver::addPeer(
    const std::string& publicKey,
    const std::string& allowedIps    
) const {
    process::runCommand(
        "awg",
        {"set", interfaceName_, "peer", publicKey, "allowed-ips", allowedIps}
    );
}

void AwgDriver::removePeer(const std::string& publicKey) const {
    process::runCommand(
        "awg",
        {
            "set", 
            interfaceName_, 
            "peer", 
            publicKey, 
            "remove"
        }
    );
}

std::string AwgDriver::getInterfaceCidr() const {
    auto data = nlohmann::json::parse( 
        process::runCommand("ip", {"-4", "-j", "addr", "show", "dev", interfaceName_})
    );

    std::string ip = data.at(0).at("addr_info").at(0).at("local").get<std::string>();
    int prefix = data.at(0).at("addr_info").at(0).at("prefixlen").get<int>();

    return ip + '/' + std::to_string(prefix) ;
}

std::string removeTrailingNewline(const std::string& text ) {
    std::string result{text};
    if (!result.empty() && result.back() == '\n') {
        result.pop_back();
    }
    return result;
}

KeyPair AwgDriver::generateKeyPair() const {
    KeyPair result;
    result.privateKey = removeTrailingNewline(process::runCommand("awg", {"genkey"}));
    result.publicKey = removeTrailingNewline(process::runCommand(
        "awg",
        {"pubkey"},
        result.privateKey
    ));
    return result;
}

bool parseBool(const std::string& value) {
    if (value == "on") return true;
    if (value == "off") return false;

    throw std::runtime_error{"Invalid boolean value: " + value};
}

AwgInterfaceConfig AwgDriver::getInterfaceConfig() const {
    std::istringstream linesStream{ process::runCommand("awg", {"show", interfaceName_, "dump"})};
    std::string line;

    if (!std::getline(linesStream, line)) {
        throw std::runtime_error{"Не удалось прочитать конфигурацию AWG"};
    }
    std::istringstream lineStream{line};
    AwgInterfaceConfig config;

    std::string randomTrailers;
    std::string disableCookies;

    if (!(lineStream 
            >> config.privateKey 
            >> config.publicKey
            >> config.listenPort

            >> config.jc
            >> config.jmin
            >> config.jmax

            >> config.s1
            >> config.s2
            >> config.s3
            >> config.s4

            >> config.h1
            >> config.h2
            >> config.h3
            >> config.h4

            >> config.i1
            >> config.i2
            >> config.i3
            >> config.i4
            >> config.i5

            >> config.headerProtectionKey
            >> config.contentPaddingAddition

            >> config.rekeyAfterTime
            >> config.rekeyTimeout
            >> config.rejectAfterTime
            >> config.keepaliveTimeout
            >> config.maxHandshakeAttempts

            >> randomTrailers
            >> disableCookies

            >> config.fwmark
        )
    ) {
        throw std::runtime_error("Invalid AWG interface data");
    }
    config.randomTrailers = parseBool(randomTrailers);
    config.disableCookies = parseBool(disableCookies);

    return config;
}
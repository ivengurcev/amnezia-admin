#include "AwgDriver.hpp"
#include "process/ProcessRunner.hpp"
#include <cstdint>
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


std::string AwgDriver::getInterfaceCidr() const {
    auto data = nlohmann::json::parse( 
        process::runCommand("ip", {"-4", "-j", "addr", "show", "dev", interfaceName_})
    );

    std::string ip = data.at(0).at("addr_info").at(0).at("local").get<std::string>();
    int prefix = data.at(0).at("addr_info").at(0).at("prefixlen").get<int>();



    return ip + '/' + std::to_string(prefix) ;
}
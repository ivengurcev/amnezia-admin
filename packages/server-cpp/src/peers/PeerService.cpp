#include "PeerService.hpp"
#include "awg//AwgDriver.hpp"
#include "net/Ipv4.hpp"
#include <cstdint>
#include <stdexcept>
#include <unordered_set>

std::string PeerService::findAvailableIp() const {
    auto cidr = net::parseCidr(awg_.getInterfaceCidr());
    auto mask = net::prefixToMask(cidr.prefix);

    std::uint32_t network = cidr.address & mask;
    std::uint32_t broadcast = network | ~mask;

    auto peers = awg_.getPeersInfo();
    std::unordered_set<std::uint32_t> occupied{cidr.address};
    for(const auto& peer: peers) {
        auto pos = peer.allowedIps.find('/');
        occupied.insert(net::ipv4ToInt(peer.allowedIps.substr(0, pos)));        
    }
    for (auto ip = network + 1; ip < broadcast; ip++) {
        if(!occupied.contains(ip)) {
            return net::intToIpv4(ip) + "/32";
        }
    }
    throw std::runtime_error{"Закончились доступные адреса"};
}

std::string PeerService::createPeer(const std::string& publicKey) const {
    auto availableIP = findAvailableIp();
    awg_.addPeer(publicKey, availableIP);

    return availableIP;
}
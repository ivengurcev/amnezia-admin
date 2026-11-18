#include "PeerService.hpp"
#include "awg/AwgDriver.hpp"
#include "peers/PeerStore.hpp"
#include "net/Ipv4.hpp"
#include <cstdint>
#include <stdexcept>
#include <unordered_set>

PeerService::PeerService(AwgDriver& awg, PeerStore& store): awg_(awg), store_(store) {}

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

CreatedPeer PeerService::createPeer(
    const std::string& name,
    const std::optional<std::string>& passwordHash
) const {
    auto availableIP = findAvailableIp();
    auto keys = awg_.generateKeyPair();
    CreatedPeer created{
        keys.privateKey,
        keys.publicKey,
        availableIP,
        name,
        passwordHash.has_value(),
        passwordHash
    };

    awg_.addPeer(created.publicKey, created.allowedIps);

    try {
        store_.insert(created);
    } catch (...) {
        awg_.removePeer(created.publicKey);
        throw;
    }

    return created;
}

void PeerService::removePeer(const std::string& publicKey) const {

    if(!store_.remove(publicKey)) {
        throw std::runtime_error{"Клиент не найден"};
    }
    awg_.removePeer(publicKey);
}

void PeerService::restorePeers() const {
    auto peers = store_.list();
    for(const auto& peer: peers) {
        awg_.addPeer(peer.publicKey, peer.allowedIps);
    }
}
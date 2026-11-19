#include <csignal>
#include <httplib.h>
#include "http/HttpServer.hpp"
#include "peers/PeerService.hpp"
#include "peers/PeerStore.hpp"
#include "links/LinkService.hpp"
#include "cli/Cli.hpp"
// #include "net/Ipv4.hpp"
// #include "process/ProcessRunner.hpp"
#include "awg/AwgDriver.hpp"
#include <iostream>
#include <cstdlib>
#include <string>

#include <ifaddrs.h>
#include <arpa/inet.h>
#include <cstring>
#include <memory>
#include <stdexcept>

std::string getInterfaceIp(const std::string& interfaceName) {
    ifaddrs* raw = nullptr;

    if (getifaddrs(&raw) != 0) {
        throw std::runtime_error{"Cannot read network interfaces"};
    }

    std::unique_ptr<ifaddrs, decltype(&freeifaddrs)> addresses{
        raw, freeifaddrs
    };

    for (auto* item = addresses.get(); item; item = item->ifa_next) {
        if (!item->ifa_addr ||
            item->ifa_addr->sa_family != AF_INET ||
            interfaceName != item->ifa_name) {
            continue;
        }

        char ip[INET_ADDRSTRLEN];

        auto* address = reinterpret_cast<sockaddr_in*>(item->ifa_addr);

        if (inet_ntop(AF_INET, &address->sin_addr, ip, sizeof(ip))) {
            return ip;
        }
    }

    throw std::runtime_error{
        "IPv4 address not found for interface: " + interfaceName
    };
}


int main(int argc, char* argv[]) {
    std::signal(SIGPIPE, SIG_IGN);
    std::cout << std::unitbuf;
    // Внутри main()
    const char* interfaceName = std::getenv("AWG_INTERFACE");

    if (argc > 1) {
        return runCli(argc, argv);
    }

    if (!interfaceName || !*interfaceName) {
        std::cerr << "AWG_INTERFACE is required\n";
        return 1;
    }


    std::cout << "Start" << '\n';
    AwgDriver awg{interfaceName};
    // PeerStore store{"/data/peers.json"};
    PeerStore store{"/data/amnezia-admin.db"};
    PeerService peer{awg, store};
    LinkService links{"/data/amnezia-admin.db"};
    // HttpServer server{"0.0.0.0", 3000, awg, peer};
    const char* endpointHost = std::getenv("AWG_ENDPOINT_HOST");
    const char* setupBaseUrl = std::getenv("SETUP_BASE_URL");
    const char* devEnv = std::getenv("ADMIN_DEV_MODE");
    const bool devMode = devEnv && std::string_view{devEnv} == "1";

    if (!endpointHost || !*endpointHost || !setupBaseUrl || !*setupBaseUrl) {
        std::cerr << "AWG_ENDPOINT_HOST and SETUP_BASE_URL are required\n";
        return 1;
    }

    HttpServer server{
        "0.0.0.0",
        3000,
        devMode ? "0.0.0.0" : getInterfaceIp(interfaceName),
        3002,
        awg,
        peer,
        store,
        links,
        endpointHost,
        setupBaseUrl,
        devMode
    };

    // std::cout << process::runCommand("awg", {"--version"});
    // auto peers = awg.listPeers();
    peer.restorePeers();


    // auto ip = net::ipv4ToInt("10.90.0.1");
    // std::cout << net::intToIpv4(ip) << '\n';
    // std::cerr << "Peers: " << peers.size() << '\n';
    if(!server.run()) {
        std::cerr << "Не получилось стартовать" << '\n';
        return 1;
    }
    return 0;
}
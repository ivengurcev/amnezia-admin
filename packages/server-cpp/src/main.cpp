#include <csignal>
#include <httplib.h>
#include "http/HttpServer.hpp"
#include "peers/PeerService.hpp"
#include "peers/PeerStore.hpp"
#include "links/LinkService.hpp"
// #include "net/Ipv4.hpp"
// #include "process/ProcessRunner.hpp"
#include "awg/AwgDriver.hpp"
#include <iostream>
#include <cstdlib>
#include <string>

int main() {
    std::signal(SIGPIPE, SIG_IGN);
    std::cout << std::unitbuf;
    // Внутри main()
    const char* interfaceName = std::getenv("AWG_INTERFACE");

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

    if (!endpointHost || !*endpointHost || !setupBaseUrl || !*setupBaseUrl) {
        std::cerr << "AWG_ENDPOINT_HOST and SETUP_BASE_URL are required\n";
        return 1;
    }

    HttpServer server{
        "0.0.0.0",
        3000,
        awg,
        peer,
        store,
        links,
        endpointHost,
        setupBaseUrl
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
#include <httplib.h>
#include "http/HttpServer.hpp"
// #include "net/Ipv4.hpp"
// #include "process/ProcessRunner.hpp"
// #include "awg/AwgDriver.hpp"
#include <iostream>
#include <cstdlib>
#include <string>

int main() {
    std::cout << std::unitbuf;
    // Внутри main()
    const char* interfaceName = std::getenv("AWG_INTERFACE");

    if (!interfaceName || !*interfaceName) {
        std::cerr << "AWG_INTERFACE is required\n";
        return 1;
    }

    std::cout << "Start" << '\n';
    AwgDriver awg{interfaceName};
    HttpServer server{"0.0.0.0", 3000, awg};
    // std::cout << process::runCommand("awg", {"--version"});
    // auto peers = awg.listPeers();


    // auto ip = net::ipv4ToInt("10.90.0.1");
    // std::cout << net::intToIpv4(ip) << '\n';
    // std::cerr << "Peers: " << peers.size() << '\n';
    if(!server.run()) {
        std::cerr << "Не получилось стартовать" << '\n';
        return 1;
    }
    return 0;
}
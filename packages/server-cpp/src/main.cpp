#include <httplib.h>
#include "http/HttpServer.hpp"
// #include "process/ProcessRunner.hpp"
#include "awg/AwgDriver.hpp"
#include <iostream>
#include <cstdlib>
#include <string>

int main() {
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

    if(!server.run()) {
        std::cerr << "Не получилось стартовать" << '\n';
        return 1;
    }
    return 0;
}
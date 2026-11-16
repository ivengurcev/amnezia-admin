#include <httplib.h>
#include "http/HttpServer.hpp"
#include <iostream>

int main() {
    std::cout << "Start" << '\n';
    HttpServer server{"127.0.0.1", 3000};
    if(!server.run()) {
        std::cerr << "Не получилось стартовать" << '\n';
        return 1;
    }
    return 0;
}
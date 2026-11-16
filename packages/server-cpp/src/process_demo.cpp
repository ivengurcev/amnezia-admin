#include "process/ProcessRunner.hpp"
#include <iostream>
#include <stdexcept>
#include <string>

int main() {
    std::string result;
    try{
        result = process::runCommand("echo", {"Hello from ProcessRunner"});
        // result = process::runCommand("false", {"Hello from ProcessRunner"});
        // process::runCommand("sh", {
        //     "-c",
        //     "echo Hello; echo Error >&2; exit 1"
        // });

    } catch (const std::runtime_error& e) {
        std::cerr << e.what() << '\n';
        return 1;
    }

    std::cout << result << '\n';

    return 0;
}
#include "AwgDriver.hpp"
#include "process/ProcessRunner.hpp"
#include <string>

AwgDriver::AwgDriver(const std::string& interfaceName): interfaceName_(interfaceName) {}

int AwgDriver::getListenPort() const {
    return std::stoi(
        process::runCommand("awg", {"show", interfaceName_, "listen-port"})
    );
}
#pragma once

#include <string>

class AwgDriver {
public:
    explicit AwgDriver(const std::string& interfaceName);

    int getListenPort() const;

private:
    std::string interfaceName_;
};
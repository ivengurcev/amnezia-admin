#pragma once

#include <cstddef>
#include <string>

namespace utils {
    std::string toHex(const unsigned char* data, std::size_t size);
}
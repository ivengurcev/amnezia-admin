#pragma once

#include <cstddef>
#include <string>
#include <vector>

namespace utils {
    std::string toHex(const unsigned char* data, std::size_t size);
    std::vector<unsigned char> fromHex(std::string_view hex);
}
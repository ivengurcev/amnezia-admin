#include "utils/Hex.hpp"

std::string utils::toHex(const unsigned char* data, std::size_t size) {
    constexpr char digits[] = "0123456789abcdef";

    std::string result;
    result.reserve(size * 2);

    for (std::size_t i = 0; i < size; ++i) {
        const unsigned char byte = data[i];

        result += digits[byte >> 4];
        result += digits[byte & 0x0F];
    }

    return result;
}
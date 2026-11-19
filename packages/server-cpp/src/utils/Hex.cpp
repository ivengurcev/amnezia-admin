#include "utils/Hex.hpp"

#include <stdexcept>

namespace {

    unsigned char hexDigit(char c) {
        if (c >= '0' && c <= '9') {
            return c - '0';
        }

        if (c >= 'a' && c <= 'f') {
            return c - 'a' + 10;
        }

        if (c >= 'A' && c <= 'F') {
            return c - 'A' + 10;
        }

        throw std::invalid_argument{"Invalid hex character"};
    }

}

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

std::vector<unsigned char> utils::fromHex(std::string_view hex) {
    if (hex.size() % 2 != 0) {
        throw std::invalid_argument{"Invalid hex length"};
    }

    std::vector<unsigned char> result;
    result.reserve(hex.size() / 2);

    for (std::size_t i = 0; i < hex.size(); i += 2) {
        const auto high = hexDigit(hex[i]);
        const auto low = hexDigit(hex[i + 1]);

        result.push_back(
            static_cast<unsigned char>((high << 4) | low)
        );
    }

    return result;
}
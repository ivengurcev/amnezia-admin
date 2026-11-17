
#include <cstdint>
#include <string>

struct Cidr {
    std::uint32_t address;
    int prefix;
};

namespace net {
    std::uint32_t ipv4ToInt(const std::string& ip);
    std::uint32_t prefixToMask(int prefix);
    std::string intToIpv4(std::uint32_t ip);
    Cidr parseCidr(const std::string& cidr);
}
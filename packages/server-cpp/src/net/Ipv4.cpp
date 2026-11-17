#include "Ipv4.hpp"
#include <arpa/inet.h>
#include <stdexcept>

std::uint32_t net::prefixToMask(int prefix) {  // Преобразуем длину префикса IPv4 в 32-битную маску.

    if (prefix < 0 || prefix > 32) {  // IPv4 содержит ровно 32 бита, поэтому другие значения недопустимы.
        throw std::out_of_range{"Invalid IPv4 prefix"};  // Сообщаем вызывающему коду об ошибке.
    }

    if (prefix == 0) {  // Особый случай: ни один бит не относится к сети.
        return 0u;  // Маска /0 состоит из 32 нулей; заодно избегаем недопустимого сдвига на 32 бита.
    }

    std::uint32_t mask = 0xFFFFFFFFu;  // Создаём число из 32 единичных битов: 11111111 11111111 11111111 11111111.

    mask <<= (32 - prefix);  // Сдвигаем биты влево, заполняя справа нулями; для /24 это сдвиг на 8 битов.

    return mask;  // Возвращаем готовую маску, например 0xFFFFFF00 для /24.
}

std::uint32_t net::ipv4ToInt(const std::string& ip) {
    in_addr address{};
    auto result =  inet_pton(AF_INET, ip.c_str(), &address);
    if(result == -1) {
        throw std::runtime_error{"Ошибка вызова преобразования IP"};
    } else if (result == 0) {
        throw std::invalid_argument{"Ошибка преобразования IP: " + ip};
    }
    return ntohl(address.s_addr);
}

std::string net::intToIpv4(std::uint32_t ip) {
    in_addr address{};
    address.s_addr = htonl(ip);

    char buffer[INET_ADDRSTRLEN]{};

    const char* result = inet_ntop(
        AF_INET,
        &address,
        buffer,
        sizeof(buffer)
    );    
    if(result == nullptr) {
        throw std::runtime_error{"IPv4 conversion failed"};
    }
    return result;
}

Cidr net::parseCidr(const std::string& cidr) {
    auto pos = cidr.find('/');

    if (pos == std::string::npos) {
        throw std::invalid_argument{"Invalid CIDR"};
    }

    auto prefix = std::stoi(cidr.substr(pos + 1));

    if (prefix < 0 || prefix > 32) {
        throw std::out_of_range{"Invalid IPv4 prefix"};
    }

    return {
        ipv4ToInt(cidr.substr(0, pos)),
        prefix
    };
}
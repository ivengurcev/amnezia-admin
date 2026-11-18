#include "security/Password.hpp"
#include "utils/Hex.hpp"

#include <openssl/evp.h>
#include <openssl/rand.h>

#include <array>
#include <cstdint>
#include <iostream>
#include <stdexcept>
#include <string>
#include <termios.h>
#include <unistd.h>

namespace {

    class HiddenInput {
    public:
        HiddenInput() {
            if (!isatty(STDIN_FILENO) ||
                tcgetattr(STDIN_FILENO, &original_) != 0) {
                throw std::runtime_error{"Требуется терминал"};
            }

            termios modified = original_;
            modified.c_lflag &= ~ECHO;

            if (tcsetattr(STDIN_FILENO, TCSANOW, &modified) != 0) {
                throw std::runtime_error{"Не удалось скрыть ввод"};
            }
        }

        ~HiddenInput() {
            tcsetattr(STDIN_FILENO, TCSANOW, &original_);
        }

    private:
        termios original_{};
    };
}

std::string readPassword(const std::string& prompt) {
    std::cout << prompt << std::flush;

    std::string password;
    bool success;

    {
        HiddenInput hidden;
        success = static_cast<bool>(std::getline(std::cin, password));
    }

    std::cout << '\n';

    if (!success) {
        throw std::runtime_error{"Не удалось прочитать пароль"};
    }

    return password;
}

std::string hashPassword(const std::string& password) {
    constexpr std::uint64_t N = 32768;
    constexpr std::uint64_t r = 8;
    constexpr std::uint64_t p = 1;

    std::array<unsigned char, 16> salt{};
    std::array<unsigned char, 32> hash{};

    if (RAND_bytes(salt.data(), static_cast<int>(salt.size())) != 1) {
        throw std::runtime_error{"Не удалось создать соль"};
    }

    if (EVP_PBE_scrypt(
            password.data(),
            password.size(),
            salt.data(),
            salt.size(),
            N,
            r,
            p,
            64 * 1024 * 1024,
            hash.data(),
            hash.size()
        ) != 1) {
        throw std::runtime_error{"Не удалось вычислить хеш пароля"};
    }

    return "scrypt$32768$8$1$"
        + utils::toHex(salt.data(), salt.size())
        + "$"
        + utils::toHex(hash.data(), hash.size());
}

#include "security/SessionStore.hpp"
#include "utils/Hex.hpp"

#include <openssl/rand.h>
#include <openssl/sha.h>

#include <array>
#include <stdexcept>

std::string SessionStore::hashToken(const std::string& token) {
    std::array<unsigned char, SHA256_DIGEST_LENGTH> hash{};

    SHA256(
        reinterpret_cast<const unsigned char*>(token.data()),
        token.size(),
        hash.data()
    );

    return utils::toHex(hash.data(), hash.size());
}

std::string SessionStore::create(const std::string& publicKey) {
    std::array<unsigned char, 32> bytes{};

    if (RAND_bytes(bytes.data(), bytes.size()) != 1) {
        throw std::runtime_error{"Не удалось создать сессию"};
    }

    const auto token = utils::toHex(bytes.data(), bytes.size());
    const auto key = hashToken(token);
    const auto now = std::chrono::steady_clock::now();

    std::lock_guard lock{mutex_};

    // Заодно удаляем истёкшие сессии.
    for (auto it = sessions_.begin(); it != sessions_.end();) {
        if (it->second.expiresAt <= now) {
            it = sessions_.erase(it);
        } else {
            ++it;
        }
    }

    sessions_.emplace(key, Session{
        publicKey,
        now + std::chrono::hours{24}
    });

    return token;
}

std::optional<std::string> SessionStore::find(
    const std::string& token
) {
    if (token.size() != 64) {
        return std::nullopt;
    }

    const auto key = hashToken(token);

    std::lock_guard lock{mutex_};

    const auto it = sessions_.find(key);

    if (it == sessions_.end()) {
        return std::nullopt;
    }

    if (it->second.expiresAt <= std::chrono::steady_clock::now()) {
        sessions_.erase(it);
        return std::nullopt;
    }

    return it->second.publicKey;
}

void SessionStore::remove(const std::string& token) {
    if (token.size() != 64) {
        return;
    }

    const auto key = hashToken(token);

    std::lock_guard lock{mutex_};
    sessions_.erase(key);
}
#include <array>
#include <openssl/rand.h>
#include <openssl/sha.h>

#include "links/LinkService.hpp"
#include "utils/Hex.hpp"
#include <optional>
#include <stdexcept>
#include <string>

namespace {
    std::string hashToken(const std::string& token) {
        std::array<unsigned char, SHA256_DIGEST_LENGTH> digest{};

        SHA256(
            reinterpret_cast<const unsigned char*>(token.data()),
            token.size(),
            digest.data()
        );

        return utils::toHex(digest.data(), digest.size());
    }
}

LinkService::LinkService(const std::string& dbPath): db_{dbPath, SQLite::OPEN_READWRITE | SQLite::OPEN_CREATE} {
    db_.exec("PRAGMA foreign_keys = ON");
}

std::string LinkService::create(
    const std::string& peerPublicKey,
    std::int64_t ttlSeconds
) {
    std::lock_guard lock{mutex_};
    if(ttlSeconds < 1) {
        throw std::invalid_argument{"ttl должен быть больше 0"};
    }
    SQLite::Statement query{
        db_,
        R"(INSERT INTO delivery_links (
            peer_public_key,
            token_hash,
            expires_at
        )
        VALUES (?, ?, unixepoch() + ?);)"
    };

    std::array<unsigned char, 32> bytes{};

    if (RAND_bytes(bytes.data(), static_cast<int>(bytes.size())) != 1) {
        throw std::runtime_error{"Failed to generate random token"};
    }
    auto token = utils::toHex(bytes.data(), bytes.size());
    
    query.bind(1, peerPublicKey);
    query.bind(2, hashToken(token));
    query.bind(3, ttlSeconds);

    query.exec();    
    return token;
}

std::optional<std::string> LinkService::redeem(const std::string& token) {
    std::lock_guard lock{mutex_};

    SQLite::Statement query{
        db_,
        R"sql(
            UPDATE delivery_links
            SET used_at = unixepoch()
            WHERE token_hash = ?
              AND used_at IS NULL
              AND expires_at > unixepoch()
            RETURNING peer_public_key
        )sql"
    };

    query.bind(1, hashToken(token));

    if (!query.executeStep()) {
        return std::nullopt;
    }

    return query.getColumn(0).getString();
}

std::optional<std::string> LinkService::peek(const std::string& token) {
    std::lock_guard lock{mutex_};

    SQLite::Statement query{
        db_,
        R"sql(
            SELECT peer_public_key
            FROM delivery_links
            WHERE token_hash = ?
              AND used_at IS NULL
              AND expires_at > unixepoch()
        )sql"
    };

    query.bind(1, hashToken(token));

    if (!query.executeStep()) {
        return std::nullopt;
    }

    return query.getColumn(0).getString();
}
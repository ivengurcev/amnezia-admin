#pragma once

#include <SQLiteCpp/SQLiteCpp.h>
#include <cstdint>
#include <mutex>
#include <optional>
#include <string>

class LinkService {
public:
    explicit LinkService(const std::string& dbPath);

    std::string create(
        const std::string& peerPublicKey,
        std::int64_t ttlSeconds
    );

    std::optional<std::string> redeem(const std::string& token);
    std::optional<std::string> peek(const std::string& token);

private:
    SQLite::Database db_;
    std::mutex mutex_;
};
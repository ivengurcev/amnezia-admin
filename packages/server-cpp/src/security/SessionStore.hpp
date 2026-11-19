
#pragma once

#include <chrono>
#include <mutex>
#include <optional>
#include <string>
#include <unordered_map>

class SessionStore {
public:
    std::string create(const std::string& publicKey);
    std::optional<std::string> find(const std::string& token);
    void remove(const std::string& token);

private:
    struct Session {
        std::string publicKey;
        std::chrono::steady_clock::time_point expiresAt;
    };

    static std::string hashToken(const std::string& token);

    std::unordered_map<std::string, Session> sessions_;
    std::mutex mutex_;
};
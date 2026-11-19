#pragma once

#include "PeerService.hpp"

#include <SQLiteCpp/SQLiteCpp.h>
#include <mutex>
#include <optional>
#include <string>
#include <vector>

class PeerStore {
public:
    explicit PeerStore(const std::string& path);

    std::vector<CreatedPeer> list();
    void insert(const CreatedPeer& peer);
    bool remove(const std::string& publicKey);
    std::optional<CreatedPeer> find(const std::string& publicKey);
    bool isAdminIp(const std::string& ip);

private:
    SQLite::Database db_;
    std::mutex mutex_;
};
#include "PeerStore.hpp"
#include <string>
#include <vector>

PeerStore::PeerStore(const std::string& path)
    : db_{path, SQLite::OPEN_READWRITE | SQLite::OPEN_CREATE}
{
    db_.exec("PRAGMA foreign_keys = ON");

    db_.exec(R"sql(
        CREATE TABLE IF NOT EXISTS peers (
            public_key TEXT PRIMARY KEY,
            private_key TEXT NOT NULL,
            allowed_ips TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
    )sql");

    db_.exec(R"sql(
        CREATE TABLE IF NOT EXISTS delivery_links (
            id INTEGER PRIMARY KEY,
            peer_public_key TEXT NOT NULL
                REFERENCES peers(public_key) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            expires_at INTEGER NOT NULL,
            used_at INTEGER
        )
    )sql");
}

std::vector<CreatedPeer> PeerStore::list() {
    std::lock_guard lock{mutex_};

    SQLite::Statement query{
        db_,
        "SELECT private_key, public_key, allowed_ips FROM peers"
    };

    std::vector<CreatedPeer> peers;

    while (query.executeStep()) {
        peers.push_back({
            query.getColumn(0).getString(),
            query.getColumn(1).getString(),
            query.getColumn(2).getString()
        });
    }
    return peers;
}



void PeerStore::insert(const CreatedPeer& peer) {
    std::lock_guard lock{mutex_};

    SQLite::Statement query{
        db_,
        "INSERT INTO peers (public_key, private_key, allowed_ips) "
        "VALUES (?, ?, ?)"
    };

    query.bind(1, peer.publicKey);
    query.bind(2, peer.privateKey);
    query.bind(3, peer.allowedIps);

    query.exec();
}

bool PeerStore::remove(const std::string& publicKey) {
    std::lock_guard lock{mutex_};

    SQLite::Statement query{
        db_,
        "DELETE FROM peers WHERE public_key = ?"
    };

    query.bind(1, publicKey);

    return query.exec() > 0;
}

std::optional<CreatedPeer> PeerStore::find(const std::string& publicKey) {
    std::lock_guard lock{mutex_};

    SQLite::Statement query{
        db_,
        "SELECT private_key, public_key, allowed_ips "
        "FROM peers WHERE public_key = ?"
    };

    query.bind(1, publicKey);

    if (!query.executeStep()) {
        return std::nullopt;
    }

    return CreatedPeer{
        query.getColumn(0).getString(),
        query.getColumn(1).getString(),
        query.getColumn(2).getString()
    };
}
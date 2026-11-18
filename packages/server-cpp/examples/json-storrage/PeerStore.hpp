#pragma once

#include "../src/peers/PeerService.hpp"

#include <SQLiteCpp/SQLiteCpp.h>
#include <string>
#include <vector>

class PeerStore {
public:
    explicit PeerStore(const std::string& path);

    std::vector<CreatedPeer> load() const;
    void save(const std::vector<CreatedPeer>& peers) const ;

private:
    std::string path_;
};
#include "PeerStore.hpp"
#include <fstream>
#include <nlohmann/json.hpp>
#include <string>
#include <vector>
#include <filesystem>
#include <stdexcept>

PeerStore::PeerStore(const std::string& path): path_(path) {}

std::vector<CreatedPeer> PeerStore::load() const {
    if (!std::filesystem::exists(path_)) {
        return {};
    }
    std::ifstream file{path_};
    if (!file) {
        throw std::runtime_error{"Не удалось открыть базу сохраненных подключений"};
    }
    nlohmann::json data;
    file >> data;

    std::vector<CreatedPeer> result;
    for(const auto& peer: data) {
        result.push_back({
            peer.at("privateKey").get<std::string>(),
            peer.at("publicKey").get<std::string>(),
            peer.at("allowedIps").get<std::string>()
        });
    }    
    return result;
} 

void PeerStore::save(const std::vector<CreatedPeer>& peers) const {
    std::string tmpFileName{path_ + ".tmp"};
    nlohmann::json data = nlohmann::json::array();

    for (const auto& peer : peers) {
        data.push_back({
            {"privateKey", peer.privateKey},
            {"publicKey", peer.publicKey},
            {"allowedIps", peer.allowedIps}
        });
    }

    {
        std::ofstream file{tmpFileName};
        if (!file) {
            throw std::runtime_error{"Не удалось открыть файл"};
        }

        file << data.dump();
        file.flush();

        if (!file) {
            throw std::runtime_error{"Ошибка записи файла"};
        }
        file.close();
        if (!file) {
            throw std::runtime_error{"Ошибка закрытия файла"};
        }
    }
    std::filesystem::rename(tmpFileName, path_);
}
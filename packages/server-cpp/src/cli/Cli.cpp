#include "cli/Cli.hpp"

#include "awg/AwgDriver.hpp"
#include "peers/PeerService.hpp"
#include "peers/PeerStore.hpp"
#include "links/LinkService.hpp"
#include "security/Password.hpp"

#include <cstdlib>
#include <iostream>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>

namespace {

    std::string requiredEnv(const char* name) {
        const char* value = std::getenv(name);

        if (!value || !*value) {
            throw std::runtime_error{
                std::string{"Missing environment variable: "} + name
            };
        }

        return value;
    }

    void printHelp() {
        std::cout <<
            "Управление AmneziaWG\n\n"
            "  vpn-admin add \"Имя\"          Создать подключение\n"
            "  vpn-admin add \"Имя\" --admin  Создать администратора\n"
            "  vpn-admin list                Все подключения\n"
            "  vpn-admin list --admin        Только администраторы\n"
            "  vpn-admin link \"PUBLIC_KEY\"  Повторная выдача ссылки\n"
            "  vpn-admin help                Справка\n";
    }

}

int runCli(int argc, char* argv[]) {
    try {
        std::string_view command = argv[1];

        if (command == "help" || command == "--help") {
            printHelp();
            return 0;
        }

        if (command != "add" && command != "list" && command != "link") {
            printHelp();
            return 2;
        }

        AwgDriver awg{requiredEnv("AWG_INTERFACE")};
        PeerStore store{"/data/amnezia-admin.db"};
        PeerService peers{awg, store};
        LinkService links{"/data/amnezia-admin.db"};

        if (command == "list") {
            if (argc > 3 ||
                (argc == 3 && std::string_view{argv[2]} != "--admin")) {
                printHelp();
                return 2;
            }

            const bool adminsOnly = argc == 3;            
            for (const auto& peer : store.list()) {
                if (adminsOnly && !peer.isAdmin) {
                    continue;
                }

                std::cout
                    << peer.name << " | "
                    << peer.allowedIps << " | "
                    << (peer.isAdmin ? "admin" : "client") << '\n'
                    << "  PublicKey: " << peer.publicKey << '\n';
            }
            return 0;
        }
        if (command == "link") {
            if (argc != 3) {
                printHelp();
                return 2;
            }

            const std::string publicKey = argv[2];

            auto peer = store.find(publicKey);

            if (!peer) {
                throw std::runtime_error{"Подключение не найдено"};
            }

            auto baseUrl = requiredEnv("SETUP_BASE_URL");

            if (baseUrl.back() == '/') {
                baseUrl.pop_back();
            }

            auto token = links.create(publicKey, 86400);

            std::cout
                << "Подключение: " << peer->name << '\n'
                << "IP: " << peer->allowedIps << '\n'
                << "\nНовая одноразовая ссылка:\n"
                << baseUrl << "/setup/" << token << '\n';

            return 0;
        }
        const bool admin =
            argc == 4 && std::string_view{argv[3]} == "--admin";

        if ((argc != 3 && argc != 4) || (argc == 4 && !admin)) {
            printHelp();
            return 2;
        }

        std::string name = argv[2];

        if (name.empty() || name.size() > 100 ||
            name.find_first_not_of(" \t\r\n") == std::string::npos) {
            throw std::invalid_argument{"Invalid peer name"};
        }

        auto baseUrl = requiredEnv("SETUP_BASE_URL");

        std::optional<std::string> passwordHash;

        if (admin) {
            // Здесь запросим пароль и вычислим его хеш.
            // Разберём реализацию ниже.
            auto password = readPassword("Пароль администратора: ");
            auto confirmation = readPassword("Повторите пароль: ");

            if (password != confirmation) {
                throw std::runtime_error{"Пароли не совпадают"};
            }

            if (password.size() < 8) {
                throw std::runtime_error{"Пароль должен содержать минимум 8 символов"};
            }

            passwordHash = hashPassword(password);            
        }

        auto peer = peers.createPeer(name, passwordHash);
        auto token = links.create(peer.publicKey, 86400);

        if (!baseUrl.empty() && baseUrl.back() == '/') {
            baseUrl.pop_back();
        }

        std::cout
            << "\nПодключение создано\n"
            << "Имя: " << peer.name << '\n'
            << "IP: " << peer.allowedIps << '\n'
            << "Тип: " << (peer.isAdmin ? "Администратор" : "Обычный")
            << "\n\nОдноразовая ссылка:\n"
            << baseUrl << "/setup/" << token << '\n';

        return 0;
    } catch (const std::exception& e) {
        std::cerr << "Ошибка: " << e.what() << '\n';
        return 1;
    }
}
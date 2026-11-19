#pragma once

#include <string>

std::string readPassword(const std::string& prompt);
std::string hashPassword(const std::string& password);
bool verifyPassword(
    const std::string& password,
    const std::string& storedHash
);
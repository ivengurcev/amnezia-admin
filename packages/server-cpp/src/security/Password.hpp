#pragma once

#include <string>

std::string readPassword(const std::string& prompt);
std::string hashPassword(const std::string& password);
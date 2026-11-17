#pragma once

#include <string>
#include <vector>

namespace process {
    std::string runCommand(
        const std::string& program,
        const std::vector<std::string>& args,
        const std::string& input = ""
    );
}
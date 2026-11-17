cmake_minimum_required(VERSION 3.20)
project(amnezia-admin LANGUAGES CXX)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

include(FetchContent)

FetchContent_Declare(
    httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG v0.58.0
    GIT_SHALLOW TRUE
)

FetchContent_MakeAvailable(httplib)

FetchContent_Declare(
    json
    URL https://github.com/nlohmann/json/releases/download/v3.12.0/json.tar.xz
)

FetchContent_MakeAvailable(json)

add_executable(amnezia-admin 
    src/main.cpp
    src/http/HttpServer.cpp
    src/process/ProcessRunner.cpp
    src/awg/AwgDriver.cpp
    src/net/Ipv4.cpp
    src/peers/PeerService.cpp
)
target_compile_features(amnezia-admin PRIVATE cxx_std_20)
target_link_libraries(amnezia-admin PRIVATE 
    httplib::httplib
    nlohmann_json::nlohmann_json
)
target_include_directories(amnezia-admin PRIVATE src)

add_executable(process-demo
    src/process_demo.cpp
    src/process/ProcessRunner.cpp
)

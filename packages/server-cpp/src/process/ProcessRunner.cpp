#include "ProcessRunner.hpp"
#include <cerrno>
#include <csignal>
#include <spawn.h>
#include <stdexcept>
#include <string>
#include <sys/poll.h>
#include <sys/wait.h>
#include <system_error>
#include <unistd.h>

extern char** environ;


class UniqueFd {
public:
    explicit UniqueFd(int fd) : fd_(fd) {}

    ~UniqueFd() {
        // Здесь нужно закрыть дескриптор
        reset();
    }

    int get() const {
        return fd_;
    }

    void reset() {
        // Закрыть дескриптор и установить fd_ = -1
        if(fd_ >= 0) {
            ::close(fd_);
            fd_ = -1;
        }
    }

    UniqueFd(const UniqueFd&) = delete;
    UniqueFd& operator=(const UniqueFd&) = delete;

private:
    int fd_;
};


class SpawnActions {
public:
    SpawnActions() {
        // Инициализировать actions_
        // Если результат != 0, выбросить исключение
        if(posix_spawn_file_actions_init(&actions_) != 0) {
            throw std::runtime_error{"Не удадось настроить spawn actions"};
        }
    }

    ~SpawnActions() {
        // Освободить actions_
        posix_spawn_file_actions_destroy(&actions_);
    }

    posix_spawn_file_actions_t* get() {
        return &actions_;
    }

    SpawnActions(const SpawnActions&) = delete;
    SpawnActions& operator=(const SpawnActions&) = delete;

private:
    posix_spawn_file_actions_t actions_;
};

class ChildProcess {
public:
    explicit ChildProcess(pid_t pid) : pid_(pid) {}

    ~ChildProcess() noexcept {
        // Аварийное завершение процесса
        if(pid_ >0) {
            ::kill(pid_, SIGKILL);
            
            int result;
            do {
                result = ::waitpid(pid_, nullptr, 0);
            } while (result == -1 && errno == EINTR);            
        }
    }

    int wait() {
        int result;
        int status{};
        do {
            result = ::waitpid(pid_, &status, 0);
        } while (result == -1 && errno == EINTR);    
        if(result == -1) {
            throw std::system_error{
                errno,
                std::generic_category(),
                "Ошибка ожидания дочернего процесса"
            };
        }
        pid_ = -1;
        return status;
    }

    ChildProcess(const ChildProcess&) = delete;
    ChildProcess& operator=(const ChildProcess&) = delete;

private:
    pid_t pid_;
};

void catchSpawnError(const int& posixResult, const std::string& message) {
    if (posixResult != 0) {
        throw std::system_error{
            posixResult,
            std::generic_category(),
            message
        };          
    }
}

void setupFD(
    SpawnActions& actions, 
    const UniqueFd& readFd, 
    const UniqueFd& writeFd, 
    const int targetFd,
    const std::string& textOut,
    const std::string& textReadFd,
    const std::string& textWriteFD
) {
    catchSpawnError(posix_spawn_file_actions_adddup2(
        actions.get(), writeFd.get(), targetFd
    ), "Не удалось перенаправить " + textOut);
    catchSpawnError(
        posix_spawn_file_actions_addclose(actions.get(), readFd.get()), 
        "Не удалось настроить закрытие " + textReadFd
    );
    catchSpawnError(
        posix_spawn_file_actions_addclose(actions.get(), writeFd.get()),
        "Не удалось настроить закрытие " + textWriteFD
    );    
}

namespace process {
    std::string runCommand(const std::string& program, const std::vector<std::string>& args) {
        int fd[2];
        if (pipe(fd) == -1) {
            throw std::runtime_error{"Не удалось создать pipe"};
        }

        UniqueFd readFd{fd[0]};
        UniqueFd writeFd{fd[1]};

        int errorFd[2];
        if (::pipe(errorFd) == -1) {
            throw std::runtime_error{"Не удалось создать stderr pipe"};
        }

        UniqueFd errorRead{errorFd[0]};
        UniqueFd errorWrite{errorFd[1]};     


        // std::cout << "Pipe создан\n";

        std::vector<std::string> values;
        values.push_back(program);
        values.insert(values.end(), args.begin(), args.end());

        std::vector<char*> argv;
        for (auto& value : values) {
            argv.push_back(value.data());
        }
        argv.push_back(nullptr);

        SpawnActions actions;

        setupFD(actions, readFd, writeFd, STDOUT_FILENO, "stdout", "readFd", "writeFd");
        setupFD(actions, errorRead, errorWrite, STDERR_FILENO, "stderr", "errorReadFd", "errorWriteFd");

        pid_t pid{};
        int result = posix_spawnp(
            &pid,
            program.c_str(),
            actions.get(),
            nullptr,
            argv.data(),
            environ
        );

        if(result) {
            throw std::runtime_error{"Не получилось стартовать процесс"};
        }

        ChildProcess child{pid};

        writeFd.reset();
        errorWrite.reset();

        pollfd streams[2]{
            {readFd.get(), POLLIN, 0},
            {errorRead.get(), POLLIN, 0}
        };
        
        std::string output;
        std::string errors;

        int activeStreams = 2;
        char buffer[256];

        while (activeStreams > 0) {
            int ready = ::poll(streams, 2, -1);

            if (ready == -1) {
                if (errno == EINTR) {
                    continue;
                }
                throw std::system_error{
                    errno, std::generic_category(), "Ошибка poll"
                };
            }

            for (int i = 0; i < 2; ++i) {
                auto& stream = streams[i];

                if (stream.fd == -1) {
                    continue;
                }

                if (stream.revents & POLLNVAL) {
                    throw std::runtime_error{"Недействительный дескриптор"};
                }

                if (!(stream.revents & (POLLIN | POLLHUP | POLLERR))) {
                    continue;
                }

                ssize_t count = ::read(stream.fd, buffer, sizeof(buffer));

                if (count > 0) {
                    if (i == 0) {
                        output.append(buffer, count);
                    } else {
                        errors.append(buffer, count);
                    }
                } else if (count == 0) {
                    if (i == 0) {
                        readFd.reset();
                    } else {
                        errorRead.reset();
                    }

                    stream.fd = -1;
                    --activeStreams;
                } else {
                    if (errno == EINTR) {
                        continue;
                    }
                    throw std::system_error{
                        errno, std::generic_category(), "Ошибка чтения pipe"
                    };
                }
            }
        }

        int status = child.wait();

        if (!WIFEXITED(status) || WEXITSTATUS(status) != 0) {
            throw std::runtime_error{
                "Процесс завершился с ошибкой: " + errors
            };
        }

        return output;
        // char buffer[256];
        // ssize_t count;
        // std::string output;

        // while ((count = read(readFd.get(), buffer, sizeof(buffer))) > 0) {
        //     // std::cout.write(buffer, count);
        //     output.append(buffer, count);
        // }


        // int status = child.wait();

        // if(count == -1) {
        //     throw std::runtime_error{"Ошибка чтения pipe"};
        // }

        // if (!WIFEXITED(status) || WEXITSTATUS(status) != 0) {
        //     throw std::runtime_error{"Процесс завершился с ошибкой"};
        // }

        // return output;
    }
}

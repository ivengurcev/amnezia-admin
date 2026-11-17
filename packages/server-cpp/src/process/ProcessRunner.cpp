#include "ProcessRunner.hpp"
#include <array>
#include <cerrno>
#include <csignal>
#include <fcntl.h>
#include <spawn.h>
#include <stdexcept>
#include <string>
#include <sys/poll.h>
#include <sys/wait.h>
#include <system_error>
#include <unistd.h>
#include <utility>

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
    const UniqueFd& fd1, 
    const UniqueFd& fd2, 
    const int targetFd,
    const std::string& pipeLabel,
    const std::string& fd1Label,
    const std::string& fd2Label
) {
    catchSpawnError(posix_spawn_file_actions_adddup2(
        actions.get(), fd2.get(), targetFd
    ), "Не удалось перенаправить " + pipeLabel);
    catchSpawnError(
        posix_spawn_file_actions_addclose(actions.get(), fd1.get()), 
        "Не удалось настроить закрытие " + fd1Label
    );
    catchSpawnError(
        posix_spawn_file_actions_addclose(actions.get(), fd2.get()),
        "Не удалось настроить закрытие " + fd2Label
    );    
}

std::array<UniqueFd, 2> createPipe() {
    int fd[2];
    if (pipe(fd) == -1) {
        throw std::system_error{
            errno, 
            std::generic_category(), 
            "Не удалось создать pipe"
        };
    }   
    return {UniqueFd{fd[0]}, UniqueFd{fd[1]}};
}

std::array<std::string, 2> communicate(UniqueFd& fdOut, UniqueFd& fdError, UniqueFd& fdInput, const std::string& input) {
    if (input.empty()) {
        fdInput.reset();
    }    
    if (fdInput.get() >= 0) {
        int flags = ::fcntl(fdInput.get(), F_GETFL);

        if (flags == -1 || ::fcntl(fdInput.get(), F_SETFL, flags | O_NONBLOCK) == -1) {
            throw std::system_error{
                errno,
                std::generic_category(),
                "Не удалось настроить stdin"
            };
        }
    }    
    pollfd streams[3]{
        {fdOut.get(), POLLIN, 0},
        {fdError.get(), POLLIN, 0},
        {fdInput.get(), POLLOUT, 0}
    };

    std::string output;
    std::string errors;

    int activeStreams = fdInput.get() >= 0 ? 3 : 2;
    char buffer[256];
    std::size_t written = 0;

    while (activeStreams > 0) {
        int ready = ::poll(streams, 3, -1);

        if (ready == -1) {
            if (errno == EINTR) {
                continue;
            }
            throw std::system_error{
                errno, std::generic_category(), "Ошибка poll"
            };
        }

        for (int i = 0; i < 3; ++i) {
            auto& stream = streams[i];

            if (stream.fd == -1) {
                continue;
            }

            if (stream.revents & POLLNVAL) {
                throw std::runtime_error{"Недействительный дескриптор"};
            }

            if (i == 2) {
                if (stream.revents & (POLLHUP | POLLERR)) {
                    throw std::runtime_error{"Дочерний процесс закрыл stdin"};
                }

                if (!(stream.revents & POLLOUT)) {
                    continue;
                }

                ssize_t count = ::write(
                    stream.fd,
                    input.data() + written,
                    input.size() - written
                );

                if (count > 0) {
                    written += count;
                } else if (count == -1) {
                    if (errno == EINTR || errno == EAGAIN || errno == EWOULDBLOCK) {
                        continue;
                    }

                    throw std::system_error{
                        errno,
                        std::generic_category(),
                        "Ошибка записи в stdin"
                    };
                } else {
                    throw std::runtime_error{"Не удалось записать данные в stdin"};
                }

                if (written == input.size()) {
                    fdInput.reset();
                    stream.fd = -1;
                    --activeStreams;
                }

                continue;
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
                    fdOut.reset();
                } else {
                    fdError.reset();
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
    return {output, errors};
}

namespace process {
    std::string runCommand(
        const std::string& program, 
        const std::vector<std::string>& args,
        const std::string& input
    ) {
        auto [outRead, outWrite] = createPipe();
        auto [errorRead, errorWrite] = createPipe();
        auto [inputRead, inputWrite] = createPipe();    // stdin
        // std::cout << "Pipe создан\n";
        SpawnActions actions;

        setupFD(actions, outRead, outWrite, STDOUT_FILENO, "stdout", "readFd", "writeFd");
        setupFD(actions, errorRead, errorWrite, STDERR_FILENO, "stderr", "errorReadFd", "errorWriteFd");
        setupFD(actions, inputWrite, inputRead, STDIN_FILENO, "stdin", "input write FD", "input read FD");

        std::vector<std::string> values;
        values.push_back(program);
        values.insert(values.end(), args.begin(), args.end());

        std::vector<char*> argv;
        for (auto& value : values) {
            argv.push_back(value.data());
        }
        argv.push_back(nullptr);

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

        inputRead.reset();
        outWrite.reset();
        errorWrite.reset();


        auto [output, errors] = communicate(outRead, errorRead, inputWrite, input);


        int status = child.wait();

        if (!WIFEXITED(status) || WEXITSTATUS(status) != 0) {
            throw std::runtime_error{
                "Процесс завершился с ошибкой: " + errors
            };
        }

        return output;
    }
}

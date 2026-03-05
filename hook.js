/**
 * Universal hook script for all Claude CLI events.
 * Receives JSON from stdin, adds process.ppid (claude PID),
 * and forwards to the local HTTP hook server.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const PORT = 47821;

const chunks = [];
process.stdin.on('data', d => chunks.push(d));
process.stdin.on('end', () => {
    try {
        const data = JSON.parse(Buffer.concat(chunks).toString());
        // claude 프로세스 PID: hook.js의 부모 프로세스
        data._pid = process.ppid;
        data._timestamp = Date.now();

        // 1. 오프라인 복구 용도로 로컬 파일에 기록 (pixel-agent-desk가 종료된 상태라도 훅 내역 보존)
        try {
            const dir = path.join(os.homedir(), '.pixel-agent-desk');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.appendFileSync(path.join(dir, 'hooks.jsonl'), JSON.stringify(data) + '\n', 'utf-8');
        } catch (e) { }

        const body = Buffer.from(JSON.stringify(data), 'utf-8');

        // 2. HTTP 전송
        const req = http.request({
            hostname: '127.0.0.1',
            port: PORT,
            path: '/hook',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': body.length }
        }, () => process.exit(0));

        req.on('error', () => process.exit(0));
        req.setTimeout(3000, () => { req.destroy(); process.exit(0); });
        req.write(body);
        req.end();
    } catch (e) {
        process.exit(0);
    }
});

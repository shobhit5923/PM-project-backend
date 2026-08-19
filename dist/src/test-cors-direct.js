import http from 'http';
import app from './app.js';
function simulateRequest(method, path, headers) {
    return new Promise((resolve) => {
        const req = new http.IncomingMessage({});
        req.method = method;
        req.url = path;
        req.headers = headers;
        let responseBody = '';
        const res = new http.ServerResponse(req);
        res.write = function (chunk) {
            if (chunk)
                responseBody += chunk.toString();
            return true;
        };
        res.end = function (chunk) {
            if (chunk)
                responseBody += chunk.toString();
            resolve({
                status: res.statusCode,
                headers: res.getHeaders(),
                body: responseBody,
            });
            return res;
        };
        app(req, res);
    });
}
async function runTests() {
    const originsToTest = [
        'https://pm-project-frontend.vercel.app',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'https://pm-project-frontend-git-feature.vercel.app',
    ];
    for (const origin of originsToTest) {
        console.log(`\n--- TESTING ORIGIN: ${origin} ---`);
        const resOpt = await simulateRequest('OPTIONS', '/auth/register', {
            'origin': origin,
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'content-type',
            'host': 'localhost:4000',
        });
        console.log('OPTIONS Status:', resOpt.status);
        console.log('OPTIONS ACAO Header:', resOpt.headers['access-control-allow-origin']);
        const resPost = await simulateRequest('POST', '/auth/register', {
            'origin': origin,
            'content-type': 'application/json',
            'host': 'localhost:4000',
        });
        console.log('POST Status:', resPost.status);
        console.log('POST ACAO Header:', resPost.headers['access-control-allow-origin']);
    }
}
runTests();

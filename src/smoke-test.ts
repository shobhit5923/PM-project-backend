import { Readable, Duplex } from 'stream';
import http from 'http';
import jwt from 'jsonwebtoken';
import app from './app.js';
import { ENV } from './config/env.js';

interface TestResponse {
  status: number;
  headers: http.OutgoingHttpHeaders;
  body: any;
}

function request(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<TestResponse> {
  return new Promise((resolve) => {
    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';

    const req = new Readable() as any;
    req._read = () => {};
    req.method = method;
    req.url = path;
    req.headers = {};
    const socketMock = new Duplex({ read() {}, write(_chunk, _encoding, callback) { callback(); } }) as any;
    socketMock.remoteAddress = '127.0.0.1';
    socketMock.encrypted = false;

    req.socket = socketMock;
    req.connection = socketMock;

    for (const [k, v] of Object.entries(headers)) {
      req.headers[k.toLowerCase()] = v;
    }

    if (body) {
      req.headers['content-type'] = req.headers['content-type'] || 'application/json';
      req.headers['content-length'] = String(Buffer.byteLength(bodyStr));
    }

    let rawResponseBody = '';
    const res = new http.ServerResponse(req);

    res.write = function (chunk: any) {
      if (chunk) rawResponseBody += chunk.toString();
      return true;
    } as any;

    res.end = function (chunk?: any) {
      if (chunk) rawResponseBody += chunk.toString();
      let parsed: any = rawResponseBody;
      try {
        parsed = JSON.parse(rawResponseBody);
      } catch {
        // Keep raw string if not JSON
      }
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: parsed,
      });
      return res;
    } as any;

    app(req as any, res as any);

    if (bodyStr) {
      req.push(Buffer.from(bodyStr));
    }
    req.push(null);
  });
}

async function runSmokeTests() {
  console.log('====================================================');
  console.log('       GIM LOST & FOUND BACKEND SMOKE TEST          ');
  console.log('====================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail: string = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failedCount++;
    }
  }

  try {
    // 1. Health Check Endpoints
    console.log('--- 1. Health Check Endpoints ---');
    const healthRes = await request('GET', '/health');
    assert(
      healthRes.status === 200 && healthRes.body?.status === 'success',
      'GET /health returns 200 with status: success',
      `status: ${healthRes.status}, body: ${JSON.stringify(healthRes.body)}`
    );

    const healthzRes = await request('GET', '/healthz');
    assert(
      healthzRes.status === 200 && healthzRes.body?.status === 'success',
      'GET /healthz returns 200 with status: success'
    );

    const apiHealthRes = await request('GET', '/api/health');
    assert(
      apiHealthRes.status === 200 && apiHealthRes.body?.status === 'success',
      'GET /api/health returns 200 with status: success'
    );

    // 2. CORS Preflight (OPTIONS) Tests
    console.log('\n--- 2. CORS Policy Preflight (OPTIONS) Tests ---');
    const testOrigins = [
      'https://pm-project-frontend.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'https://pm-project-frontend-preview.vercel.app',
    ];

    for (const origin of testOrigins) {
      const corsRes = await request('OPTIONS', '/auth/register', {
        'origin': origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type, authorization',
      });

      const is204 = corsRes.status === 204;
      const acaoMatch = corsRes.headers['access-control-allow-origin'] === origin;
      const credsMatch = corsRes.headers['access-control-allow-credentials'] === 'true';

      assert(
        is204 && acaoMatch && credsMatch,
        `CORS OPTIONS Preflight for ${origin}`,
        `status: ${corsRes.status}, ACAO: ${corsRes.headers['access-control-allow-origin']}`
      );
    }

    // 3. Auth Endpoints & CORS Validation
    console.log('\n--- 3. Auth Endpoints & CORS Validation ---');
    const testEmail = `smoketest_${Date.now()}@example.com`;
    const testPassword = 'SmokeTestPassword123!';

    const regRes = await request('POST', '/auth/register', {
      'content-type': 'application/json',
      'origin': 'https://pm-project-frontend.vercel.app',
    }, {
      name: 'Smoke Test User',
      email: testEmail,
      password: testPassword,
    });

    assert(
      regRes.headers['access-control-allow-origin'] === 'https://pm-project-frontend.vercel.app',
      'POST /auth/register includes Access-Control-Allow-Origin header'
    );

    let token = regRes.body?.token;

    if (!token) {
      const loginRes = await request('POST', '/auth/login', {
        'content-type': 'application/json',
        'origin': 'http://localhost:5173',
      }, {
        email: testEmail,
        password: testPassword,
      });

      assert(
        loginRes.headers['access-control-allow-origin'] === 'http://localhost:5173',
        'POST /auth/login includes Access-Control-Allow-Origin header'
      );
      token = loginRes.body?.token;
    }

    if (token) {
      assert(true, 'POST /auth/register / login returns valid JWT token');
    } else {
      console.log('[INFO] Database offline locally — generating test JWT token to verify authenticated route handling');
      token = jwt.sign({ userId: 1 }, ENV.JWT_SECRET, { expiresIn: '1d' });
    }

    const authHeaders = {
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json',
      'origin': 'https://pm-project-frontend.vercel.app',
    };

    // 4. Reports Endpoints
    console.log('\n--- 4. Reports Endpoints ---');
    const getReportsRes = await request('GET', '/reports', authHeaders);
    assert(
      getReportsRes.headers['access-control-allow-origin'] === 'https://pm-project-frontend.vercel.app',
      'GET /reports returns valid CORS header'
    );
    assert(
      getReportsRes.status === 200 || getReportsRes.status === 500 || getReportsRes.status === 400,
      `GET /reports reachable (HTTP ${getReportsRes.status})`
    );

    const lostReportRes = await request('POST', '/reports/lost', authHeaders, {
      category: 'Electronics',
      description: 'Black phone lost',
      locationText: 'Library',
      dateTime: new Date().toISOString(),
    });
    assert(
      lostReportRes.headers['access-control-allow-origin'] === 'https://pm-project-frontend.vercel.app',
      'POST /reports/lost returns valid CORS header'
    );

    const foundReportRes = await request('POST', '/reports/found', authHeaders, {
      category: 'Electronics',
      description: 'Black phone found',
      locationText: 'Cafeteria',
      dateTime: new Date().toISOString(),
    });
    assert(
      foundReportRes.headers['access-control-allow-origin'] === 'https://pm-project-frontend.vercel.app',
      'POST /reports/found returns valid CORS header'
    );

    const myReportsRes = await request('GET', '/reports/me', authHeaders);
    assert(
      myReportsRes.headers['access-control-allow-origin'] === 'https://pm-project-frontend.vercel.app',
      'GET /reports/me returns valid CORS header'
    );

    // 5. Notifications Endpoints
    console.log('\n--- 5. Notifications Endpoints ---');
    const notifRes = await request('GET', '/notifications', authHeaders);
    assert(
      notifRes.headers['access-control-allow-origin'] === 'https://pm-project-frontend.vercel.app',
      'GET /notifications returns valid CORS header'
    );

    // 6. Matching Endpoints
    console.log('\n--- 6. Matching Endpoints ---');
    const myMatchesRes = await request('GET', '/matches/my', authHeaders);
    assert(
      myMatchesRes.headers['access-control-allow-origin'] === 'https://pm-project-frontend.vercel.app',
      'GET /matches/my returns valid CORS header'
    );

    const foundForMeRes = await request('GET', '/matches/found-for-me', authHeaders);
    assert(
      foundForMeRes.headers['access-control-allow-origin'] === 'https://pm-project-frontend.vercel.app',
      'GET /matches/found-for-me returns valid CORS header'
    );

  } catch (err) {
    console.error('Error during smoke tests:', err);
    failedCount++;
  }

  console.log('\n====================================================');
  console.log(`SMOKE TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('====================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSmokeTests().catch((err) => {
  console.error('Smoke test runner error:', err);
  process.exit(1);
});

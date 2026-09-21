import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics to track latency by feature area
const authDuration = new Trend('auth_duration');
const chatDuration = new Trend('chat_duration');
const readDuration = new Trend('read_duration');
const errorRate = new Rate('custom_error_rate');

export const options = {
  stages: [
    { duration: '15s', target: 10 }, // Ramp-up to 10 users
    { duration: '40s', target: 25 }, // Steady load: 25 concurrent users
    { duration: '20s', target: 40 }, // Peak load: 40 concurrent users
    { duration: '15s', target: 0 },  // Ramp-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000'], // 95% of requests should complete under 2s
    'http_req_failed': ['rate<0.05'],    // Less than 5% HTTP errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:3001/api/v1';

export default function () {
  const vuId = __VU;
  const iterId = __ITER;
  const userEmail = `loadtest_vu_${vuId}_${iterId % 5}@example.com`;
  const userPassword = 'TestPassword123!';
  let authToken = '';
  let refreshToken = '';

  // ─── 1. Auth Flow: Login or Signup (15% of requests) ──────────────────────
  group('1. Authentication', function () {
    const loginPayload = JSON.stringify({
      email: userEmail,
      password: userPassword,
    });
    const headers = { 'Content-Type': 'application/json' };

    const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, { headers });
    authDuration.add(loginRes.timings.duration);

    if (loginRes.status === 200) {
      const body = loginRes.json();
      authToken = body.data?.accessToken || body.accessToken;
      refreshToken = body.data?.refreshToken || body.refreshToken;
    } else if (loginRes.status === 401 || loginRes.status === 404) {
      // User doesn't exist yet, sign up
      const signupPayload = JSON.stringify({
        email: userEmail,
        password: userPassword,
        displayName: `Load Tester ${vuId}`,
      });
      const signupRes = http.post(`${BASE_URL}/auth/signup`, signupPayload, { headers });
      authDuration.add(signupRes.timings.duration);
      if (signupRes.status === 201 || signupRes.status === 200) {
        const body = signupRes.json();
        authToken = body.data?.accessToken || body.accessToken;
        refreshToken = body.data?.refreshToken || body.refreshToken;
      }
    }

    check(loginRes, {
      'auth responded': (r) => r.status === 200 || r.status === 401 || r.status === 404,
    });
  });

  sleep(1);

  if (!authToken) {
    errorRate.add(1);
    return;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  // ─── 2. Reading Operations: Models, Quota, Profile, Plans (50% of requests) ──
  group('2. Read Operations (Models, Quota, Plans)', function () {
    // Models
    const modelsRes = http.get(`${BASE_URL}/models`, { headers: authHeaders });
    readDuration.add(modelsRes.timings.duration);
    check(modelsRes, {
      'models status is 200': (r) => r.status === 200,
    });

    // Quota
    const quotaRes = http.get(`${BASE_URL}/chat/quota`, { headers: authHeaders });
    readDuration.add(quotaRes.timings.duration);
    check(quotaRes, {
      'quota status is 200': (r) => r.status === 200,
    });

    // Subscriptions / Plans
    const plansRes = http.get(`${BASE_URL}/subscriptions/plans`, { headers: authHeaders });
    readDuration.add(plansRes.timings.duration);
    check(plansRes, {
      'plans status is 200': (r) => r.status === 200,
    });

    // Files settings
    const filesRes = http.get(`${BASE_URL}/files/settings`, { headers: authHeaders });
    readDuration.add(filesRes.timings.duration);
    check(filesRes, {
      'files status is 200': (r) => r.status === 200,
    });
  });

  sleep(1.5);

  // ─── 3. Chat Operations: Conversations & Messaging (25% of requests) ────────
  group('3. Chat Workflow', function () {
    // 3.1 Create Conversation
    const convPayload = JSON.stringify({
      title: `Test Conversation VU ${vuId}`,
    });
    const convRes = http.post(`${BASE_URL}/chat/conversations`, convPayload, { headers: authHeaders });
    chatDuration.add(convRes.timings.duration);

    let convId = null;
    if (convRes.status === 201 || convRes.status === 200) {
      const body = convRes.json();
      convId = body.data?.id || body.id;
    }

    check(convRes, {
      'create conversation success': (r) => r.status === 201 || r.status === 200,
    });

    if (convId) {
      // 3.2 List conversations
      const listConvRes = http.get(`${BASE_URL}/chat/conversations`, { headers: authHeaders });
      chatDuration.add(listConvRes.timings.duration);
      check(listConvRes, {
        'list conversations status 200': (r) => r.status === 200,
      });

      // 3.3 Send Message (non-streaming JSON reply)
      const msgPayload = JSON.stringify({
        content: `سلام، این یک پیام تستی از کاربر همزمان شماره ${vuId} در تکرار ${iterId} است.`,
      });
      const msgHeaders = {
        ...authHeaders,
        'Accept': 'application/json',
      };
      const msgRes = http.post(`${BASE_URL}/chat/conversations/${convId}/messages`, msgPayload, {
        headers: msgHeaders,
        timeout: '15s',
      });
      chatDuration.add(msgRes.timings.duration);
      check(msgRes, {
        'send message responded': (r) => r.status === 200 || r.status === 201,
      });

      // 3.4 Get messages history
      const historyRes = http.get(`${BASE_URL}/chat/conversations/${convId}/messages`, { headers: authHeaders });
      chatDuration.add(historyRes.timings.duration);
      check(historyRes, {
        'get history status 200': (r) => r.status === 200,
      });
    }
  });

  sleep(1);

  // ─── 4. Token Refresh (10% of requests) ───────────────────────────────────
  if (refreshToken && iterId % 3 === 0) {
    group('4. Refresh Token Rotation', function () {
      const refreshPayload = JSON.stringify({
        refreshToken: refreshToken,
      });
      const refreshRes = http.post(`${BASE_URL}/auth/refresh`, refreshPayload, {
        headers: { 'Content-Type': 'application/json' },
      });
      authDuration.add(refreshRes.timings.duration);
      check(refreshRes, {
        'token refresh responded': (r) => r.status === 200 || r.status === 201,
      });
    });
  }

  sleep(2);
}

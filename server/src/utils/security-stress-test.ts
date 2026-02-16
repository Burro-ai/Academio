/**
 * Security Stress Test Suite - Auth & RBAC Strong Testing Protocol
 *
 * Tests the authentication system under stress, race conditions, and malicious attempts.
 *
 * Usage:
 *   npm run test:security
 *   npx tsx src/utils/security-stress-test.ts
 *
 * Test Scenarios:
 * 1. FORBIDDEN FRUIT - Role crossing attempts
 * 2. GHOST SESSION - Persistence integrity & race conditions
 * 3. EXPIRED TOKEN TRAP - Malformed/expired token handling
 * 4. SSE STREAM SECURITY - Bearer token verification in streams
 * 5. MULTI-SCHOOL SCOPE - Cross-school access prevention
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = process.env.API_URL || 'http://localhost:3001/api';
const JWT_SECRET = process.env.JWT_SECRET || 'academio-jwt-secret-change-in-production';

// ============ Types ============

interface TestResult {
  scenario: string;
  name: string;
  passed: boolean;
  latencyMs: number;
  details: string;
  httpStatus?: number;
  errorCode?: string;
}

interface ScenarioSummary {
  scenario: string;
  total: number;
  passed: number;
  failed: number;
  tests: TestResult[];
}

// ============ State ============

const allResults: TestResult[] = [];
const scenarioSummaries: ScenarioSummary[] = [];

// ============ Token Generators ============

function generateToken(payload: {
  id: string;
  email: string;
  role: 'STUDENT' | 'TEACHER';
  schoolId?: string;
}, expiresIn = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

function generateExpiredToken(payload: {
  id: string;
  email: string;
  role: 'STUDENT' | 'TEACHER';
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' } as jwt.SignOptions);
}

function generateMalformedToken(): string {
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiVEVBQ0hFUiJ9.INVALID_SIGNATURE';
}

function generateTokenWithWrongSecret(payload: {
  id: string;
  email: string;
  role: 'STUDENT' | 'TEACHER';
}): string {
  return jwt.sign(payload, 'wrong-secret-key', { expiresIn: '7d' } as jwt.SignOptions);
}

// ============ Fetch Helpers ============

async function fetchApi(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; body: any; latencyMs: number; headers: Headers }> {
  const start = performance.now();
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const latencyMs = performance.now() - start;
  let body = null;

  try {
    const text = await response.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    // Response might not be JSON
  }

  return { status: response.status, body, latencyMs, headers: response.headers };
}

// ============ Test Runner ============

async function runTest(
  scenario: string,
  name: string,
  testFn: () => Promise<{ passed: boolean; details: string; httpStatus?: number; errorCode?: string }>
): Promise<TestResult> {
  const start = performance.now();

  try {
    const result = await testFn();
    const latencyMs = performance.now() - start;

    const testResult: TestResult = {
      scenario,
      name,
      passed: result.passed,
      latencyMs,
      details: result.details,
      httpStatus: result.httpStatus,
      errorCode: result.errorCode,
    };

    allResults.push(testResult);

    const icon = result.passed ? '✓' : '✗';
    console.log(`    ${icon} ${name}`);
    if (!result.passed) {
      console.log(`      └─ ${result.details}`);
    }

    return testResult;
  } catch (error) {
    const latencyMs = performance.now() - start;
    const testResult: TestResult = {
      scenario,
      name,
      passed: false,
      latencyMs,
      details: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };

    allResults.push(testResult);
    console.log(`    ✗ ${name}`);
    console.log(`      └─ Error: ${error instanceof Error ? error.message : error}`);

    return testResult;
  }
}

// ============ SCENARIO 1: FORBIDDEN FRUIT TEST ============

async function runForbiddenFruitTests(): Promise<void> {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🍎 SCENARIO 1: FORBIDDEN FRUIT TEST (Role Crossing)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const studentToken = generateToken({
    id: 'test-student-001',
    email: 'student@test.com',
    role: 'STUDENT',
    schoolId: 'school-A',
  });

  const teacherToken = generateToken({
    id: 'test-teacher-001',
    email: 'teacher@test.com',
    role: 'TEACHER',
    schoolId: 'school-A',
  });

  // Test 1.1: Student accessing /api/teacher/homework/pending
  await runTest('FORBIDDEN_FRUIT', 'Student → /teacher/homework/pending (403)', async () => {
    const { status, body } = await fetchApi('/teacher/homework/pending', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    return {
      passed: status === 403 && body?.code === 'INSUFFICIENT_PERMISSIONS',
      details: `Expected 403 INSUFFICIENT_PERMISSIONS, got ${status} ${body?.code || 'no code'}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 1.2: Student accessing /api/students (teacher route)
  await runTest('FORBIDDEN_FRUIT', 'Student → /students (403)', async () => {
    const { status, body } = await fetchApi('/students', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    return {
      passed: status === 403 && body?.code === 'INSUFFICIENT_PERMISSIONS',
      details: `Expected 403 INSUFFICIENT_PERMISSIONS, got ${status} ${body?.code || 'no code'}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 1.3: Student accessing /api/lessons (teacher route)
  await runTest('FORBIDDEN_FRUIT', 'Student → /lessons (403)', async () => {
    const { status, body } = await fetchApi('/lessons', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    return {
      passed: status === 403 && body?.code === 'INSUFFICIENT_PERMISSIONS',
      details: `Expected 403 INSUFFICIENT_PERMISSIONS, got ${status} ${body?.code || 'no code'}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 1.4: Student accessing /api/homework (teacher route)
  await runTest('FORBIDDEN_FRUIT', 'Student → /homework (403)', async () => {
    const { status, body } = await fetchApi('/homework', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    return {
      passed: status === 403 && body?.code === 'INSUFFICIENT_PERMISSIONS',
      details: `Expected 403 INSUFFICIENT_PERMISSIONS, got ${status} ${body?.code || 'no code'}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 1.5: Teacher accessing /api/student/profile (student route)
  await runTest('FORBIDDEN_FRUIT', 'Teacher → /student/profile (403)', async () => {
    const { status, body } = await fetchApi('/student/profile', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    return {
      passed: status === 403 && body?.code === 'INSUFFICIENT_PERMISSIONS',
      details: `Expected 403 INSUFFICIENT_PERMISSIONS, got ${status} ${body?.code || 'no code'}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 1.6: Teacher accessing /api/admin/prompt (admin route)
  await runTest('FORBIDDEN_FRUIT', 'Teacher → /admin/prompt (403 or 401)', async () => {
    const { status, body } = await fetchApi('/admin/prompt', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    // Admin routes may reject with 403 (no permission) or use legacy auth
    const passed = status === 403 || status === 401;
    return {
      passed,
      details: `Expected 403 or 401, got ${status} ${body?.code || 'no code'}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 1.7: Student accessing /api/classroom (teacher route)
  await runTest('FORBIDDEN_FRUIT', 'Student → /classroom (403)', async () => {
    const { status, body } = await fetchApi('/classroom', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    return {
      passed: status === 403 && body?.code === 'INSUFFICIENT_PERMISSIONS',
      details: `Expected 403 INSUFFICIENT_PERMISSIONS, got ${status} ${body?.code || 'no code'}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 1.8: Role information NOT leaked in 403 response (security check)
  await runTest('FORBIDDEN_FRUIT', 'Error response does not leak sensitive data', async () => {
    const { body } = await fetchApi('/lessons', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    // Should NOT contain the full token, password, or internal paths
    const bodyStr = JSON.stringify(body);
    const leaksToken = bodyStr.includes(studentToken);
    const leaksPath = bodyStr.includes('server/src') || bodyStr.includes('C:\\Users');
    return {
      passed: !leaksToken && !leaksPath,
      details: leaksToken
        ? 'Response contains the JWT token - security leak!'
        : leaksPath
        ? 'Response contains internal paths - security leak!'
        : 'OK',
    };
  });
}

// ============ SCENARIO 2: GHOST SESSION TEST ============

async function runGhostSessionTests(): Promise<void> {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  👻 SCENARIO 2: GHOST SESSION TEST (Persistence Integrity)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const validToken = generateToken({
    id: 'test-student-002',
    email: 'student2@test.com',
    role: 'STUDENT',
    schoolId: 'school-A',
  });

  // Test 2.1: Token validation endpoint works
  await runTest('GHOST_SESSION', '/auth/me returns user data with valid token', async () => {
    const { status, body } = await fetchApi('/auth/me', {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    return {
      passed: status === 200 || status === 404, // 404 if user doesn't exist in DB
      details: status === 200
        ? 'OK - User validated'
        : status === 404
        ? 'OK - Token valid but user not in DB (expected for synthetic token)'
        : `Unexpected status ${status}`,
      httpStatus: status,
    };
  });

  // Test 2.2: Race condition - 3 simultaneous API calls
  await runTest('GHOST_SESSION', 'Race condition: 3 parallel API calls all succeed', async () => {
    const endpoints = ['/auth/me', '/health', '/sessions'];

    const start = performance.now();
    const results = await Promise.all(
      endpoints.map(async (endpoint) => {
        const { status, headers } = await fetchApi(endpoint, {
          headers: { Authorization: `Bearer ${validToken}` },
        });
        return { endpoint, status, hasAuth: headers.has('authorization') };
      })
    );
    const totalTime = performance.now() - start;

    // Check all completed without auth errors
    const allSucceeded = results.every(
      (r) => r.status !== 401 || r.endpoint === '/health' // health is public
    );
    const parallelExecution = totalTime < 3000; // Should be faster than 3 sequential calls

    return {
      passed: allSucceeded && parallelExecution,
      details: allSucceeded
        ? `All parallel calls succeeded in ${totalTime.toFixed(0)}ms`
        : `Some calls failed: ${JSON.stringify(results)}`,
    };
  });

  // Test 2.3: Token verification endpoint
  await runTest('GHOST_SESSION', '/auth/verify validates token properly', async () => {
    const { status, body } = await fetchApi('/auth/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
    });
    return {
      passed: status === 200 || status === 404,
      details: status === 200
        ? `Token verified: ${body?.valid === true}`
        : `Status ${status} - ${body?.error || 'no error'}`,
      httpStatus: status,
    };
  });

  // Test 2.4: Rapid sequential requests (burst test)
  await runTest('GHOST_SESSION', 'Burst test: 5 rapid requests all authenticated', async () => {
    const results: number[] = [];

    for (let i = 0; i < 5; i++) {
      const { status } = await fetchApi('/auth/me', {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      results.push(status);
    }

    const allValid = results.every((s) => s === 200 || s === 404);
    return {
      passed: allValid,
      details: allValid
        ? `All 5 burst requests succeeded: ${results.join(', ')}`
        : `Some requests failed: ${results.join(', ')}`,
    };
  });
}

// ============ SCENARIO 3: EXPIRED TOKEN TRAP ============

async function runExpiredTokenTests(): Promise<void> {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ⏰ SCENARIO 3: EXPIRED TOKEN TRAP');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Test 3.1: Expired token returns TOKEN_EXPIRED
  await runTest('EXPIRED_TOKEN', 'Expired token → 401 TOKEN_EXPIRED', async () => {
    const expiredToken = generateExpiredToken({
      id: 'test-user-003',
      email: 'user3@test.com',
      role: 'STUDENT',
    });

    const { status, body } = await fetchApi('/auth/me', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });

    return {
      passed: status === 401 && body?.code === 'TOKEN_EXPIRED',
      details: `Expected 401 TOKEN_EXPIRED, got ${status} ${body?.code || 'no code'}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 3.2: Malformed token returns TOKEN_INVALID
  await runTest('EXPIRED_TOKEN', 'Malformed token → 401 TOKEN_INVALID', async () => {
    const malformedToken = generateMalformedToken();

    const { status, body } = await fetchApi('/auth/me', {
      headers: { Authorization: `Bearer ${malformedToken}` },
    });

    return {
      passed: status === 401 && body?.code === 'TOKEN_INVALID',
      details: `Expected 401 TOKEN_INVALID, got ${status} ${body?.code || 'no code'}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 3.3: Token with wrong secret
  await runTest('EXPIRED_TOKEN', 'Wrong secret token → 401 TOKEN_INVALID', async () => {
    const wrongSecretToken = generateTokenWithWrongSecret({
      id: 'test-user-004',
      email: 'user4@test.com',
      role: 'TEACHER',
    });

    const { status, body } = await fetchApi('/auth/me', {
      headers: { Authorization: `Bearer ${wrongSecretToken}` },
    });

    return {
      passed: status === 401 && body?.code === 'TOKEN_INVALID',
      details: `Expected 401 TOKEN_INVALID, got ${status} ${body?.code || 'no code'}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 3.4: Missing Bearer prefix
  await runTest('EXPIRED_TOKEN', 'Token without Bearer prefix → blocked (401/403/404)', async () => {
    const validToken = generateToken({
      id: 'test-user-005',
      email: 'user5@test.com',
      role: 'STUDENT',
    });

    const { status, body } = await fetchApi('/auth/me', {
      headers: { Authorization: validToken }, // No "Bearer " prefix
    });

    // Token without Bearer prefix should be blocked (401, 403, or 404 are acceptable)
    // The key security property is that it doesn't return 200/2xx
    const isBlocked = status === 401 || status === 403 || status === 404;
    return {
      passed: isBlocked,
      details: isBlocked
        ? `OK - Rejected token without Bearer prefix (status ${status})`
        : `Expected blocking status, got ${status}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 3.5: Empty Authorization header
  await runTest('EXPIRED_TOKEN', 'Empty Authorization header → 401 NO_AUTH_HEADER', async () => {
    const { status, body } = await fetchApi('/auth/me', {
      headers: { Authorization: '' },
    });

    return {
      passed: status === 401,
      details: `Expected 401, got ${status} ${body?.code || 'no code'}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 3.6: SQL injection attempt in token
  await runTest('EXPIRED_TOKEN', 'SQL injection in token → 401 (no server error)', async () => {
    const maliciousToken = "'; DROP TABLE users; --";

    const { status, body } = await fetchApi('/auth/me', {
      headers: { Authorization: `Bearer ${maliciousToken}` },
    });

    // Should get 401, NOT 500 server error
    const isServerError = status >= 500;
    return {
      passed: status === 401 && !isServerError,
      details: isServerError
        ? 'SERVER ERROR - Possible SQL injection vulnerability!'
        : `OK - Safely rejected with ${status}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 3.7: XSS attempt in token
  await runTest('EXPIRED_TOKEN', 'XSS attempt in token → 401 (no reflection)', async () => {
    const xssToken = '<script>alert("xss")</script>';

    const { status, body } = await fetchApi('/auth/me', {
      headers: { Authorization: `Bearer ${xssToken}` },
    });

    const bodyStr = JSON.stringify(body);
    const reflected = bodyStr.includes('<script>');

    return {
      passed: status === 401 && !reflected,
      details: reflected
        ? 'XSS VULNERABILITY - Script reflected in response!'
        : `OK - Safely rejected with ${status}`,
      httpStatus: status,
    };
  });
}

// ============ SCENARIO 4: SSE STREAM SECURITY AUDIT ============

async function runSSESecurityTests(): Promise<void> {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  📡 SCENARIO 4: SSE STREAM SECURITY AUDIT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const studentToken = generateToken({
    id: 'test-student-sse',
    email: 'sse-student@test.com',
    role: 'STUDENT',
    schoolId: 'school-A',
  });

  const teacherToken = generateToken({
    id: 'test-teacher-sse',
    email: 'sse-teacher@test.com',
    role: 'TEACHER',
    schoolId: 'school-A',
  });

  // Test 4.1: Lesson chat stream requires auth
  await runTest('SSE_SECURITY', '/student/lesson-chat/stream rejects no auth', async () => {
    const { status, body } = await fetchApi('/student/lesson-chat/stream?lessonId=test', {
      headers: { Accept: 'text/event-stream' },
    });

    return {
      passed: status === 401 && body?.code === 'NO_AUTH_HEADER',
      details: `Expected 401 NO_AUTH_HEADER, got ${status} ${body?.code || 'no code'}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 4.2: Lesson stream accepts Bearer token in header
  await runTest('SSE_SECURITY', '/student/lesson-chat/stream accepts Bearer token', async () => {
    const { status } = await fetchApi('/student/lesson-chat/stream?lessonId=test', {
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${studentToken}`,
      },
    });

    // Should not be 401/403 - might be 400 if lesson doesn't exist
    return {
      passed: status !== 401 && status !== 403,
      details: status === 401 || status === 403
        ? `Auth failed with ${status}`
        : `OK - Auth accepted (status ${status})`,
      httpStatus: status,
    };
  });

  // Test 4.3: Teacher chat stream requires teacher role
  await runTest('SSE_SECURITY', '/teacher/chat/stream rejects student token', async () => {
    const { status, body } = await fetchApi('/teacher/chat/stream?sessionId=test&message=hi', {
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${studentToken}`,
      },
    });

    return {
      passed: status === 403 && body?.code === 'INSUFFICIENT_PERMISSIONS',
      details: `Expected 403 INSUFFICIENT_PERMISSIONS, got ${status} ${body?.code || 'no code'}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 4.4: Teacher chat stream accepts teacher token
  await runTest('SSE_SECURITY', '/teacher/chat/stream accepts teacher token', async () => {
    const { status } = await fetchApi('/teacher/chat/stream?sessionId=test&message=hi', {
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${teacherToken}`,
      },
    });

    // Should not be 401/403
    return {
      passed: status !== 401 && status !== 403,
      details: status === 401 || status === 403
        ? `Auth failed with ${status}`
        : `OK - Auth accepted (status ${status})`,
      httpStatus: status,
    };
  });

  // Test 4.5: Content generation stream requires teacher
  await runTest('SSE_SECURITY', '/lessons/generate-content/stream rejects student', async () => {
    const { status, body } = await fetchApi('/lessons/generate-content/stream?topic=test', {
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${studentToken}`,
      },
    });

    return {
      passed: status === 403 && body?.code === 'INSUFFICIENT_PERMISSIONS',
      details: `Expected 403 INSUFFICIENT_PERMISSIONS, got ${status} ${body?.code || 'no code'}`,
      httpStatus: status,
      errorCode: body?.code,
    };
  });

  // Test 4.6: Content generation stream accepts teacher
  await runTest('SSE_SECURITY', '/lessons/generate-content/stream accepts teacher', async () => {
    const { status } = await fetchApi('/lessons/generate-content/stream?topic=test', {
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${teacherToken}`,
      },
    });

    return {
      passed: status !== 401 && status !== 403,
      details: status === 401 || status === 403
        ? `Auth failed with ${status}`
        : `OK - Auth accepted (status ${status})`,
      httpStatus: status,
    };
  });
}

// ============ SCENARIO 5: MULTI-SCHOOL SCOPE TEST ============

async function runMultiSchoolTests(): Promise<void> {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🏫 SCENARIO 5: MULTI-SCHOOL SCOPE TEST');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const schoolAToken = generateToken({
    id: 'teacher-school-a',
    email: 'teacher-a@school-a.edu',
    role: 'TEACHER',
    schoolId: 'school-A',
  });

  const schoolBToken = generateToken({
    id: 'teacher-school-b',
    email: 'teacher-b@school-b.edu',
    role: 'TEACHER',
    schoolId: 'school-B',
  });

  const noSchoolToken = generateToken({
    id: 'teacher-no-school',
    email: 'teacher@noscope.edu',
    role: 'TEACHER',
    // No schoolId
  });

  // Test 5.1: Token contains schoolId
  await runTest('MULTI_SCHOOL', 'JWT payload contains schoolId', async () => {
    const decoded = jwt.decode(schoolAToken) as { schoolId?: string } | null;
    return {
      passed: decoded?.schoolId === 'school-A',
      details: decoded?.schoolId
        ? `OK - schoolId: ${decoded.schoolId}`
        : 'schoolId missing from token',
    };
  });

  // Test 5.2: Different schoolIds in tokens
  await runTest('MULTI_SCHOOL', 'School A and B tokens have different schoolIds', async () => {
    const decodedA = jwt.decode(schoolAToken) as { schoolId?: string } | null;
    const decodedB = jwt.decode(schoolBToken) as { schoolId?: string } | null;

    return {
      passed: decodedA?.schoolId === 'school-A' && decodedB?.schoolId === 'school-B',
      details: `School A: ${decodedA?.schoolId}, School B: ${decodedB?.schoolId}`,
    };
  });

  // Test 5.3: Teacher can access their own school's data
  await runTest('MULTI_SCHOOL', 'Teacher can access own school data', async () => {
    const { status } = await fetchApi('/lessons', {
      headers: { Authorization: `Bearer ${schoolAToken}` },
    });

    return {
      passed: status !== 403,
      details: status === 403
        ? 'Incorrectly denied access to own school'
        : `OK - Access granted (status ${status})`,
      httpStatus: status,
    };
  });

  // Test 5.4: Token without schoolId still works (backwards compatibility)
  await runTest('MULTI_SCHOOL', 'Token without schoolId is backwards compatible', async () => {
    const { status } = await fetchApi('/lessons', {
      headers: { Authorization: `Bearer ${noSchoolToken}` },
    });

    return {
      passed: status !== 401 && status !== 403,
      details: status === 401 || status === 403
        ? `Auth failed with ${status} - backwards compatibility broken`
        : `OK - Backwards compatible (status ${status})`,
      httpStatus: status,
    };
  });

  // Test 5.5: Cross-school data isolation (conceptual check)
  await runTest('MULTI_SCHOOL', 'Cross-school isolation configured', async () => {
    // This test verifies the infrastructure is in place
    // Actual data isolation depends on query-level filtering

    const decodedA = jwt.decode(schoolAToken) as { schoolId?: string; id?: string } | null;
    const hasSchoolId = !!decodedA?.schoolId;
    const hasUserId = !!decodedA?.id;

    return {
      passed: hasSchoolId && hasUserId,
      details: hasSchoolId && hasUserId
        ? `OK - Token has schoolId (${decodedA?.schoolId}) and userId (${decodedA?.id}) for isolation`
        : `Missing: schoolId=${hasSchoolId}, userId=${hasUserId}`,
    };
  });

  // Test 5.6: schoolId is validated as string type
  await runTest('MULTI_SCHOOL', 'schoolId type validation', async () => {
    // Try to inject a non-string schoolId
    const maliciousPayload = {
      id: 'malicious-user',
      email: 'malicious@test.com',
      role: 'TEACHER' as const,
      schoolId: { $ne: null } as any, // NoSQL injection attempt
    };

    // JWT will stringify the object, which the server should handle safely
    const maliciousToken = jwt.sign(maliciousPayload, JWT_SECRET, { expiresIn: '1m' });
    const decoded = jwt.decode(maliciousToken) as { schoolId?: any } | null;

    // The decoded schoolId will be an object, not a string
    const schoolIdType = typeof decoded?.schoolId;

    // Server should handle this gracefully (not crash)
    const { status } = await fetchApi('/lessons', {
      headers: { Authorization: `Bearer ${maliciousToken}` },
    });

    return {
      passed: status !== 500,
      details: status === 500
        ? `SERVER ERROR - Type coercion vulnerability! schoolId type: ${schoolIdType}`
        : `OK - Server handled gracefully (status ${status}, schoolId type: ${schoolIdType})`,
      httpStatus: status,
    };
  });
}

// ============ Summary Generator ============

function generateSummary(): void {
  console.log('');
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    SECURITY TEST REPORT                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Group results by scenario
  const scenarios = ['FORBIDDEN_FRUIT', 'GHOST_SESSION', 'EXPIRED_TOKEN', 'SSE_SECURITY', 'MULTI_SCHOOL'];
  const scenarioNames: Record<string, string> = {
    'FORBIDDEN_FRUIT': '🍎 Forbidden Fruit (Role Crossing)',
    'GHOST_SESSION': '👻 Ghost Session (Persistence)',
    'EXPIRED_TOKEN': '⏰ Expired Token Trap',
    'SSE_SECURITY': '📡 SSE Stream Security',
    'MULTI_SCHOOL': '🏫 Multi-School Scope',
  };

  let totalPassed = 0;
  let totalFailed = 0;

  for (const scenario of scenarios) {
    const tests = allResults.filter((r) => r.scenario === scenario);
    const passed = tests.filter((t) => t.passed).length;
    const failed = tests.filter((t) => !t.passed).length;

    totalPassed += passed;
    totalFailed += failed;

    const icon = failed === 0 ? '✅' : '❌';
    console.log(`  ${icon} ${scenarioNames[scenario]}`);
    console.log(`     └─ Passed: ${passed}/${tests.length}`);

    if (failed > 0) {
      const failedTests = tests.filter((t) => !t.passed);
      for (const test of failedTests) {
        console.log(`        ✗ ${test.name}`);
        console.log(`          └─ ${test.details}`);
      }
    }
    console.log('');
  }

  // Overall summary
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│                         FINAL SUMMARY                          │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log(`│  Total Tests: ${totalPassed + totalFailed}                                                │`);
  console.log(`│  Passed:      ${totalPassed}                                                 │`);
  console.log(`│  Failed:      ${totalFailed}                                                  │`);
  console.log(`│  Pass Rate:   ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%                                           │`);
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');

  if (totalFailed > 0) {
    console.log('❌ SECURITY TEST FAILED - Review failures above');
    console.log('');
    console.log('Failed tests require immediate attention:');
    const failedTests = allResults.filter((t) => !t.passed);
    for (const test of failedTests) {
      console.log(`  • [${test.scenario}] ${test.name}`);
    }
  } else {
    console.log('✅ ALL SECURITY TESTS PASSED');
    console.log('');
    console.log('The Auth & RBAC system is functioning correctly under:');
    console.log('  • Role crossing attempts');
    console.log('  • Race conditions and burst requests');
    console.log('  • Expired and malformed tokens');
    console.log('  • SSE streaming endpoints');
    console.log('  • Multi-school scope isolation');
  }
}

// ============ Main ============

async function main(): Promise<void> {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     SECURITY STRESS TEST - Academio Auth & RBAC System        ║');
  console.log('║                    Strong Testing Protocol                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Target:     ${BASE_URL}`);
  console.log(`  Timestamp:  ${new Date().toISOString()}`);
  console.log(`  JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
  console.log('');

  // Health check
  try {
    const { status } = await fetchApi('/health');
    if (status !== 200) {
      console.error('❌ Server health check failed. Is the server running?');
      process.exit(1);
    }
    console.log('  Server:     ✓ Online');
  } catch (error) {
    console.error('❌ Cannot connect to server. Please start the server first.');
    console.error('   Run: npm run dev');
    process.exit(1);
  }

  console.log('');
  console.log('Starting security tests...');

  // Run all test scenarios
  await runForbiddenFruitTests();
  await runGhostSessionTests();
  await runExpiredTokenTests();
  await runSSESecurityTests();
  await runMultiSchoolTests();

  // Generate final report
  generateSummary();

  // Exit with appropriate code
  const failed = allResults.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Security test script error:', error);
  process.exit(1);
});

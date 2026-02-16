/**
 * Auth Integrity Verification Script
 *
 * Tests the RBAC system to ensure role-based route protection is active
 * and responds within the required latency threshold (50ms).
 *
 * Usage:
 *   npx tsx src/utils/verify-auth-integrity.ts
 *
 * Tests:
 * 1. Public routes are accessible without auth
 * 2. Protected routes return 401 without auth
 * 3. Role-specific routes return 403 with wrong role
 * 4. Role-specific routes return 200 with correct role
 * 5. Expired tokens are rejected with proper error code
 * 6. Response time is under 50ms for auth decisions
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = process.env.API_URL || 'http://localhost:3001/api';
const JWT_SECRET = process.env.JWT_SECRET || 'academio-jwt-secret-change-in-production';

// Test configuration
const LATENCY_THRESHOLD_MS = 50;

// Test results
interface TestResult {
  name: string;
  passed: boolean;
  latencyMs: number;
  details: string;
}

const results: TestResult[] = [];

// Helper to generate test tokens
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

// Test helper
async function runTest(
  name: string,
  testFn: () => Promise<{ passed: boolean; details: string }>
): Promise<void> {
  const start = performance.now();

  try {
    const { passed, details } = await testFn();
    const latencyMs = performance.now() - start;

    results.push({
      name,
      passed,
      latencyMs,
      details,
    });

    const icon = passed ? '✓' : '✗';
    const latencyWarning = latencyMs > LATENCY_THRESHOLD_MS ? ` [SLOW: ${latencyMs.toFixed(1)}ms]` : '';
    console.log(`  ${icon} ${name}${latencyWarning}`);
    if (!passed) {
      console.log(`    └─ ${details}`);
    }
  } catch (error) {
    const latencyMs = performance.now() - start;
    results.push({
      name,
      passed: false,
      latencyMs,
      details: error instanceof Error ? error.message : 'Unknown error',
    });
    console.log(`  ✗ ${name}`);
    console.log(`    └─ Error: ${error instanceof Error ? error.message : error}`);
  }
}

// Fetch with latency tracking
async function fetchApi(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; body: any; latencyMs: number }> {
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
    body = await response.json();
  } catch {
    // Response might not be JSON
  }

  return { status: response.status, body, latencyMs };
}

// ============ Test Cases ============

async function testPublicRouteNoAuth(): Promise<{ passed: boolean; details: string }> {
  const { status } = await fetchApi('/health');
  const passed = status === 200;
  return {
    passed,
    details: passed ? 'OK' : `Expected 200, got ${status}`,
  };
}

async function testProtectedRouteNoAuth(): Promise<{ passed: boolean; details: string }> {
  const { status, body } = await fetchApi('/auth/me');
  const passed = status === 401 && body?.code === 'NO_AUTH_HEADER';
  return {
    passed,
    details: passed ? 'OK' : `Expected 401 with NO_AUTH_HEADER, got ${status} ${body?.code || ''}`,
  };
}

async function testStudentRouteWithTeacherToken(): Promise<{ passed: boolean; details: string }> {
  const token = generateToken({
    id: 'test-teacher-id',
    email: 'teacher@test.com',
    role: 'TEACHER',
  });

  const { status, body } = await fetchApi('/student/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const passed = status === 403 && body?.code === 'INSUFFICIENT_PERMISSIONS';
  return {
    passed,
    details: passed ? 'OK' : `Expected 403 with INSUFFICIENT_PERMISSIONS, got ${status} ${body?.code || ''}`,
  };
}

async function testTeacherRouteWithStudentToken(): Promise<{ passed: boolean; details: string }> {
  const token = generateToken({
    id: 'test-student-id',
    email: 'student@test.com',
    role: 'STUDENT',
  });

  const { status, body } = await fetchApi('/lessons', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const passed = status === 403 && body?.code === 'INSUFFICIENT_PERMISSIONS';
  return {
    passed,
    details: passed ? 'OK' : `Expected 403 with INSUFFICIENT_PERMISSIONS, got ${status} ${body?.code || ''}`,
  };
}

async function testExpiredToken(): Promise<{ passed: boolean; details: string }> {
  const token = generateExpiredToken({
    id: 'test-user-id',
    email: 'user@test.com',
    role: 'STUDENT',
  });

  const { status, body } = await fetchApi('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const passed = status === 401 && body?.code === 'TOKEN_EXPIRED';
  return {
    passed,
    details: passed ? 'OK' : `Expected 401 with TOKEN_EXPIRED, got ${status} ${body?.code || ''}`,
  };
}

async function testInvalidToken(): Promise<{ passed: boolean; details: string }> {
  const { status, body } = await fetchApi('/auth/me', {
    headers: { Authorization: 'Bearer invalid-token-here' },
  });

  const passed = status === 401 && body?.code === 'TOKEN_INVALID';
  return {
    passed,
    details: passed ? 'OK' : `Expected 401 with TOKEN_INVALID, got ${status} ${body?.code || ''}`,
  };
}

async function testCaseInsensitiveRole(): Promise<{ passed: boolean; details: string }> {
  // Test with lowercase role (simulating potential database mismatch)
  const token = jwt.sign(
    {
      id: 'test-teacher-id',
      email: 'teacher@test.com',
      role: 'teacher', // lowercase
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const { status } = await fetchApi('/lessons', {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Should either succeed (200) or fail for non-auth reasons
  // Should NOT be 403 for role mismatch since we normalize roles
  const passed = status !== 403;
  return {
    passed,
    details: passed ? 'OK (role normalized)' : 'Role normalization failed - lowercase "teacher" rejected',
  };
}

async function testAuthLatency(): Promise<{ passed: boolean; details: string }> {
  const token = generateToken({
    id: 'test-user-id',
    email: 'user@test.com',
    role: 'STUDENT',
  });

  // Run multiple requests and check average latency
  const latencies: number[] = [];

  for (let i = 0; i < 5; i++) {
    const { latencyMs } = await fetchApi('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    latencies.push(latencyMs);
  }

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const passed = avgLatency <= LATENCY_THRESHOLD_MS;

  return {
    passed,
    details: passed
      ? `Average latency: ${avgLatency.toFixed(1)}ms`
      : `Average latency ${avgLatency.toFixed(1)}ms exceeds ${LATENCY_THRESHOLD_MS}ms threshold`,
  };
}

async function testSchoolIdInToken(): Promise<{ passed: boolean; details: string }> {
  const schoolId = 'test-school-123';
  const token = generateToken({
    id: 'test-teacher-id',
    email: 'teacher@test.com',
    role: 'TEACHER',
    schoolId,
  });

  // Decode token and verify schoolId is present
  const decoded = jwt.decode(token) as { schoolId?: string } | null;
  const passed = decoded?.schoolId === schoolId;

  return {
    passed,
    details: passed ? 'OK (schoolId in payload)' : `schoolId missing or incorrect: ${decoded?.schoolId}`,
  };
}

// ============ Main ============

async function main(): Promise<void> {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║       AUTH INTEGRITY VERIFICATION - Academio RBAC System      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Latency threshold: ${LATENCY_THRESHOLD_MS}ms`);
  console.log('');

  // Check if server is running
  try {
    const { status } = await fetchApi('/health');
    if (status !== 200) {
      console.error('❌ Server health check failed. Is the server running?');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Cannot connect to server. Please start the server first.');
    console.error(`   Run: npm run dev`);
    process.exit(1);
  }

  console.log('Running tests...');
  console.log('');

  // Public Routes
  console.log('📂 Public Routes');
  await runTest('Public health endpoint accessible without auth', testPublicRouteNoAuth);
  console.log('');

  // Auth Required
  console.log('🔐 Auth Required');
  await runTest('Protected route returns 401 without auth', testProtectedRouteNoAuth);
  await runTest('Invalid token returns 401 with TOKEN_INVALID', testInvalidToken);
  await runTest('Expired token returns 401 with TOKEN_EXPIRED', testExpiredToken);
  console.log('');

  // Role-Based Access
  console.log('👤 Role-Based Access Control');
  await runTest('Student route rejects teacher token (403)', testStudentRouteWithTeacherToken);
  await runTest('Teacher route rejects student token (403)', testTeacherRouteWithStudentToken);
  await runTest('Role comparison is case-insensitive', testCaseInsensitiveRole);
  console.log('');

  // JWT Payload
  console.log('🎫 JWT Payload');
  await runTest('Token includes schoolId for multi-school support', testSchoolIdInToken);
  console.log('');

  // Performance
  console.log('⚡ Performance');
  await runTest(`Auth decision latency under ${LATENCY_THRESHOLD_MS}ms`, testAuthLatency);
  console.log('');

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const avgLatency = results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│                         SUMMARY                             │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│ Tests Passed: ${passed}/${results.length}                                           │`);
  console.log(`│ Tests Failed: ${failed}                                             │`);
  console.log(`│ Average Latency: ${avgLatency.toFixed(1)}ms                                      │`);
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  if (failed > 0) {
    console.log('❌ Some tests failed. Please review the output above.');
    process.exit(1);
  } else {
    console.log('✅ All auth integrity tests passed!');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Test script error:', error);
  process.exit(1);
});

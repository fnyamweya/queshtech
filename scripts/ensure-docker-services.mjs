import { spawnSync } from 'node:child_process';

const SERVICES = ['db', 'redis', 'pgadmin', 'redisinsight'];
const TIMEOUT_MS = Number(process.env.DOCKER_WAIT_TIMEOUT_MS ?? 90_000);
const INTERVAL_MS = Number(process.env.DOCKER_WAIT_INTERVAL_MS ?? 2_000);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.error) {
    const err = new Error(`Failed to run ${command}: ${result.error.message}`);
    err.cause = result.error;
    throw err;
  }

  return {
    code: result.status ?? 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function runOk(command, args) {
  try {
    const res = run(command, args);
    return res.code === 0;
  } catch {
    return false;
  }
}

function pickComposeCommand() {
  if (runOk('docker', ['compose', 'version'])) {
    return { command: 'docker', argsPrefix: ['compose'] };
  }
  if (runOk('docker-compose', ['version'])) {
    return { command: 'docker-compose', argsPrefix: [] };
  }
  return null;
}

function fatal(message) {
  console.error(`\n[predev] ${message}\n`);
  process.exit(1);
}

function info(message) {
  console.log(`[predev] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServiceHealthy(service, compose) {
  const idRes = run(compose.command, [...compose.argsPrefix, 'ps', '-q', service]);
  const containerId = idRes.stdout.trim();
  if (!containerId) {
    fatal(`Could not find container for service '${service}'. Is docker compose running in this folder?`);
  }

  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    const statusRes = run('docker', [
      'inspect',
      '-f',
      '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}',
      containerId,
    ]);
    const status = statusRes.stdout.trim();

    if (status === 'healthy' || status === 'running') {
      return;
    }

    await sleep(INTERVAL_MS);
  }

  fatal(`Timed out waiting for '${service}' to become healthy (timeout ${TIMEOUT_MS}ms).`);
}

async function main() {
  if (process.env.SKIP_DOCKER === '1' || process.env.SKIP_DOCKER === 'true') {
    info('Skipping docker preflight (SKIP_DOCKER is set).');
    return;
  }

  if (!runOk('docker', ['version'])) {
    fatal(
      'Docker is not available (cannot run `docker version`). Start Docker Desktop / Engine, or run with SKIP_DOCKER=1.',
    );
  }

  const compose = pickComposeCommand();
  if (!compose) {
    fatal(
      'Docker Compose is not available. Install Compose v2 (`docker compose`) or v1 (`docker-compose`).',
    );
  }

  info(`Starting dev services via docker compose: ${SERVICES.join(', ')}`);
  const upRes = run(compose.command, [...compose.argsPrefix, 'up', '-d', ...SERVICES]);
  if (upRes.code !== 0) {
    console.error(upRes.stdout);
    console.error(upRes.stderr);
    fatal('Failed to start docker compose services.');
  }

  for (const svc of SERVICES) {
    info(`Waiting for ${svc} to be ready...`);
    await waitForServiceHealthy(svc, compose);
  }

  info('Docker dev services are ready.');
}

main().catch((err) => {
  fatal(err?.message ?? String(err));
});

// Local development server: the whole authoritative stack in one process with
// in-memory persistence, fake sign-in and an in-process job runner.
// Usage: pnpm --filter @footebas/api dev  (PORT defaults to 8787)
import {
  FakeBearerAuth,
  FootebasApplication,
  InMemoryArchiveStorage,
  InMemoryJobQueue,
  InMemoryStorage,
  Mulberry32RandomFactory,
  NoopTelemetry,
  PhaseFourApplicationService,
  SequentialIdGenerator,
  UnifiedPhaseFourRepository,
} from '@footebas/application';
import { InMemoryUnitOfWork, SystemClock } from '@footebas/database';
import { buildApi } from './index.js';
import { withSmokeAuth } from './smoke-auth.js';

const clock = new SystemClock();
const auth = new FakeBearerAuth();
const ids = new SequentialIdGenerator();
const jobs = new InMemoryJobQueue();
const unitOfWork = new InMemoryUnitOfWork(clock);
// SMOKE_TOKEN (optional) lets tools/cloud-smoke run locally with the same
// `smoke:<token>` bearer used against the cloud.
const appAuth = withSmokeAuth(auth, process.env.SMOKE_TOKEN);
const application = new FootebasApplication({
  auth: appAuth,
  clock,
  ids,
  jobs,
  storage: new InMemoryStorage(),
  telemetry: new NoopTelemetry(),
  unitOfWork,
});
const phaseFour = new PhaseFourApplicationService({
  repository: new UnifiedPhaseFourRepository(unitOfWork),
  archives: new InMemoryArchiveStorage(),
  clock,
  ids,
  random: new Mulberry32RandomFactory(),
});

const api = await buildApi({
  application,
  jobs,
  phaseFour: { application: phaseFour, auth: appAuth },
  devAuth: auth,
  health: { version: 'dev' },
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
});

let running = false;
setInterval(() => {
  if (running) return;
  running = true;
  void (async () => {
    try {
      while ((await application.runNextJob()) !== undefined);
    } finally {
      running = false;
    }
  })();
}, 150);

const port = Number(process.env.PORT ?? 8787);
await api.listen({ port, host: '127.0.0.1' });
console.log(`Footebas API em http://127.0.0.1:${String(port)}`);

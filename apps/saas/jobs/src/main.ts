// dropicture/apps/saas/jobs/src/main.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function App() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
}

void App();
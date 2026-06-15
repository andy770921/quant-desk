import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { setupSwaggerCdn } from '../src/common/swagger-cdn';

let app: NestExpressApplication;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.enableCors({
      origin: true,
      credentials: true,
    });

    // Swagger configuration (identical to main.ts)
    const config = new DocumentBuilder()
      .setTitle('Quant Strategies API')
      .setDescription('美股量化交易策略平台 — 市場資料、策略與回測 API')
      .setVersion('1.0')
      .addTag('api', 'Core API endpoints')
      .addTag('market', 'US market data')
      .addTag('strategies', 'Quant strategies')
      .addTag('backtest', 'Strategy backtesting')
      .addTag('signals', 'Live buy/sell signals')
      .addTag('notifications', '[future] trade alerts')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    setupSwaggerCdn(app, document);

    await app.init();
  }
  return app;
}

export default async function handler(req: Request, res: Response) {
  const app = await bootstrap();
  const expressApp = app.getHttpAdapter().getInstance();
  return expressApp(req, res);
}

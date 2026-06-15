import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { setupSwaggerCdn } from './common/swagger-cdn';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger configuration
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

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger UI available at: http://localhost:${port}/`);
  console.log(`OpenAPI JSON at: http://localhost:${port}/api-json`);
}
bootstrap();

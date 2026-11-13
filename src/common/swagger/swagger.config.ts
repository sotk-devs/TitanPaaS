import { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  OpenAPIObject,
  SwaggerCustomOptions,
  SwaggerModule,
} from '@nestjs/swagger';

export const SWAGGER_TAGS: ReadonlyArray<{
  name: string;
  description: string;
}> = [
  {
    name: 'System',
    description: 'Estado general y healthcheck de la API',
  },
  {
    name: 'Auth',
    description: 'Registro, inicio de sesión y perfil del usuario autenticado',
  },
  {
    name: 'API Keys',
    description:
      'Generación, revocación y gestión de tokens API con scopes granulares',
  },
  {
    name: 'Projects',
    description:
      'Gestión de proyectos, variables de entorno y ciclo de vida de contenedores',
  },
  {
    name: 'Deployments',
    description:
      'Disparar despliegues, consultar historial, cancelar, rollback y descarga de logs',
  },
  {
    name: 'Domains',
    description: 'Dominios personalizados y verificación DNS',
  },
  {
    name: 'Databases',
    description:
      'Bases de datos administradas bajo demanda (PostgreSQL, MySQL, Redis)',
  },
  {
    name: 'Database Backups',
    description: 'Respaldos manuales, programación cron y restauración 1-click',
  },
  {
    name: 'Volumes',
    description: 'Volúmenes persistentes Docker asociados a proyectos',
  },
  {
    name: 'Metrics',
    description:
      'Métricas en tiempo real de CPU, memoria, red y disco de contenedores',
  },
  {
    name: 'Notifications',
    description:
      'Webhooks de notificación para eventos de despliegue (Slack, Discord, HTTP)',
  },
  {
    name: 'Maintenance',
    description:
      'Garbage collection y limpieza de recursos Docker y workspaces',
  },
  {
    name: 'Webhooks',
    description: 'Recepción de webhooks de GitHub (ping y push)',
  },
];

export function createSwaggerConfig() {
  const builder = new DocumentBuilder()
    .setTitle('TitanPaaS API')
    .setDescription(
      [
        'Documentación OpenAPI interactiva completa de la plataforma **TitanPaaS**.',
        '',
        '### Autenticación',
        '- Obtén un token JWT mediante `POST /auth/login` o `POST /auth/register`.',
        '- Haz clic en **Authorize** e ingresa el token para probar los endpoints protegidos.',
        '',
        '### Especificación',
        '- JSON: `/docs/json`',
        '- YAML: `/docs/yaml`',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT obtenido desde /auth/login o /auth/register',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'API Key de acceso programático (prefijo tp_live_...)',
      },
      'api-key',
    );

  for (const tag of SWAGGER_TAGS) {
    builder.addTag(tag.name, tag.description);
  }

  return builder.build();
}

export function setupSwagger(app: INestApplication): OpenAPIObject {
  const document = SwaggerModule.createDocument(app, createSwaggerConfig());

  const customOptions: SwaggerCustomOptions = {
    customSiteTitle: 'TitanPaaS API Docs',
    jsonDocumentUrl: 'docs/json',
    yamlDocumentUrl: 'docs/yaml',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      docExpansion: 'none',
      tagsSorter: 'alpha',
    },
  };

  SwaggerModule.setup('docs', app, document, customOptions);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'TitanPaaS API Docs',
    swaggerOptions: customOptions.swaggerOptions,
  });

  return document;
}

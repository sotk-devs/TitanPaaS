export enum ApiKeyScope {
  PROJECTS_READ = 'projects:read',
  PROJECTS_WRITE = 'projects:write',
  DEPLOYMENTS_READ = 'deployments:read',
  DEPLOYMENTS_WRITE = 'deployments:write',
  ENV_READ = 'env:read',
  ENV_WRITE = 'env:write',
  DATABASES_READ = 'databases:read',
  DATABASES_WRITE = 'databases:write',
  VOLUMES_READ = 'volumes:read',
  VOLUMES_WRITE = 'volumes:write',
  DOMAINS_READ = 'domains:read',
  DOMAINS_WRITE = 'domains:write',
  NOTIFICATIONS_READ = 'notifications:read',
  NOTIFICATIONS_WRITE = 'notifications:write',
  MAINTENANCE_READ = 'maintenance:read',
  MAINTENANCE_WRITE = 'maintenance:write',
  METRICS_READ = 'metrics:read',
  API_KEYS_MANAGE = 'api-keys:manage',
  FULL_ACCESS = '*',
}

export const API_KEY_SCOPE_DESCRIPTIONS: Record<ApiKeyScope, string> = {
  [ApiKeyScope.PROJECTS_READ]: 'Consultar proyectos y su configuración',
  [ApiKeyScope.PROJECTS_WRITE]:
    'Crear, modificar, eliminar y controlar contenedores de proyectos',
  [ApiKeyScope.DEPLOYMENTS_READ]: 'Consultar historial y logs de despliegues',
  [ApiKeyScope.DEPLOYMENTS_WRITE]:
    'Disparar, cancelar y hacer rollback de despliegues',
  [ApiKeyScope.ENV_READ]: 'Exportar variables de entorno de proyectos',
  [ApiKeyScope.ENV_WRITE]: 'Importar y modificar variables de entorno',
  [ApiKeyScope.DATABASES_READ]: 'Consultar bases de datos y respaldos',
  [ApiKeyScope.DATABASES_WRITE]:
    'Aprovisionar, eliminar, respaldar y restaurar bases de datos',
  [ApiKeyScope.VOLUMES_READ]: 'Consultar volúmenes persistentes',
  [ApiKeyScope.VOLUMES_WRITE]: 'Crear, editar y eliminar volúmenes',
  [ApiKeyScope.DOMAINS_READ]: 'Consultar dominios personalizados',
  [ApiKeyScope.DOMAINS_WRITE]:
    'Registrar, verificar y eliminar dominios personalizados',
  [ApiKeyScope.NOTIFICATIONS_READ]: 'Consultar webhooks de notificaciones',
  [ApiKeyScope.NOTIFICATIONS_WRITE]:
    'Crear, editar, probar y eliminar webhooks de notificaciones',
  [ApiKeyScope.MAINTENANCE_READ]: 'Consultar estado de Garbage Collection',
  [ApiKeyScope.MAINTENANCE_WRITE]: 'Ejecutar tareas de Garbage Collection',
  [ApiKeyScope.METRICS_READ]: 'Consultar métricas de contenedores y sistema',
  [ApiKeyScope.API_KEYS_MANAGE]: 'Crear, listar, rotar y revocar API Keys',
  [ApiKeyScope.FULL_ACCESS]:
    'Acceso total a todos los recursos y acciones de la cuenta',
};

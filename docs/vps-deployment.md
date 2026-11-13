# Despliegue en Produccion en Servidor Linux / VPS

Esta guia describe el proceso de instalacion, configuracion y despliegue de **TitanPaaS** en cualquier proveedor de servidores virtuales o dedicados (DigitalOcean, Hetzner, AWS EC2, Linode, OVH, Vultr, etc.) utilizando Docker Compose y el script de instalacion desatendido.

---

## 1. Requisitos Minimos del Servidor

- **Sistema Operativo:** Ubuntu 22.04 LTS / 24.04 LTS, Debian 12, Rocky Linux 9, o AlmaLinux 9.
- **CPU:** Minimo 2 vCPU (Recomendado: 4 vCPU).
- **Memoria RAM:** Minimo 2 GB (Recomendado: 4 GB o superior).
- **Espacio en Disco:** Minimo 25 GB SSD/NVMe.
- **Puertos Abiertos en Firewall (Security Group):**
  - `80/tcp` (HTTP - Traefik)
  - `443/tcp` (HTTPS - Traefik con Let's Encrypt)
  - `22/tcp` (SSH de administracion)

---

## 2. Instalacion Rapida Desatendida (1-Click)

En tu servidor Linux recien aprovisionado, conectate por SSH como usuario `root` y ejecuta:

```bash
curl -fsSL https://raw.githubusercontent.com/sotk-devs/TitanPaaS/main/titan.sh | bash
```

### Opciones Disponibles del Instalador

```bash
curl -fsSL https://raw.githubusercontent.com/sotk-devs/TitanPaaS/main/titan.sh | bash -s -- \
  --domain paas.tu-dominio.com \
  --email admin@tu-dominio.com \
  --dir /opt/titanpaas \
  --unattended
```

Parametros soportados:
- `--domain <dominio>`: Dominio principal donde respondera la API y Traefik (si se omite en modo interactivo, detecta automaticamente la IP publica del servidor).
- `--email <email>`: Correo electronico para registro y renovacion de certificados SSL de Let's Encrypt.
- `--dir <ruta>`: Directorio destino de instalacion (por defecto: `/opt/titanpaas`).
- `--unattended` / `-y`: Modo no interactivo que genera de forma criptografica contraseñas y claves de cifrado seguras sin solicitar confirmacion manual.
- `--skip-docker`: Omite la instalacion de Docker si el servidor ya lo tiene configurado.

---

## 3. Acciones que Realiza el Instalador

1. Verifica permisos de `root` y arquitectura del sistema (`x86_64` o `aarch64`).
2. Instala dependencias base (`curl`, `git`, `openssl`, `ca-certificates`).
3. Instala Docker Engine y el plugin Docker Compose oficial si no estan presentes.
4. Clona el repositorio oficial de TitanPaaS en `/opt/titanpaas`.
5. Genera credenciales aleatorias seguras en `/opt/titanpaas/.env.production`:
   - `POSTGRES_PASSWORD` (32 caracteres hexadecimales)
   - `REDIS_PASSWORD` (32 caracteres hexadecimales)
   - `JWT_SECRET` (64 caracteres hexadecimales)
   - `ENCRYPTION_KEY` (clave de 256 bits para cifrado en reposo AES-256-GCM)
   - `GITHUB_WEBHOOK_SECRET`
6. Registra y habilita el servicio systemd `/etc/systemd/system/titanpaas.service` para arranque automatico en caso de reinicio del servidor.
7. Construye la imagen de produccion y levanta los contenedores:
   - `titan-traefik`: Reverse proxy con terminacion SSL automatica.
   - `titan-postgres`: PostgreSQL 16 con volumen persistente en `/var/lib/postgresql/data`.
   - `titan-redis`: Redis 7 con persistencia Append-Only y proteccion por contraseña.
   - `titan-api`: Nucleo de TitanPaaS NestJS en Node.js 22.
8. Ejecuta las migraciones de TypeORM contra PostgreSQL.
9. Verifica la respuesta del endpoint de salud `GET /system/health`.

---

## 4. Administracion y Mantenimiento

### Estado del Servicio

```bash
# Verificar estado del servicio systemd
systemctl status titanpaas

# Reiniciar la plataforma completa
systemctl restart titanpaas

# Detener la plataforma
systemctl stop titanpaas
```

### Logs en Tiempo Real

```bash
cd /opt/titanpaas
docker compose -f docker-compose.prod.yml logs -f titan-api
```

### Actualizacion a una Nueva Version

```bash
cd /opt/titanpaas
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T titan-api npm run migration:run
```

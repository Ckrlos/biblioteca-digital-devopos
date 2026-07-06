# Biblioteca Digital

Aplicacion de 3 capas para la gestion de libros y prestamos de una biblioteca,
desarrollada para la Evaluacion Final Transversal de Introduccion a
Herramientas DevOps (Duoc UC, ISY1101).

## Arquitectura

```
[ Navegador ]
      |
      v
[ frontend: nginx (LoadBalancer en EKS / puerto 8080 en local) ]
  - sirve el bundle estatico (HTML/CSS/JS)
  - reverse proxy de /api/* --> backend (ClusterIP interno)
      |
      v
[ backend: Node.js + Express (ClusterIP / puerto 3001) ]
  - API REST de libros y prestamos
  - /health, /metrics (Prometheus)
      |
      v
[ db: MySQL 8 (ClusterIP / puerto 3306, no publicado al host) ]
```

Ver diagrama detallado en `docs/arquitectura.png` (agregar por separado).

El frontend nunca conoce una IP o dominio del backend "hardcodeado": el
navegador siempre llama a rutas relativas del mismo origen (`/api/...`) y
nginx las reenvia internamente al backend (`nginx.conf.template`, variables
`BACKEND_HOST`/`BACKEND_PORT`). Esto resuelve el hecho de que el backend
vive como `ClusterIP` (no accesible desde fuera del cluster) mientras solo el
frontend expone un `LoadBalancer`, sin necesitar un segundo Load Balancer ni
actualizar URLs a mano tras el deploy.

## Stack

| Capa | Tecnologia |
|---|---|
| Frontend | HTML/CSS/JS vanilla, bundleado con esbuild |
| Backend | Node.js 20 + Express + mysql2 |
| Base de datos | MySQL 8 |
| Gestor de paquetes | **pnpm** (ver nota de seguridad mas abajo) |
| Registro de imagenes | Docker Hub |
| Orquestacion | AWS EKS (Kubernetes) |
| CI/CD | GitHub Actions |
| Observabilidad | stdout (`kubectl logs`) + `/metrics` (prom-client) |

### Por que pnpm y no npm

Se usa `pnpm` en vez de `npm` en ambos proyectos (`backend/`, `frontend/`)
porque bloquea por defecto los scripts `postinstall` de las dependencias
(hay que aprobarlos explicitamente via `pnpm.onlyBuiltDependencies`), que es
justo el vector que explotaron incidentes reales de la cadena de suministro
de npm (ua-parser-js, event-stream, el compromiso de chalk/debug de 2025).
`pnpm-lock.yaml` fija versiones exactas con hash de integridad, igual que
`package-lock.json`. Los Dockerfiles instalan pnpm via `corepack` (incluido
en Node 20, sin necesidad de `npm install -g`) y usan
`pnpm install --frozen-lockfile`, equivalente en semantica a `npm ci`.

## Modelo de datos

- **libros**: `id, titulo, autor, isbn (unique), stock_total, stock_disponible`
- **prestamos**: `id, libro_id (FK), nombre_usuario, fecha_prestamo,
  fecha_devolucion_estimada, fecha_devolucion_real, estado (prestado/devuelto)`

Ver `db/init.sql` para el DDL completo y los datos de ejemplo (6 libros).

Regla de negocio: crear un prestamo baja `stock_disponible` en 1 (se
rechaza con 409 si ya esta en 0); marcar un prestamo como devuelto lo sube
en 1. Ambas operaciones corren dentro de una transaccion con
`SELECT ... FOR UPDATE` para evitar condiciones de carrera.

## Correr en local

Requisitos: Docker y Docker Compose.

```bash
cp .env.example .env
# ajustar valores si se quiere, los defaults funcionan out-of-the-box
docker compose up --build
```

URLs resultantes:
- Frontend: http://localhost:8080
- Backend (API directa, opcional): http://localhost:3001
- Backend health: http://localhost:3001/health
- Backend metrics: http://localhost:3001/metrics

El frontend llama a la API via `http://localhost:8080/api/...` (mismo
origen, proxied por nginx), no directamente al puerto 3001.

Para bajar el entorno y borrar los datos de MySQL:

```bash
docker compose down -v
```

## Variables de entorno

Ver `.env.example` (raiz, usado por docker-compose) y
`backend/.env.example` (referencia de las variables que consume el backend
si se corre fuera de Docker). Nunca commitear un `.env` real.

| Variable | Descripcion |
|---|---|
| `MYSQL_ROOT_PASSWORD` | Password root de MySQL |
| `MYSQL_DATABASE` / `MYSQL_USER` / `MYSQL_PASSWORD` | Credenciales de la app |
| `BACKEND_PORT` | Puerto publicado del backend en el host |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Conexion del backend a MySQL |
| `FRONTEND_PORT` | Puerto publicado del frontend en el host |

## Tests

```bash
cd backend
pnpm install
pnpm test
```

Incluye al menos un test real (`src/tests/health.test.js`) que verifica que
`/health` responde 200, ejecutado automaticamente en el job `test` del
pipeline.

## Pipeline CI/CD (`.github/workflows/ci-cd.yml`)

Tres jobs encadenados, dispara en cada push a `main`:

1. **test**: instala dependencias del backend con pnpm y corre `pnpm test`.
2. **build-and-push** (depende de `test`): construye y sube a Docker Hub las
   imagenes `<usuario>/biblioteca-backend` y `<usuario>/biblioteca-frontend`,
   cada una con tag `latest` y con el sha corto del commit (trazabilidad).
3. **deploy** (depende de `build-and-push`): configura credenciales AWS,
   actualiza el kubeconfig del cluster EKS, aplica `kubectl apply -f k8s/`,
   actualiza la imagen desplegada al tag del commit con
   `kubectl set image`, y verifica con `kubectl rollout status` que el
   despliegue termino bien (evidencia de ejecucion exitosa).

### Secrets de GitHub requeridos

Configurar en *Settings > Secrets and variables > Actions* del repositorio:

| Secret | Uso |
|---|---|
| `DOCKERHUB_USERNAME` | Usuario de Docker Hub |
| `DOCKERHUB_TOKEN` | Access token de Docker Hub (no la password) |
| `AWS_ACCESS_KEY_ID` | Credencial de sesion de AWS Academy |
| `AWS_SECRET_ACCESS_KEY` | Credencial de sesion de AWS Academy |
| `AWS_SESSION_TOKEN` | Token de sesion de AWS Academy (obligatorio, ver nota abajo) |
| `AWS_REGION` | Region del cluster EKS (ej. `us-east-1`) |
| `EKS_CLUSTER_NAME` | Nombre del cluster EKS |
| `EKS_NAMESPACE` | Namespace de la app (`biblioteca`) |

### Nota sobre credenciales de AWS Academy

Las credenciales del Learner Lab son **de sesion** y expiran cada
**~3-4 horas** — no son un usuario IAM permanente. Por eso el job `deploy`
usa `AWS_SESSION_TOKEN` ademas de las dos claves clasicas: sin ese tercer
valor, la autenticacion falla en cuanto la sesion rota. Antes de correr el
pipeline hay que refrescar `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y
`AWS_SESSION_TOKEN` en GitHub Secrets con las credenciales vigentes
(AWS Academy > Learner Lab > AWS Details > AWS CLI).

En una cuenta AWS real esto se evitaria con **OIDC federado** (GitHub Actions
asume un rol IAM directamente, sin claves estaticas de larga vida), pero AWS
Academy no permite crear proveedores OIDC ni roles IAM personalizados, asi
que usamos claves de sesion como alternativa documentada.

## Despliegue en EKS (`k8s/`)

Los manifiestos estan prefijados con un numero para garantizar el orden de
aplicacion cuando se corre `kubectl apply -f k8s/` (kubectl procesa los
archivos de un directorio en orden alfabetico, y el namespace debe existir
antes que cualquier recurso namespaced):

1. `00-namespace.yaml` — namespace `biblioteca`
2. `01-mysql-secret.yaml` — credenciales de MySQL (reemplazar valores antes
   de aplicar en un cluster real, o crear el Secret con
   `kubectl create secret generic ... --from-literal=...`)
3. `03-mysql-init-configmap.yaml` — mismo contenido que `db/init.sql`
4. `04-mysql-deployment.yaml` (datos en `emptyDir`, no persistentes: se
   pierden si el pod se reinicia) / `05-mysql-service.yaml`
5. `06-backend-deployment.yaml` (2 replicas, probes a `/health`) /
   `07-backend-service.yaml` (ClusterIP)
6. `08-backend-hpa.yaml` — CPU 70%, min 2 / max 10
7. `09-frontend-deployment.yaml` (2 replicas) /
   `10-frontend-service.yaml` (**LoadBalancer**, EKS aprovisiona un Classic
   Load Balancer automaticamente, sin pasos manuales)
8. `11-frontend-hpa.yaml` — CPU 60%, min 2 / max 6

Aplicar todo de una vez:

```bash
kubectl apply -f k8s/
```

Las imagenes en los `deployment.yaml` son placeholders
(`dockerhub-user/biblioteca-backend:latest`); el pipeline las sobreescribe
en cada deploy con `kubectl set image` apuntando al tag del commit.

Requisito de infraestructura fuera de este repo (se asume ya provisionado
manualmente en AWS Academy): un cluster EKS con nodos, el addon EBS CSI
(para el PVC de MySQL) y el metrics-server (para que los HPA puedan leer
metricas de CPU).

## Convenciones de commits

Se usa el formato `tipo: descripcion breve en imperativo`, con tipos:
`feat`, `fix`, `chore`, `docs`, `ci`, `refactor`, `test`. Ejemplo:
`feat: agregar endpoint de devolucion de prestamos`.

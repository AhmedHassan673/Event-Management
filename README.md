# VisioSpark Event Management (COMSATS Wah)

Stack: static HTML/CSS/JS frontend (nginx) · Node.js + Express API · PostgreSQL · Docker · Kubernetes · GitHub Actions.

```
frontend/  nginx image, proxies /api to backend
backend/   Express REST API, auto-creates schema and seeds 2 sample events
k8s/       namespace, Postgres StatefulSet, backend + HPA, frontend, Ingress, kustomization
.github/workflows/ci-cd.yml   test -> build/push to GHCR -> deploy to Kubernetes
```

## Run locally
```
docker compose up --build
```
Open http://localhost:8080. Admin key for the Organizer panel: `dev-admin-key`.

## API
| Method | Path | Auth |
|---|---|---|
| GET | /api/health | - |
| GET | /api/events | - |
| POST | /api/events | x-admin-key |
| DELETE | /api/events/:id | x-admin-key |
| POST | /api/events/:id/register | - |
| GET | /api/events/:id/registrations | x-admin-key |

## Deploy with CI/CD
1. Push this repo to GitHub (branch `main`).
2. Make sure your cluster has an NGINX ingress controller and metrics-server (for the HPA).
3. Edit the host in `k8s/ingress.yaml`.
4. Add repository secrets (Settings > Secrets and variables > Actions):
   - `KUBE_CONFIG`: `base64 -w0 ~/.kube/config`
   - `DB_PASSWORD`: a strong database password
   - `ADMIN_KEY`: a strong organizer key
5. Make GHCR packages public, or add an imagePullSecret for private images.
6. Push to `main`. The pipeline tests, builds both images tagged with the commit SHA, pushes them and rolls out to the `visiospark` namespace.

## Manual deploy
```
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml        # copy from secret.example.yaml
kubectl apply -k k8s
```
Replace `YOUR_GITHUB_USER` in `k8s/backend.yaml` and `k8s/frontend.yaml` with your image owner first.

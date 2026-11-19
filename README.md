# Haani Shafiq Siddiqui · Portfolio

Two ways to read my CV:

- **`/`**: an editorial, scroll-driven page.
- **`/drive`**: a 3D world where you drive a car along a winding road and stop at checkpoints to open each section, with an Express or a Scenic route.

Built with Next.js 16, React 19, TypeScript, Motion and React Three Fiber.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

With Docker:

```bash
docker build -t portfolio .
docker run -p 3000:3000 portfolio
```

On Kubernetes (uses the image published by CI):

```bash
kubectl apply -f k8s/
kubectl port-forward service/portfolio 8080:80   # http://localhost:8080
```

## Project layout

| Path | What it is |
|---|---|
| `src/data/portfolio.ts` | All CV content. Both pages read from here. |
| `src/app/` | The two routes (`/` and `/drive`). |
| `src/components/editorial/` | Scroll animations for the standard page. |
| `src/components/drive/` | The driving game: track, physics, 3D world, avatar, HUD. |
| `Dockerfile` | Two-stage build into a small Node image. |
| `k8s/` | Kubernetes Deployment and Service. |
| `.github/workflows/ci.yml` | CI/CD pipeline. |

## How changes get to `main`

`main` always holds working code. Every change goes through a branch and a pull request:

```bash
git switch main && git pull                 # start from the latest main
git switch -c feat/short-description        # one branch per change
# ...edit, then:
git add -A && git commit -m "Describe the change"
git push -u origin feat/short-description   # GitHub prints a link to open a PR
```

On the pull request, CI lints, type-checks, builds the site and builds the Docker image. Merge when it's green. The merge to `main` runs CI again and publishes the image to `ghcr.io/haani76/portfolio`.

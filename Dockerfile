FROM node:26.13.1-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1 AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json frontend/.npmrc ./
RUN npm ci
COPY frontend/ ./
COPY templates/ /src/templates/
# The lab pages read the lab guides when the dashboard is built.
COPY docs/lab-1-hello-kubernetes.md docs/lab-2-your-app-on-eks.md /src/docs/
RUN npm run build

FROM golang:1.27.4-bookworm@sha256:4fa7c968ba93f1635670522dbb01a2c78150443e1385746924566079f36570ea AS backend
WORKDIR /src/backend
ENV CGO_ENABLED=0 GOTOOLCHAIN=local
COPY backend/go.mod backend/*.go ./
RUN go build -trimpath -o /out/dashboard .

FROM scratch
COPY --from=backend /out/dashboard /usr/local/bin/dashboard
COPY --from=frontend /src/frontend/dist/ /app/web/
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/dashboard", "-listen", "0.0.0.0:8080", "-web", "/app/web"]

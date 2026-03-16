import os
import shutil

# ─────────────────────────────────────────────
# Service catalog — port, nodePort, health path
# ─────────────────────────────────────────────
SERVICES = {
    "api-gateway":           {"port": 8080, "health": "/health"},
    "user-service":          {"port": 7010, "health": "/health"},
    "catalog-service":       {"port": 7006, "health": "/health"},
    "cart-service":          {"port": 7001, "health": "/health"},
    "checkout-service":      {"port": 7004, "health": "/health"},
    "order-service":         {"port": 5003, "health": "/health"},
    "payment-service":       {"port": 7003, "health": "/health"},
    "shipping-service":      {"port": 7008, "health": "/health"},
    "email-service":         {"port": 7005, "health": "/health"},
    "recommendation-service":{"port": 7007, "health": "/health"},
    "ad-service":            {"port": 7002, "health": "/health"},
    "currency-service":      {"port": 7009, "health": "/health"},
    "frontend":              {"port": 80,   "health": "/", "nodePort": 30001},
    "db":                    {"port": 5432},
}

# Plain-text env vars per service (credentials go to Secrets below)
ENV_VARS = {
    "api-gateway":           {"PORT": "8080", "NODE_ENV": "production"},
    "user-service":          {"PORT": "7010", "NODE_ENV": "production", "DB_HOST": "db", "DB_NAME": "user_db",
                              "EMAIL_SERVICE_URL": "http://email-service:7005/api/v1/emails"},
    "catalog-service":       {"PORT": "7006", "NODE_ENV": "production", "DB_HOST": "db", "DB_NAME": "catalog_db"},
    "cart-service":          {"PORT": "7001", "NODE_ENV": "production", "DB_HOST": "db", "DB_NAME": "cart_db"},
    "checkout-service":      {"PORT": "7004", "NODE_ENV": "production", "DB_HOST": "db", "DB_NAME": "checkout_db"},
    "order-service":         {"PORT": "5003", "NODE_ENV": "production", "DB_HOST": "db", "DB_NAME": "order_db"},
    "payment-service":       {"PORT": "7003", "NODE_ENV": "production", "DB_HOST": "db", "DB_NAME": "payment_db"},
    "shipping-service":      {"PORT": "7008", "NODE_ENV": "production", "DB_HOST": "db", "DB_NAME": "shipping_db"},
    "email-service":         {"PORT": "7005", "NODE_ENV": "production", "DB_HOST": "db", "DB_NAME": "email_db",
                              "SMTP_HOST": "smtp.ethereal.email", "SMTP_PORT": "465", "SMTP_SECURE": "true"},
    "recommendation-service":{"PORT": "7007", "NODE_ENV": "production", "DB_HOST": "db", "DB_NAME": "recommendation_db"},
    "ad-service":            {"PORT": "7002", "NODE_ENV": "production", "DB_HOST": "db", "DB_NAME": "ad_db"},
    "currency-service":      {"PORT": "7009", "NODE_ENV": "production", "DB_HOST": "db", "DB_NAME": "currency_db"},
    "frontend":              {},
    "db":                    {},
}

# Which services need which secret keys injected as env vars
SERVICE_SECRETS = {
    "db":           ["POSTGRES_USER", "POSTGRES_PASSWORD"],
    "user-service": ["DB_USER", "DB_PASSWORD", "JWT_SECRET"],
    "catalog-service":       ["DB_USER", "DB_PASSWORD"],
    "cart-service":          ["DB_USER", "DB_PASSWORD"],
    "checkout-service":      ["DB_USER", "DB_PASSWORD"],
    "order-service":         ["DB_USER", "DB_PASSWORD"],
    "payment-service":       ["DB_USER", "DB_PASSWORD"],
    "shipping-service":      ["DB_USER", "DB_PASSWORD"],
    "email-service":         ["DB_USER", "DB_PASSWORD", "SMTP_USER", "SMTP_PASS"],
    "recommendation-service":["DB_USER", "DB_PASSWORD"],
    "ad-service":            ["DB_USER", "DB_PASSWORD"],
    "currency-service":      ["DB_USER", "DB_PASSWORD"],
}

# Default secret values (overridable in values.yaml)
SECRET_DEFAULTS = {
    "POSTGRES_USER":     "postgres",
    "POSTGRES_PASSWORD": "postgres",
    "DB_USER":           "postgres",
    "DB_PASSWORD":       "postgres",
    "JWT_SECRET":        "super-secret-jwt-key-aurora",
    "SMTP_USER":         "yuz25warufuixewz@ethereal.email",
    "SMTP_PASS":         "ttAXXqHj24Nn38M1Jd",
}

# ─────────────────────────────────────────────
# Helm template raw strings
# ─────────────────────────────────────────────

HELPERS = """\
{{/* Chart name */}}
{{- define "chart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Full release name */}}
{{- define "chart.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/* Common labels */}}
{{- define "chart.labels" -}}
helm.sh/chart: {{ include "chart.name" . }}-{{ .Chart.Version | replace "+" "_" }}
{{ include "chart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/* Selector labels */}}
{{- define "chart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "chart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app: {{ include "chart.name" . }}
{{- end }}
"""

# Deployment template — uses str.replace() with sentinel tokens to avoid f-string
# consuming Helm's {{ }} double-braces.
DEPLOYMENT_TMPL = (
    'apiVersion: apps/v1\n'
    'kind: Deployment\n'
    'metadata:\n'
    '  name: {{ include "chart.fullname" . }}\n'
    '  labels:\n'
    '    {{- include "chart.labels" . | nindent 4 }}\n'
    'spec:\n'
    '  {{- if not .Values.autoscaling.enabled }}\n'
    '  replicas: {{ .Values.replicaCount }}\n'
    '  {{- end }}\n'
    '  selector:\n'
    '    matchLabels:\n'
    '      {{- include "chart.selectorLabels" . | nindent 6 }}\n'
    '  template:\n'
    '    metadata:\n'
    '      labels:\n'
    '        {{- include "chart.selectorLabels" . | nindent 8 }}\n'
    '    spec:\n'
    '      containers:\n'
    '        - name: {{ .Chart.Name }}\n'
    '          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"\n'
    '          imagePullPolicy: {{ .Values.image.pullPolicy }}\n'
    '          ports:\n'
    '            - name: http\n'
    '              containerPort: {{ .Values.service.port }}\n'
    '              protocol: TCP\n'
    '__ENV_BLOCK__'
    '__PROBE_BLOCK__'
    '__VOLUME_MOUNTS__'
    '__VOLUMES__'
)

ENV_FROM_PLAIN = """\
          {{- if .Values.env }}
          env:
          {{- range $key, $val := .Values.env }}
            - name: {{ $key }}
              value: {{ $val | quote }}
          {{- end }}
          {{- end }}
"""

ENV_FROM_PLAIN_AND_SECRET = """\
          env:
          {{- range $key, $val := .Values.env }}
            - name: {{ $key }}
              value: {{ $val | quote }}
          {{- end }}
          {{- range $key := .Values.secretKeys }}
            - name: {{ $key }}
              valueFrom:
                secretKeyRef:
                  name: {{ include "chart.fullname" $ }}-secret
                  key: {{ $key }}
          {{- end }}
"""

ENV_FROM_SECRET_ONLY = """\
          env:
          {{- range $key := .Values.secretKeys }}
            - name: {{ $key }}
              valueFrom:
                secretKeyRef:
                  name: {{ include "chart.fullname" $ }}-secret
                  key: {{ $key }}
          {{- end }}
"""

PROBE_BLOCK = """\
          {{- if .Values.probes.enabled }}
          livenessProbe:
            httpGet:
              path: {{ .Values.probes.liveness.path }}
              port: http
            initialDelaySeconds: {{ .Values.probes.liveness.initialDelaySeconds }}
            periodSeconds: {{ .Values.probes.liveness.periodSeconds }}
            failureThreshold: {{ .Values.probes.liveness.failureThreshold }}
          readinessProbe:
            httpGet:
              path: {{ .Values.probes.readiness.path }}
              port: http
            initialDelaySeconds: {{ .Values.probes.readiness.initialDelaySeconds }}
            periodSeconds: {{ .Values.probes.readiness.periodSeconds }}
            failureThreshold: {{ .Values.probes.readiness.failureThreshold }}
          {{- end }}
"""

DB_VOLUME_MOUNTS = """\
          volumeMounts:
            - name: pgdata
              mountPath: /var/lib/postgresql/data
            - name: init-db
              mountPath: /docker-entrypoint-initdb.d/init-db.sql
              subPath: init-db.sql
"""

DB_VOLUMES = """\
      volumes:
        - name: pgdata
          persistentVolumeClaim:
            claimName: {{ include "chart.fullname" . }}-pvc
        - name: init-db
          configMap:
            name: {{ include "chart.fullname" . }}-init-script
"""

SERVICE_CLUSTERIP = """\
apiVersion: v1
kind: Service
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "chart.selectorLabels" . | nindent 4 }}
"""

SERVICE_NODEPORT = """\
apiVersion: v1
kind: Service
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
      nodePort: {{ .Values.service.nodePort }}
  selector:
    {{- include "chart.selectorLabels" . | nindent 4 }}
"""

HPA_TMPL = """\
{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "chart.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilizationPercentage }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetMemoryUtilizationPercentage }}
{{- end }}
"""

INGRESS_TMPL = """\
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  {{- if .Values.ingress.className }}
  ingressClassName: {{ .Values.ingress.className }}
  {{- end }}
  {{- if .Values.ingress.tls }}
  tls:
    {{- toYaml .Values.ingress.tls | nindent 4 }}
  {{- end }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ include "chart.fullname" $ }}
                port:
                  name: http
          {{- end }}
    {{- end }}
{{- end }}
"""

SECRET_TMPL = """\
{{- if .Values.secrets }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "chart.fullname" . }}-secret
  labels:
    {{- include "chart.labels" . | nindent 4 }}
type: Opaque
stringData:
  {{- range $key, $val := .Values.secrets }}
  {{ $key }}: {{ $val | quote }}
  {{- end }}
{{- end }}
"""

PVC_YAML = """\
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ include "chart.fullname" . }}-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: {{ .Values.storage.size }}
"""

DB_CONFIGMAP = """\
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "chart.fullname" . }}-init-script
data:
  init-db.sql: |
    CREATE DATABASE catalog_db;
    CREATE DATABASE cart_db;
    CREATE DATABASE checkout_db;
    CREATE DATABASE order_db;
    CREATE DATABASE payment_db;
    CREATE DATABASE shipping_db;
    CREATE DATABASE email_db;
    CREATE DATABASE recommendation_db;
    CREATE DATABASE ad_db;
    CREATE DATABASE currency_db;
    CREATE DATABASE user_db;
"""

# ─────────────────────────────────────────────
# Generation
# ─────────────────────────────────────────────
HELM_DIR = "c:/Data_Nagendra/perfume_website/helm"

if os.path.exists(HELM_DIR):
    shutil.rmtree(HELM_DIR)
os.makedirs(HELM_DIR)

for service, config in SERVICES.items():
    chart_dir = os.path.join(HELM_DIR, service)
    tmpl_dir  = os.path.join(chart_dir, "templates")
    os.makedirs(tmpl_dir)

    image_name = f"perfume-{service}" if service != "db" else "postgres"
    image_tag  = "15-alpine" if service == "db" else "latest"
    svc_type   = "NodePort" if service == "frontend" else "ClusterIP"
    health_path = config.get("health", "/health")
    has_secrets = service in SERVICE_SECRETS
    secret_keys = SERVICE_SECRETS.get(service, [])

    # ── Chart.yaml ──────────────────────────────
    with open(os.path.join(chart_dir, "Chart.yaml"), "w") as f:
        f.write(
            f"apiVersion: v2\n"
            f"name: {service}\n"
            f"description: Helm chart for {service}\n"
            f"type: application\n"
            f"version: 0.1.0\n"
            f'appVersion: "1.0.0"\n'
        )

    # ── values.yaml ─────────────────────────────
    envs_yaml = "".join(f'  {k}: "{v}"\n' for k, v in ENV_VARS[service].items())
    secrets_yaml = "".join(
        f'  {k}: "{SECRET_DEFAULTS.get(k, "change-me")}"\n' for k in secret_keys
    )
    secret_keys_yaml = "".join(f'  - {k}\n' for k in secret_keys)

    is_ingress_service = service in ("api-gateway", "frontend")
    ingress_host = "api.perfume.local" if service == "api-gateway" else "perfume.local"
    ingress_path = "/api" if service == "api-gateway" else "/"

    vals = []
    vals.append(f"replicaCount: 1\n\n")
    vals.append(f"image:\n  repository: {image_name}\n  pullPolicy: IfNotPresent\n  tag: \"{image_tag}\"\n\n")
    vals.append(f"service:\n  type: {svc_type}\n  port: {config['port']}\n")
    if "nodePort" in config:
        vals.append(f"  nodePort: {config['nodePort']}\n")
    vals.append("\n")

    # Probes (skip for db)
    if service != "db":
        vals.append(
            f"probes:\n"
            f"  enabled: true\n"
            f"  liveness:\n"
            f"    path: {health_path}\n"
            f"    initialDelaySeconds: 15\n"
            f"    periodSeconds: 20\n"
            f"    failureThreshold: 3\n"
            f"  readiness:\n"
            f"    path: {health_path}\n"
            f"    initialDelaySeconds: 5\n"
            f"    periodSeconds: 10\n"
            f"    failureThreshold: 3\n\n"
        )

    # HPA
    vals.append(
        f"autoscaling:\n"
        f"  enabled: false\n"
        f"  minReplicas: 1\n"
        f"  maxReplicas: 5\n"
        f"  targetCPUUtilizationPercentage: 70\n"
        f"  targetMemoryUtilizationPercentage: 80\n\n"
    )

    # Ingress
    if is_ingress_service:
        vals.append(
            f"ingress:\n"
            f"  enabled: false\n"
            f"  className: nginx\n"
            f"  annotations:\n"
            f"    nginx.ingress.kubernetes.io/rewrite-target: /\n"
            f"  hosts:\n"
            f"    - host: {ingress_host}\n"
            f"      paths:\n"
            f"        - path: {ingress_path}\n"
            f"          pathType: Prefix\n"
            f"  tls: []\n\n"
        )
    else:
        vals.append("ingress:\n  enabled: false\n\n")

    # Plain env vars
    vals.append("env:\n")
    vals.append(envs_yaml if envs_yaml else "  {}\n")
    vals.append("\n")

    # Secrets block
    if has_secrets:
        vals.append("# Sensitive values — override these or use external secret management\nsecrets:\n")
        vals.append(secrets_yaml)
        vals.append("\n# Keys from the Secret to inject as env vars\nsecretKeys:\n")
        vals.append(secret_keys_yaml)
        vals.append("\n")

    if service == "db":
        vals.append("storage:\n  size: 1Gi\n")

    with open(os.path.join(chart_dir, "values.yaml"), "w") as f:
        f.writelines(vals)

    # ── deployment.yaml ──────────────────────────
    # Build env block
    plain_envs = ENV_VARS[service]
    if plain_envs and has_secrets:
        env_block = ENV_FROM_PLAIN_AND_SECRET
    elif has_secrets:
        env_block = ENV_FROM_SECRET_ONLY
    else:
        env_block = ENV_FROM_PLAIN if service != "db" else ENV_FROM_PLAIN

    probe_block = PROBE_BLOCK if service != "db" else ""
    vol_mounts  = DB_VOLUME_MOUNTS if service == "db" else ""
    volumes     = DB_VOLUMES       if service == "db" else ""

    deployment = (
        DEPLOYMENT_TMPL
        .replace("__ENV_BLOCK__", env_block)
        .replace("__PROBE_BLOCK__", probe_block)
        .replace("__VOLUME_MOUNTS__", vol_mounts)
        .replace("__VOLUMES__", volumes)
    )
    with open(os.path.join(tmpl_dir, "deployment.yaml"), "w") as f:
        f.write(deployment)

    # ── service.yaml ─────────────────────────────
    svc = SERVICE_NODEPORT if "nodePort" in config else SERVICE_CLUSTERIP
    with open(os.path.join(tmpl_dir, "service.yaml"), "w") as f:
        f.write(svc)

    # ── hpa.yaml ─────────────────────────────────
    with open(os.path.join(tmpl_dir, "hpa.yaml"), "w") as f:
        f.write(HPA_TMPL)

    # ── ingress.yaml ─────────────────────────────
    with open(os.path.join(tmpl_dir, "ingress.yaml"), "w") as f:
        f.write(INGRESS_TMPL)

    # ── secret.yaml ──────────────────────────────
    if has_secrets:
        with open(os.path.join(tmpl_dir, "secret.yaml"), "w") as f:
            f.write(SECRET_TMPL)

    # ── _helpers.tpl ─────────────────────────────
    with open(os.path.join(tmpl_dir, "_helpers.tpl"), "w") as f:
        f.write(HELPERS)

    # ── DB extras ────────────────────────────────
    if service == "db":
        with open(os.path.join(tmpl_dir, "pvc.yaml"), "w") as f:
            f.write(PVC_YAML)
        with open(os.path.join(tmpl_dir, "configmap.yaml"), "w") as f:
            f.write(DB_CONFIGMAP)

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
print("All enhanced Helm charts generated successfully!\n")
for service in sorted(SERVICES.keys()):
    files = sorted(os.listdir(os.path.join(HELM_DIR, service, "templates")))
    print(f"  {service:32s} templates: {', '.join(files)}")

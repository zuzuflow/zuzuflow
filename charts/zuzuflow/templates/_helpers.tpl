{{/*
Expand the name of the chart.
*/}}
{{- define "zuzuflow.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
Truncated at 63 chars (DNS limit). If release name contains the chart name,
we don't double up.
*/}}
{{- define "zuzuflow.fullname" -}}
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

{{/*
Chart label used in common labels
*/}}
{{- define "zuzuflow.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels — attached to every resource.
*/}}
{{- define "zuzuflow.labels" -}}
helm.sh/chart: {{ include "zuzuflow.chart" . }}
{{ include "zuzuflow.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: zuzuflow
{{- end }}

{{/*
Selector labels — the subset used for Deployment/Service selectors.
The `component` label is appended per-template.
*/}}
{{- define "zuzuflow.selectorLabels" -}}
app.kubernetes.io/name: {{ include "zuzuflow.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Resource name helpers — keep them in one place so renaming is safe.
*/}}
{{- define "zuzuflow.secretName" -}}
{{ include "zuzuflow.fullname" . }}-secrets
{{- end }}

{{- define "zuzuflow.configMapName" -}}
{{ include "zuzuflow.fullname" . }}-config
{{- end }}

{{- define "zuzuflow.backendServiceName" -}}
{{ include "zuzuflow.fullname" . }}-backend
{{- end }}

{{- define "zuzuflow.frontendServiceName" -}}
{{ include "zuzuflow.fullname" . }}-frontend
{{- end }}

{{- define "zuzuflow.postgresServiceName" -}}
{{ include "zuzuflow.fullname" . }}-postgres
{{- end }}

{{- define "zuzuflow.temporalServiceName" -}}
{{ include "zuzuflow.fullname" . }}-temporal
{{- end }}

{{- define "zuzuflow.temporalUiServiceName" -}}
{{ include "zuzuflow.fullname" . }}-temporal-ui
{{- end }}

{{/*
Service account name.
*/}}
{{- define "zuzuflow.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "zuzuflow.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end }}

{{/*
Build a container image reference: registry/org/workflow-<name>:<version>
Usage: {{ include "zuzuflow.image" (dict "name" "backend" "root" .) }}
*/}}
{{- define "zuzuflow.image" -}}
{{- $root := .root -}}
{{- printf "%s/%s/workflow-%s:%s"
    $root.Values.image.registry
    $root.Values.image.org
    .name
    $root.Values.image.version
}}
{{- end }}

{{/*
DATABASE_URL resolver:
  - postgres.enabled=true  → build DSN pointing at the in-cluster Postgres
                             using the POSTGRES_PASSWORD envFrom key
  - postgres.enabled=false → use externalDatabase.url verbatim
*/}}
{{- define "zuzuflow.databaseUrl" -}}
{{- if .Values.postgres.enabled -}}
postgresql://{{ .Values.postgres.user }}:$(POSTGRES_PASSWORD)@{{ include "zuzuflow.postgresServiceName" . }}:5432/{{ .Values.postgres.database }}
{{- else -}}
{{- required "externalDatabase.url is required when postgres.enabled=false" .Values.externalDatabase.url -}}
{{- end -}}
{{- end }}

{{/*
TEMPORAL_ADDRESS resolver.
*/}}
{{- define "zuzuflow.temporalAddress" -}}
{{- if .Values.temporal.enabled -}}
{{ include "zuzuflow.temporalServiceName" . }}:7233
{{- else -}}
{{- required "externalTemporal.address is required when temporal.enabled=false" .Values.externalTemporal.address -}}
{{- end -}}
{{- end }}

{{/*
Preserve-or-generate pattern for secret values.
Call with: (list <user-override> <existing-b64-from-lookup> <fallback-generated>)
*/}}
{{- define "zuzuflow.preserveOrGen" -}}
{{- $user := index . 0 -}}
{{- $existingB64 := index . 1 -}}
{{- $fallback := index . 2 -}}
{{- if $user -}}
{{- $user -}}
{{- else if $existingB64 -}}
{{- $existingB64 | b64dec -}}
{{- else -}}
{{- $fallback -}}
{{- end -}}
{{- end }}

{{/*
Expand the name of the chart.
*/}}
{{- define "twake-mail-frontend.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "twake-mail-frontend.fullname" -}}
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
Create chart name and version as used by the chart label.
*/}}
{{- define "twake-mail-frontend.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "twake-mail-frontend.labels" -}}
helm.sh/chart: {{ include "twake-mail-frontend.chart" . }}
app: twake
component: mail-frontend
{{ include "twake-mail-frontend.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "twake-mail-frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "twake-mail-frontend.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Return the proper Docker Image: repository:tag, or repository@digest
*/}}
{{- define "twake-mail-frontend.image" -}}
{{- $image := .Values.deployment.image -}}
{{- if $image.digest -}}
{{- printf "%s@%s" $image.repository $image.digest -}}
{{- else -}}
{{- printf "%s:%s" $image.repository (default .Chart.AppVersion $image.tag | toString) -}}
{{- end -}}
{{- end -}}

{{/*
A security context of the values, without its `enabled` switch
*/}}
{{- define "twake-mail-frontend.securityContext" -}}
{{- omit . "enabled" | toYaml }}
{{- end -}}

{{/*
The origin (scheme://host[:port]) of an absolute URL, empty otherwise
*/}}
{{- define "twake-mail-frontend.origin" -}}
{{- $url := urlParse . -}}
{{- if and $url.scheme $url.host -}}
{{- printf "%s://%s" $url.scheme $url.host -}}
{{- end -}}
{{- end -}}

{{/*
The connect-src sources added to the policy of the image (CSP_CONNECT_SRC):
csp.connectSrc, and with csp.autoConnectSrc the origins the configuration
points to: JMAP and its WebSocket, the SSO, Sentry, a fixed Twake Drive
*/}}
{{- define "twake-mail-frontend.cspConnectSrc" -}}
{{- $sources := list -}}
{{- $config := .Values.config -}}
{{- if .Values.csp.autoConnectSrc -}}
{{- $sentry := $config.sentry | default dict -}}
{{- $jmap := urlParse ($config.serverUrl | default $config.jmapSessionUrl | default "") -}}
{{- if and $jmap.scheme $jmap.host -}}
{{- $sources = append $sources (printf "%s://%s" $jmap.scheme $jmap.host) -}}
{{- $sources = append $sources (printf "%s://%s" (ternary "wss" "ws" (eq $jmap.scheme "https")) $jmap.host) -}}
{{- end -}}
{{- if eq ($config.authMode | default "oidc") "oidc" -}}
{{- with include "twake-mail-frontend.origin" ($config.sso.baseUrl | default "") -}}
{{- $sources = append $sources . -}}
{{- end -}}
{{- end -}}
{{- if ne (toString $sentry.enabled) "false" -}}
{{- with include "twake-mail-frontend.origin" ($sentry.dsn | default $config.sentryDsn | default "") -}}
{{- $sources = append $sources . -}}
{{- end -}}
{{- end -}}
{{- $tdrive := $config.tdrive | default dict -}}
{{- if and $tdrive.enabled (not (contains "{" ($tdrive.intentUrl | default ""))) -}}
{{- with include "twake-mail-frontend.origin" ($tdrive.intentUrl | default "") -}}
{{- $sources = append $sources . -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- $sources = concat $sources (.Values.csp.connectSrc | default list) -}}
{{- $sources | uniq | join " " -}}
{{- end -}}

{{/*
A JavaScript string literal (JSON is valid JavaScript)
*/}}
{{- define "twake-mail-frontend.jsString" -}}
{{- . | toString | toJson -}}
{{- end -}}

{{/*
.env.js: the runtime configuration of the app (public/.env.example.js)
*/}}
{{- define "twake-mail-frontend.envJs" -}}
{{- $config := .Values.config -}}
// Runtime configuration of Twake Mail, rendered by the Helm chart
// {{ include "twake-mail-frontend.chart" . }} from its values (config.*).
{{- $serverUrl := $config.serverUrl | default "" | toString }}
{{- if $serverUrl }}
{{- if hasPrefix "/" $serverUrl }}
var SERVER_URL = window.location.origin + {{ include "twake-mail-frontend.jsString" $serverUrl }}
{{- else }}
var SERVER_URL = {{ include "twake-mail-frontend.jsString" $serverUrl }}
{{- end }}
{{- else if $config.jmapSessionUrl }}
{{- /* Deprecated: the app reads it as JMAP_SESSION_URL and warns */}}
{{- if hasPrefix "/" ($config.jmapSessionUrl | toString) }}
var JMAP_SESSION_URL = window.location.origin + {{ include "twake-mail-frontend.jsString" $config.jmapSessionUrl }}
{{- else }}
var JMAP_SESSION_URL = {{ include "twake-mail-frontend.jsString" $config.jmapSessionUrl }}
{{- end }}
{{- else }}
{{- required "config.serverUrl is required" "" }}
{{- end }}
var AUTH_MODE = {{ include "twake-mail-frontend.jsString" ($config.authMode | default "oidc") }}
{{- if eq ($config.authMode | default "oidc") "oidc" }}
var SSO_BASE_URL = {{ include "twake-mail-frontend.jsString" (required "config.sso.baseUrl is required with authMode oidc" $config.sso.baseUrl) }}
var WEB_OIDC_CLIENT_ID = {{ include "twake-mail-frontend.jsString" (required "config.sso.clientId is required with authMode oidc" $config.sso.clientId) }}
{{- with $config.sso.scope }}
var OIDC_SCOPES = {{ include "twake-mail-frontend.jsString" (regexReplaceAll "[\\s,]+" . ",") }}
{{- end }}
{{- with $config.domainRedirectUrl }}
var DOMAIN_REDIRECT_URL = {{ include "twake-mail-frontend.jsString" . }}
{{- end }}
{{- with $config.sso.redirectUri }}
var SSO_REDIRECT_URI = {{ include "twake-mail-frontend.jsString" . }}
{{- end }}
{{- with $config.sso.postLogoutRedirect }}
var SSO_POST_LOGOUT_REDIRECT = {{ include "twake-mail-frontend.jsString" . }}
{{- end }}
{{- end }}
{{- $sentry := $config.sentry | default dict }}
{{- $sentryDsn := $sentry.dsn | default $config.sentryDsn | default "" }}
{{- /*
One filled SENTRY_* key makes the configuration come from here, with no
fallback to the ecosystem of the server: nothing is written without a DSN
(unless sentry.enabled is false), which leaves it to the ecosystem.
*/}}
{{- if or (ne $sentryDsn "") (eq (toString $sentry.enabled) "false") }}
var SENTRY_ENABLED = {{ ternary "true" "false" (and (ne (toString $sentry.enabled) "false") (ne $sentryDsn "")) }}
var SENTRY_DSN = {{ include "twake-mail-frontend.jsString" $sentryDsn }}
var SENTRY_ENVIRONMENT = {{ include "twake-mail-frontend.jsString" ($sentry.environment | default "") }}
{{- end }}
{{- if eq (toString $sentry.feedbackEnabled) "true" }}
var SENTRY_FEEDBACK_ENABLED = "true"
{{- end }}
{{- with $config.appGridAvailable }}
var APP_GRID_AVAILABLE = {{ include "twake-mail-frontend.jsString" . }}
{{- end }}
var DEBUG = {{ ternary "true" "false" (eq (toString $config.debug) "true") }}
{{- with $config.lang }}
var LANG = {{ include "twake-mail-frontend.jsString" . }}
{{- end }}
{{- with $config.calendarSpaUrl }}
var CALENDAR_SPA_URL = {{ include "twake-mail-frontend.jsString" . }}
{{- end }}
{{- with $config.chatSpaUrl }}
var CHAT_SPA_URL = {{ include "twake-mail-frontend.jsString" . }}
{{- end }}
{{- with $config.workplaceFqdnFallback }}
var WORKPLACE_FQDN_FALLBACK = {{ include "twake-mail-frontend.jsString" . }}
{{- end }}
var WORKPLACE_EMBEDDING = {{ ternary "true" "false" (eq (toString $config.workplaceEmbedding) "true") }}
{{- with $config.twakeSpaceUrl }}
var TWAKE_SPACE_URL = {{ include "twake-mail-frontend.jsString" . }}
{{- end }}
{{- with $config.forwardWarningMessage }}
var FORWARD_WARNING_MESSAGE = {{ include "twake-mail-frontend.jsString" . }}
{{- end }}
{{- $tdrive := $config.tdrive | default dict }}
var TDRIVE_ENABLED = {{ ternary "true" "false" (eq (toString $tdrive.enabled) "true") }}
{{- with $tdrive.intentUrl }}
var TDRIVE_INTENT_URL = {{ include "twake-mail-frontend.jsString" . }}
{{- end }}
var TWAKE_BAR_ENABLED = {{ ternary "true" "false" (eq (toString $config.twakeBarEnabled) "true") }}
{{- with $config.extraEnvJs }}
{{ . | trim }}
{{- end }}
{{- end -}}

{{/*
appList.js: the applications of the app grid
*/}}
{{- define "twake-mail-frontend.appListJs" -}}
// Applications of the app grid of Twake Mail, rendered by the Helm chart
// {{ include "twake-mail-frontend.chart" . }} from its values (config.appList).
var appList = {{ .Values.config.appList | default list | toPrettyJson }}
{{- end -}}

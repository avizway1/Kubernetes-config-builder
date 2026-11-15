package main

import (
	"context"
	"fmt"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

const sampleService = `apiVersion: v1
kind: Service
metadata:
  name: demo
  namespace: lab
  annotations:
    prometheus.io/path: /metrics
spec:
  selector:
    app.kubernetes.io/name: demo
  ports:
    - port: 1
      targetPort: 65535
`

func TestUsageServiceFieldRules(t *testing.T) {
	for _, tc := range []struct{ version, before, after, field string }{
		{"1.37", "name: demo", "name: 'bad name!'", "name"},
		{"1.37", "name: demo", "name: '" + strings.Repeat("a", 64) + "'", "name"},
		{"1.37", "name: demo", "name: '" + strings.Repeat("a", 63) + "'", ""},
		{"1.35", "name: demo", "name: 2demo", "name"},
		{"1.36", "name: demo", "name: 2demo", ""},
		{"1.37", "name: demo", "name: 2demo", ""},
		{"1.37", "namespace: lab", "namespace: bad.lab", "namespace"},
		{"1.37", "namespace: lab", "namespace: ''", "namespace"},
		{"1.37", "app.kubernetes.io/name", "Upper.Prefix/name", "selectorKey"},
		{"1.37", "app.kubernetes.io/name: demo", "app.kubernetes.io/name: 'bad value'", "selectorValue"},
		{"1.37", "app.kubernetes.io/name: demo", "app.kubernetes.io/name: ''", ""},
		{"1.37", "port: 1", "port: 99999", "servicePort"},
		{"1.37", "targetPort: 65535", "targetPort: 0", "targetPort"},
		{"1.37", "targetPort: 65535", "targetPort: 65535.5", "targetPort"},
		{"1.37", "targetPort: 65535", "targetPort: ''", "targetPort"},
		{"1.37", "port: 1", "port: 65535", ""},
		{"1.37", "targetPort: 65535", "targetPort: 1", ""},
		{"1.37", "/metrics", "metrics", "metricsPath"},
	} {
		t.Run(tc.version+"/"+tc.after, func(t *testing.T) {
			doc, err := usageDocument(strings.Replace(sampleService, tc.before, tc.after, 1))
			if err != nil {
				t.Fatal(err)
			}
			assertUsageField(t, validateServiceFields(doc, tc.version), tc.field)
		})
	}
}

func TestUsageArgoFieldRules(t *testing.T) {
	const sample = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: demo
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/demo.git
    path: fixture
  destination:
    server: https://kubernetes.default.svc
    namespace: lab
`
	for _, tc := range []struct{ before, after, field string }{
		{"name: demo", "name: 'My First App'", "name"},
		{"name: demo", "name: ''", "name"},
		{"name: demo", "name: demo.v1", ""},
		{"name: demo", "name: '" + strings.Repeat("a", 253) + "'", ""},
		{"project: default", "project: ''", "project"},
		{"https://github.com/org/demo.git", "not-a-url", "repoURL"},
		{"https://github.com/org/demo.git", "git@github.com:org/demo.git", ""},
		{"path: fixture", "path: '../outside'", "path"},
		{"path: fixture", "path: '.'", ""},
		{"https://kubernetes.default.svc", "not-a-server", "destinationServer"},
		{"namespace: lab", "namespace: 'bad.lab'", "destinationNamespace"},
	} {
		t.Run(tc.after, func(t *testing.T) {
			doc, err := usageDocument(strings.Replace(sample, tc.before, tc.after, 1))
			if err != nil {
				t.Fatal(err)
			}
			assertUsageField(t, validateArgoFields(doc, "Application", true), tc.field)
		})
	}
}

func TestUsageApplicationSetChecksListInputs(t *testing.T) {
	const applicationSet = `apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: demo
  namespace: argocd
spec:
  goTemplate: true
  generators:
    - list:
        elements:
          - environment: dev
          - environment: staging
  template:
    metadata:
      name: 'demo-{{ .environment }}'
    spec:
      project: default
      source:
        repoURL: https://github.com/org/demo.git
        path: fixture
      destination:
        server: https://kubernetes.default.svc
        namespace: 'demo-{{ .%s }}'
`
	for input, field := range map[string]string{"environment": "", "env": "destinationNamespace"} {
		t.Run(input, func(t *testing.T) {
			doc, err := usageDocument(fmt.Sprintf(applicationSet, input))
			if err != nil {
				t.Fatal(err)
			}
			assertUsageField(t, validateArgoFields(doc, "ApplicationSet", true), field)
		})
	}
}

func TestUsageReportsCompletedAndUnavailableChecks(t *testing.T) {
	req := renderRequest{Tool: "prometheus", UsageTemplate: "service-scrape", KubernetesVersion: "1.37", Values: sampleService}
	result := validatePrometheusUsage(context.Background(), "", filepath.Join(t.TempDir(), "missing"), req)
	if result.Status != "incomplete" || !slices.Equal(result.Completed, []string{usageFieldCheck}) {
		t.Fatalf("expected completed local rules and incomplete schema check, got %+v", result)
	}
	req.Values = strings.Replace(sampleService, "port: 1", "port: 99999", 1)
	result = validatePrometheusUsage(context.Background(), "", filepath.Join(t.TempDir(), "missing"), req)
	if result.Status != "error" || len(result.Completed) != 0 {
		t.Fatalf("expected field failure before running the schema check, got %+v", result)
	}
	assertUsageField(t, result.Diagnostics, "servicePort")
}

func assertUsageField(t *testing.T, issues []diagnostic, field string) {
	t.Helper()
	if field == "" {
		if len(issues) != 0 {
			t.Fatalf("expected no issues, got %+v", issues)
		}
		return
	}
	if !slices.ContainsFunc(issues, func(issue diagnostic) bool {
		return issue.Field == field && issue.Severity == "error" && issue.Message != ""
	}) {
		t.Fatalf("expected an actionable problem on %s, got %+v", field, issues)
	}
}

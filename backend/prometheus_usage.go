package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"go.yaml.in/yaml/v3"
	"k8s.io/apimachinery/pkg/api/validate/content"
	kubevalidation "k8s.io/apimachinery/pkg/util/validation"
)

type prometheusUsageValues struct {
	ScrapeConfigs map[string]struct {
		Enabled        bool   `yaml:"enabled"`
		ScrapeInterval string `yaml:"scrape_interval"`
		MetricsPath    string `yaml:"metrics_path"`
		Scheme         string `yaml:"scheme"`
		StaticConfigs  []struct {
			Targets []string `yaml:"targets"`
		} `yaml:"static_configs"`
	} `yaml:"scrapeConfigs,omitempty"`
	ServerFiles *struct {
		AlertingRules struct {
			Groups []struct {
				Name  string `yaml:"name"`
				Rules []struct {
					Alert  string `yaml:"alert"`
					Expr   string `yaml:"expr"`
					For    string `yaml:"for"`
					Labels struct {
						Severity string `yaml:"severity"`
					} `yaml:"labels"`
					Annotations struct {
						Summary string `yaml:"summary"`
					} `yaml:"annotations"`
				} `yaml:"rules"`
			} `yaml:"groups"`
		} `yaml:"alerting_rules.yml"`
	} `yaml:"serverFiles,omitempty"`
}

var usageJobName = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]*$`)

type prometheusUsageFieldErrors []diagnostic

func (issues prometheusUsageFieldErrors) Error() string {
	return issues[0].Message
}

func validScrapeTarget(target string) bool {
	host := target
	if strings.Contains(target, ":") {
		var port string
		var err error
		host, port, err = net.SplitHostPort(target)
		if err != nil {
			return false
		}
		number, err := strconv.Atoi(port)
		if err != nil || len(kubevalidation.IsValidPortNum(number)) != 0 {
			return false
		}
	}
	return net.ParseIP(host) != nil || len(content.IsDNS1123SubdomainCaseless(strings.TrimSuffix(host, "."))) == 0
}

func readPrometheusUsageValues(req renderRequest) (string, error) {
	var values prometheusUsageValues
	decoder := yaml.NewDecoder(strings.NewReader(req.Values))
	decoder.KnownFields(true)
	if err := decoder.Decode(&values); err != nil {
		return "", err
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return "", fmt.Errorf("provide exactly one Helm values document")
	}
	var rules usageFieldRules
	switch req.UsageTemplate {
	case "scrape-job":
		if len(values.ScrapeConfigs) != 1 || values.ServerFiles != nil {
			return "", fmt.Errorf("provide one custom scrape job under scrapeConfigs")
		}
		for name, job := range values.ScrapeConfigs {
			rules.require("jobName", "Choose a unique job name starting with a letter or digit. Use letters, digits, hyphens, or underscores.", usageJobName.MatchString(name) && !slices.Contains([]string{
				"prometheus", "kubernetes-api-servers", "kubernetes-nodes", "kubernetes-nodes-cadvisor",
				"kubernetes-service-endpoints", "kubernetes-service-endpoints-slow", "prometheus-pushgateway",
				"kubernetes-services", "kubernetes-pods", "kubernetes-pods-slow",
			}, name))
			if !job.Enabled || len(job.StaticConfigs) != 1 || len(job.StaticConfigs[0].Targets) != 1 {
				return "", fmt.Errorf("provide an enabled scrape job with one static target")
			}
			rules.require("interval", "Enter a scrape interval, such as 30s.", strings.TrimSpace(job.ScrapeInterval) != "")
			rules.require("metricsPath", "Enter an absolute URL path, such as /metrics.", validMetricsPath(job.MetricsPath))
			rules.require("scheme", "Choose http or https.", job.Scheme == "http" || job.Scheme == "https")
			rules.require("target", "Enter a host or a host and port, such as metrics.default.svc:9090. Use brackets around IPv6 addresses followed by a port.", validScrapeTarget(job.StaticConfigs[0].Targets[0]))
		}
	case "alert-rule":
		if len(values.ScrapeConfigs) != 0 || values.ServerFiles == nil ||
			len(values.ServerFiles.AlertingRules.Groups) == 0 {
			return "", fmt.Errorf("provide alert rules under serverFiles.alerting_rules.yml.groups")
		}
		for _, group := range values.ServerFiles.AlertingRules.Groups {
			rules.require("groupName", "Enter a rule group name, such as metrics-demo.", strings.TrimSpace(group.Name) != "")
			for _, rule := range group.Rules {
				rules.require("alertName", "Enter an alert name, such as DemoTargetDown.", strings.TrimSpace(rule.Alert) != "")
				rules.require("expression", "Enter a PromQL expression, such as up == 0.", strings.TrimSpace(rule.Expr) != "")
			}
		}
	default:
		return "", fmt.Errorf("select a supported Prometheus usage template")
	}
	if len(rules) != 0 {
		return "", prometheusUsageFieldErrors(rules)
	}
	// Render only the decoded fields. The chart applies tpl to some other values.
	encoded, err := yaml.Marshal(values)
	return string(encoded), err
}

func validatePrometheusUsage(ctx context.Context, chartDir, schemaDir string, req renderRequest) validationResult {
	result := validationResult{Status: "passed", Diagnostics: []diagnostic{}}
	if !slices.Contains([]string{"1.35", "1.36", "1.37"}, req.KubernetesVersion) {
		result.add("Kubernetes version", "error", "Select a supported Kubernetes version.")
		return result
	}

	if req.UsageTemplate == "service-scrape" {
		doc, err := usageDocument(req.Values)
		if err != nil || usageText(usageNode(doc, "kind")) != "Service" || usageText(usageNode(doc, "apiVersion")) != "v1" {
			result.add("Service schema", "error", "Provide exactly one Kubernetes v1 Service.")
			return result
		}
		result.recordCheck(usageFieldCheck, validateServiceFields(doc, req.KubernetesVersion))
		if result.Status == "error" {
			return result
		}
		result.recordCheck("Kubernetes Service schema", validateSchemas(ctx, schemaDir, req.KubernetesVersion, req.Values))
		return result
	}

	values, err := readPrometheusUsageValues(req)
	if err != nil {
		var fieldErrors prometheusUsageFieldErrors
		if errors.As(err, &fieldErrors) {
			result.recordCheck(usageFieldCheck, fieldErrors)
		} else {
			result.add("Helm values", "error", err.Error())
		}
		return result
	}
	result.Completed = append(result.Completed, usageFieldCheck)
	req.Values = values
	manifest, err := render(ctx, chartDir, req)
	if err != nil {
		issue := renderDiagnostic(req, err)
		result.add(issue.Check, issue.Severity, issue.Message)
		return result
	}
	result.Completed = append(result.Completed, "Helm render with the pinned chart")
	if issue := checkRenderedPrometheus(ctx, manifest, req.UsageTemplate); issue != nil {
		result.addDiagnostic(*issue)
	} else if req.UsageTemplate == "alert-rule" {
		result.Completed = append(result.Completed, "promtool configuration and rule syntax")
	} else {
		result.Completed = append(result.Completed, "promtool configuration syntax")
	}
	return result
}

func checkRenderedPrometheus(ctx context.Context, manifest, template string) *diagnostic {
	const check = "promtool"
	binary, err := exec.LookPath("promtool")
	if err != nil {
		return &diagnostic{Check: check, Severity: "incomplete", Message: "Install the pinned promtool and make it available on the backend PATH."}
	}
	config, err := renderedPrometheusConfig(manifest)
	if err != nil {
		return &diagnostic{Check: check, Severity: "error", Message: err.Error()}
	}
	dir, err := os.MkdirTemp("", "kcb-promtool-")
	if err != nil {
		return &diagnostic{Check: check, Severity: "incomplete", Message: err.Error()}
	}
	defer os.RemoveAll(dir)
	commands := [][]string{{"check", "config", "--syntax-only", "prometheus.yml"}}
	if template == "alert-rule" {
		commands = append(commands, []string{"check", "rules", "alerting_rules.yml"})
	}
	for _, args := range commands {
		filename := args[len(args)-1]
		if config[filename] == "" {
			return &diagnostic{Check: check, Severity: "error", Message: "The pinned chart did not render " + filename + "."}
		}
		if err := os.WriteFile(filepath.Join(dir, filename), []byte(config[filename]), 0600); err != nil {
			return &diagnostic{Check: check, Severity: "incomplete", Message: err.Error()}
		}
		cmd := exec.CommandContext(ctx, binary, args...)
		cmd.Dir = dir
		if output, err := cmd.CombinedOutput(); err != nil {
			message := strings.TrimSpace(string(output))
			if ctx.Err() != nil || message == "" {
				return &diagnostic{Check: check, Severity: "incomplete", Message: fmt.Sprintf("Prometheus validation did not complete: %v", err)}
			}
			issue := diagnostic{Check: check, Severity: "error", Message: message}
			switch {
			case template == "scrape-job" && (strings.Contains(message, "scrape_interval") || strings.Contains(message, "not a valid duration string")):
				issue.Field = "interval"
			case template == "alert-rule" && strings.Contains(message, "could not parse expression"):
				issue.Field = "expression"
			}
			return &issue
		}
	}
	return nil
}

func renderedPrometheusConfig(manifest string) (map[string]string, error) {
	resources, err := manifestResources(manifest)
	if err != nil {
		return nil, err
	}
	for _, resource := range resources {
		if resource.id.Kind != "ConfigMap" || resource.id.Name != "prometheus-server" {
			continue
		}
		var config struct {
			Data map[string]string
		}
		if err := yaml.Unmarshal([]byte(strings.Join(resource.lines, "\n")), &config); err != nil {
			return nil, err
		}
		return config.Data, nil
	}
	return nil, fmt.Errorf("the pinned chart did not render its Prometheus server ConfigMap")
}

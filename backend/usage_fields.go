package main

import (
	"fmt"
	"io"
	"net/url"
	"regexp"
	"strings"
	"unicode"

	"go.yaml.in/yaml/v3"
	"k8s.io/apimachinery/pkg/api/validate/content"
	kubevalidation "k8s.io/apimachinery/pkg/util/validation"
)

const usageFieldCheck = "usage field rules"

func usageDocument(text string) (*yaml.Node, error) {
	decoder := yaml.NewDecoder(strings.NewReader(text))
	var doc yaml.Node
	if err := decoder.Decode(&doc); err != nil {
		return nil, fmt.Errorf("read the generated YAML: %w", err)
	}
	if len(doc.Content) != 1 || doc.Content[0].Kind != yaml.MappingNode || decoder.Decode(new(yaml.Node)) != io.EOF {
		return nil, fmt.Errorf("provide exactly one YAML object")
	}
	return doc.Content[0], nil
}

func usageNode(node *yaml.Node, keys ...string) *yaml.Node {
	for _, key := range keys {
		if node == nil || node.Kind != yaml.MappingNode {
			return nil
		}
		var value *yaml.Node
		for i := 0; i+1 < len(node.Content); i += 2 {
			if node.Content[i].Value == key {
				value = node.Content[i+1]
				break
			}
		}
		node = value
	}
	return node
}

func usageSequence(node *yaml.Node) []*yaml.Node {
	if node == nil || node.Kind != yaml.SequenceNode {
		return nil
	}
	return node.Content
}

func usageText(node *yaml.Node) string {
	if node == nil || node.Kind != yaml.ScalarNode || node.ShortTag() != "!!str" {
		return ""
	}
	return node.Value
}

func usageFieldError(field, message string) diagnostic {
	return diagnostic{Check: usageFieldCheck, Severity: "error", Message: message, Field: field}
}

type usageFieldRules []diagnostic

func (rules *usageFieldRules) require(field, message string, ok bool) {
	if !ok {
		*rules = append(*rules, usageFieldError(field, message))
	}
}

func (rules *usageFieldRules) namespace(field, name string) {
	rules.require(field, "Use 1–63 lowercase letters, digits, or hyphens. Start and end with a letter or digit.", len(content.IsDNS1123Label(name)) == 0)
}

func (rules *usageFieldRules) objectName(field, name string) {
	rules.require(field, "Use 1–253 lowercase letters, digits, dots, or hyphens. Start and end each dot-separated part with a letter or digit.", len(content.IsDNS1123Subdomain(name)) == 0)
}

func (rules *usageFieldRules) identity(doc *yaml.Node, kind, version string, form bool) {
	name := usageText(usageNode(doc, "metadata", "name"))
	if kind == "Service" {
		valid := len(content.IsDNS1123Label(name)) == 0
		message := "Use 1–63 lowercase letters, digits, or hyphens. Start and end with a letter or digit."
		// RelaxedServiceNameValidation is disabled by default in 1.35, enabled in 1.36, and stable in 1.37.
		if version == "1.35" {
			valid = len(kubevalidation.IsDNS1035Label(name)) == 0
			message = "For Kubernetes 1.35, use 1–63 lowercase letters, digits, or hyphens. Start with a letter and end with a letter or digit."
		}
		rules.require("name", message, valid)
	} else {
		rules.objectName("name", name)
	}
	namespace := usageText(usageNode(doc, "metadata", "namespace"))
	// The UI always emits a namespace. A caller supplying its own YAML can let kubectl default it.
	if form || usageNode(doc, "metadata", "namespace") != nil {
		rules.namespace("namespace", namespace)
	}
}

func validMetricsPath(value string) bool {
	if !strings.HasPrefix(value, "/") || strings.HasPrefix(value, "//") || strings.ContainsAny(value, "?#") || strings.ContainsFunc(value, unicode.IsSpace) {
		return false
	}
	_, err := url.ParseRequestURI(value)
	return err == nil
}

func validateServiceFields(doc *yaml.Node, version string) []diagnostic {
	var rules usageFieldRules
	rules.identity(doc, "Service", version, false)
	selector := usageNode(doc, "spec", "selector")
	if selector == nil || selector.Kind != yaml.MappingNode || len(selector.Content) == 0 {
		rules.require("selectorKey", "Add the Pod label key used to select the metrics workload.", false)
	} else {
		for i := 0; i+1 < len(selector.Content); i += 2 {
			key, val := selector.Content[i], selector.Content[i+1]
			rules.require("selectorKey", "Use a Kubernetes label key such as app or app.kubernetes.io/name.", len(content.IsLabelKey(usageText(key))) == 0)
			rules.require("selectorValue", "Use a label value such as metrics-demo. A nonempty value must start and end with a letter or digit and use at most 63 characters.", val.ShortTag() == "!!str" && len(content.IsLabelValue(val.Value)) == 0)
		}
	}
	ports := usageSequence(usageNode(doc, "spec", "ports"))
	if len(ports) == 0 {
		rules.require("servicePort", "Enter a whole number from 1 to 65535.", false)
	}
	for _, entry := range ports {
		for _, port := range []struct{ key, field string }{{"port", "servicePort"}, {"targetPort", "targetPort"}} {
			var n int
			value := usageNode(entry, port.key)
			rules.require(port.field, "Enter a whole number from 1 to 65535.", value != nil && value.ShortTag() == "!!int" && value.Decode(&n) == nil && len(kubevalidation.IsValidPortNum(n)) == 0)
		}
	}
	annotations := usageNode(doc, "metadata", "annotations")
	if path := usageNode(annotations, "prometheus.io/path"); path != nil {
		rules.require("metricsPath", "Enter an absolute URL path, such as /metrics.", validMetricsPath(usageText(path)))
	}
	if scheme := usageNode(annotations, "prometheus.io/scheme"); scheme != nil {
		rules.require("scheme", "Choose http or https.", usageText(scheme) == "http" || usageText(scheme) == "https")
	}
	return rules
}

var scpRepository = regexp.MustCompile(`^[^\s:/@]+@[^\s:/@]+:[^\s:]+$`)

func validRepository(value string, allowPattern bool) bool {
	if allowPattern {
		if value == "*" || value == "**" {
			return true
		}
		value = strings.TrimPrefix(value, "!")
		value = strings.ReplaceAll(value, "*", "x")
	}
	if scpRepository.MatchString(value) {
		return true
	}
	parsed, err := url.Parse(value)
	return err == nil && parsed.Hostname() != "" && parsed.Path != "" &&
		(parsed.Scheme == "https" || parsed.Scheme == "http" || parsed.Scheme == "ssh" || parsed.Scheme == "git") &&
		!strings.ContainsFunc(value, unicode.IsSpace)
}

func validDestinationServer(value string, allowPattern bool) bool {
	if allowPattern {
		value = strings.TrimPrefix(value, "!")
		if value == "*" {
			return true
		}
		value = strings.ReplaceAll(value, "*", "x")
	}
	parsed, err := url.Parse(value)
	return err == nil && parsed.Hostname() != "" && (parsed.Scheme == "https" || parsed.Scheme == "http") &&
		parsed.RawQuery == "" && parsed.Fragment == "" && !strings.ContainsFunc(value, unicode.IsSpace)
}

func (rules *usageFieldRules) argoApplication(spec *yaml.Node, form, generated bool) {
	source := usageNode(spec, "source")
	repo := usageNode(source, "repoURL")
	if form || repo != nil {
		rules.require("repoURL", "Enter an HTTPS or SSH Git repository address, such as https://github.com/org/repo.git.", validRepository(usageText(repo), false) || generated && strings.Contains(usageText(repo), "{{"))
	}
	if form {
		path := usageText(usageNode(source, "path"))
		rules.require("path", "Enter a directory relative to the repository, or . for its root.", path != "" && !strings.HasPrefix(path, "/") && !strings.HasPrefix(path, "../") && !strings.Contains(path, "/../") && !strings.HasSuffix(path, "/..") && path != "..")
	}
	if project := usageNode(spec, "project"); form || project != nil {
		if name := usageText(project); !(generated && strings.Contains(name, "{{")) {
			rules.objectName("project", name)
		}
	}
	destination := usageNode(spec, "destination")
	if server := usageNode(destination, "server"); form || server != nil {
		value := usageText(server)
		rules.require("destinationServer", "Enter the Kubernetes API URL, such as https://kubernetes.default.svc.", validDestinationServer(value, false) || generated && strings.Contains(value, "{{"))
	}
	if namespace := usageNode(destination, "namespace"); !generated && (form || namespace != nil) {
		rules.namespace("destinationNamespace", usageText(namespace))
	}
}

var listInput = regexp.MustCompile(`{{-?\s*\.([A-Za-z0-9_]+)\s*-?}}`)

// Check direct references and expansions from the two-row list generator. The controller evaluates any more complex Go template expressions.
func (rules *usageFieldRules) argoListExpansion(field, pattern string, elements []*yaml.Node, name bool) {
	for _, ref := range listInput.FindAllStringSubmatch(pattern, -1) {
		for _, element := range elements {
			if usageNode(element, ref[1]) == nil {
				rules.require(field, "Use a list input that exists. In this form, use {{ .environment }}.", false)
				return
			}
		}
	}
	for _, element := range elements {
		expanded := listInput.ReplaceAllStringFunc(pattern, func(token string) string {
			return usageText(usageNode(element, listInput.FindStringSubmatch(token)[1]))
		})
		if strings.Contains(expanded, "{{") {
			continue
		}
		if name {
			rules.objectName(field, expanded)
		} else {
			rules.namespace(field, expanded)
		}
	}
}

func validateArgoFields(doc *yaml.Node, kind string, form bool) []diagnostic {
	var rules usageFieldRules
	rules.identity(doc, kind, "", form)
	spec := usageNode(doc, "spec")
	switch kind {
	case "Application":
		rules.argoApplication(spec, form, false)
	case "AppProject":
		repositories := usageSequence(usageNode(spec, "sourceRepos"))
		destinations := usageSequence(usageNode(spec, "destinations"))
		if form {
			rules.require("repoURL", "Enter an allowed Git repository or repository pattern.", len(repositories) > 0)
			rules.require("destinationServer", "Enter an allowed Kubernetes API URL.", len(destinations) > 0)
		}
		for _, repo := range repositories {
			rules.require("repoURL", "Enter an allowed Git repository or repository pattern, such as https://github.com/org/*.", validRepository(usageText(repo), true))
		}
		for _, dest := range destinations {
			server, namespace := usageNode(dest, "server"), usageNode(dest, "namespace")
			if form || server != nil {
				rules.require("destinationServer", "Enter an allowed Kubernetes API URL or server pattern.", validDestinationServer(usageText(server), true))
			}
			if form || namespace != nil {
				pattern := strings.ReplaceAll(strings.TrimPrefix(usageText(namespace), "!"), "*", "x")
				rules.namespace("destinationNamespace", pattern)
			}
		}
	case "ApplicationSet":
		application := usageNode(spec, "template", "spec")
		rules.argoApplication(application, form, true)
		for _, generator := range usageSequence(usageNode(spec, "generators")) {
			elements := usageSequence(usageNode(generator, "list", "elements"))
			if len(elements) == 0 {
				continue
			}
			if form && len(elements) == 2 {
				first, second := usageText(usageNode(elements[0], "environment")), usageText(usageNode(elements[1], "environment"))
				rules.require("firstEnvironment", "Enter an environment name, such as dev.", first != "")
				rules.require("secondEnvironment", "Enter a different environment name, such as staging.", second != "" && second != first)
			}
			rules.argoListExpansion("name", usageText(usageNode(spec, "template", "metadata", "name")), elements, true)
			rules.argoListExpansion("destinationNamespace", usageText(usageNode(application, "destination", "namespace")), elements, false)
		}
	}
	return rules
}

// The dashboard server. It serves the built lessons, labs, and setup page on localhost.
package main

import (
	"flag"
	"log"
	"net/http"
	"strings"
	"time"
)

func main() {
	listen := flag.String("listen", "127.0.0.1:8080", "HTTP listen address")
	webDir := flag.String("web", "../frontend/dist", "directory containing the built frontend")
	flag.Parse()

	server := &http.Server{Addr: *listen, Handler: webHandler(*webDir), ReadHeaderTimeout: 5 * time.Second}
	log.Printf("Learning Kubernetes made easy is listening on %s", server.Addr)
	log.Fatal(server.ListenAndServe())
}

// webHandler serves the built frontend. Vite puts a content hash in every file name under /assets/, so those files
// can be cached for a year. Every other file, including index.html, is checked with the server on each visit, so a
// rebuilt dashboard shows up without a hard refresh.
func webHandler(dir string) http.Handler {
	files := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		files.ServeHTTP(w, r)
	})
}

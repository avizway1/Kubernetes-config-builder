import lab1Guide from '../../docs/lab-1-hello-kubernetes.md?raw';
import lab2Guide from '../../docs/lab-2-your-app-on-eks.md?raw';
import helloYaml from '../../templates/kubernetes/labs/hello.yaml?raw';
import helloEksClusterYaml from '../../templates/kubernetes/labs/hello-eks-cluster.yaml?raw';
import helloEksYaml from '../../templates/kubernetes/labs/hello-eks.yaml?raw';
import { readGuide, type Guide } from './guide-reader.ts';

// The lab files and guides as learners download and read them. The dashboard reads the same files
// that tests/lab-guide.check.mjs runs, so the page shows exactly the tested commands.
export const labFiles: Record<string, string> = {
  'hello.yaml': helloYaml,
  'hello-eks-cluster.yaml': helloEksClusterYaml,
  'hello-eks.yaml': helloEksYaml,
};

export const labGuides: Record<string, Guide> = {
  'lab-1': readGuide(lab1Guide),
  'lab-2': readGuide(lab2Guide),
};

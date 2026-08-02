export interface SuggestionDomain {
  id: string;
  label: string;
  keywords: string[];
  roles: string[];
  skills: string[];
}

export const SUGGESTION_DOMAINS: SuggestionDomain[] = [
  {
    id: 'devops',
    label: 'DevOps & Cloud',
    keywords: ['devops', 'sre', 'platform', 'cloud', 'release', 'infrastructure', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform', 'ci/cd', 'gitops'],
    roles: [
      'DevOps Engineer',
      'Senior DevOps Engineer',
      'DevSecOps Engineer',
      'Site Reliability Engineer (SRE)',
      'Platform Engineer',
      'Cloud Engineer',
      'Cloud Infrastructure Engineer',
      'Cloud Architect',
      'Release Engineer',
      'Build & Release Engineer',
      'Container Platform Engineer',
      'Infrastructure Engineer',
      'GitOps Engineer',
      'AWS Cloud Engineer',
      'Azure DevOps Engineer',
      'Kubernetes Engineer',
      'Linux Systems Engineer',
      'Observability Engineer',
    ],
    skills: ['Kubernetes', 'Terraform', 'AWS', 'GCP', 'Azure', 'CI/CD', 'Docker', 'Helm', 'ArgoCD', 'GitLab CI', 'Prometheus', 'Grafana', 'Ansible', 'Jenkins', 'Linux'],
  },
  {
    id: 'cybersecurity',
    label: 'Cybersecurity',
    keywords: ['security', 'cyber', 'soc', 'penetration', 'pentest', 'grc', 'threat', 'vulnerability', 'incident', 'appsec', 'devsecops', 'infosec', 'iam', 'malware', 'forensics', 'cryptography'],
    roles: [
      'Cyber Security Engineer',
      'Security Engineer',
      'Information Security Analyst',
      'Security Analyst',
      'SOC Analyst',
      'Penetration Tester',
      'Ethical Hacker',
      'DevSecOps Engineer',
      'Application Security Engineer',
      'Network Security Engineer',
      'Cloud Security Engineer',
      'Security Architect',
      'GRC Analyst',
      'Threat Intelligence Analyst',
      'Incident Responder',
      'Security Operations Engineer',
      'Malware Analyst',
      'Vulnerability Management Analyst',
      'IAM Security Engineer',
      'Digital Forensics Analyst',
      'Security Consultant',
    ],
    skills: ['NIST', 'SIEM', 'SOAR', 'Firewalls', 'IDS/IPS', 'Endpoint Security', 'IAM', 'Zero Trust', 'Vulnerability Management', 'Penetration Testing', 'OWASP', 'Kali Linux', 'Wireshark', 'Splunk', 'CrowdStrike', 'Compliance', 'GDPR', 'ISO 27001', 'Threat Hunting', 'Security Auditing'],
  },
  {
    id: 'software',
    label: 'Software Development',
    keywords: ['software', 'frontend', 'backend', 'fullstack', 'full-stack', 'web', 'mobile', 'react', 'node', 'python', 'java', 'javascript', 'typescript', 'api', 'developer', 'engineer'],
    roles: [
      'Software Engineer',
      'Frontend Developer',
      'Senior Frontend Developer',
      'Backend Engineer',
      'Full Stack Engineer',
      'Full Stack Developer',
      'Mobile App Developer (React Native)',
      'React Developer',
      'Node.js Developer',
      'Python Developer',
      'Java Developer',
      'API Engineer',
      'Web Developer',
      'Systems Software Engineer',
      'Senior Software Engineer',
      'Embedded Software Engineer',
      'Test Automation Engineer',
      'QA Engineer',
    ],
    skills: ['TypeScript', 'React', 'Node.js', 'Python', 'Java', 'JavaScript', 'GraphQL', 'REST APIs', 'PostgreSQL', 'MongoDB', 'Docker', 'Microservices', 'Tailwind CSS', 'Next.js', 'Vue.js', 'Cypress', 'Jest'],
  },
  {
    id: 'data',
    label: 'Data & AI',
    keywords: ['data', 'analyst', 'scientist', 'machine', 'ml', 'ai', 'analytics', 'bigdata', 'spark', 'pipeline'],
    roles: [
      'Data Engineer',
      'Data Scientist',
      'Data Analyst',
      'Business Intelligence Analyst',
      'Machine Learning Engineer',
      'AI Engineer',
      'MLOps Engineer',
      'Big Data Engineer',
      'Data Architect',
      'ETL Developer',
      'Analytics Engineer',
      'Data Platform Engineer',
    ],
    skills: ['Python', 'SQL', 'Spark', 'Kafka', 'Airflow', 'TensorFlow', 'PyTorch', 'dbt', 'Snowflake', 'BigQuery', 'Redshift', 'Pandas', 'Machine Learning', 'Statistics', 'Power BI', 'Tableau'],
  },
  {
    id: 'design',
    label: 'Design & UX',
    keywords: ['design', 'ux', 'ui', 'product design', 'figma', 'user experience', 'graphic'],
    roles: [
      'UI/UX Designer',
      'Product Designer',
      'UX Researcher',
      'Graphic Designer',
      'Web Designer',
      'Interaction Designer',
      'Motion Designer',
      'Design Lead',
      'Brand Designer',
    ],
    skills: ['Figma', 'Sketch', 'Adobe XD', 'Prototyping', 'Wireframing', 'User Research', 'Design Systems', 'HTML/CSS', 'Accessibility', 'Illustrator', 'Photoshop'],
  },
  {
    id: 'management',
    label: 'Management & Leadership',
    keywords: ['manager', 'lead', 'director', 'head', 'vp', 'cto', 'product owner', 'scrum'],
    roles: [
      'Product Manager',
      'Project Manager',
      'Engineering Manager',
      'Technical Lead',
      'Delivery Manager',
      'Product Owner',
      'Scrum Master',
      'Program Manager',
      'Head of Engineering',
      'Director of Engineering',
      'CTO',
      'VP of Engineering',
    ],
    skills: ['Agile', 'Scrum', 'Kanban', 'Jira', 'Roadmapping', 'Stakeholder Management', 'Budgeting', 'OKRs', 'Mentoring', 'Hiring'],
  },
  {
    id: 'database',
    label: 'Database & Storage',
    keywords: ['database', 'dba', 'sql', 'nosql', 'postgres', 'mysql', 'mongo', 'oracle', 'redis'],
    roles: [
      'Database Administrator',
      'SQL Developer',
      'Database Engineer',
      'Data Warehouse Engineer',
      'NoSQL Database Engineer',
      'PostgreSQL Administrator',
      'MongoDB Specialist',
      'Cloud Database Engineer',
    ],
    skills: ['SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Oracle', 'Cassandra', 'Elasticsearch', 'Query Optimization', 'Backup & Recovery', 'Replication', 'Sharding'],
  },
];

export const TRENDING_ROLES = [
  'DevOps Engineer',
  'DevSecOps Engineer',
  'Site Reliability Engineer (SRE)',
  'Cloud Engineer',
  'Platform Engineer',
  'Cyber Security Engineer',
  'Software Engineer',
  'Full Stack Engineer',
  'Data Engineer',
  'Frontend Developer',
  'Backend Engineer',
  'Product Manager',
];

export const TRENDING_KEYWORDS = [
  'Docker',
  'Kubernetes',
  'AWS',
  'Terraform',
  'Python',
  'React',
  'Node.js',
  'TypeScript',
  'CI/CD',
  'Linux',
];

export function detectDomains(query: string): SuggestionDomain[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matched: SuggestionDomain[] = [];
  for (const domain of SUGGESTION_DOMAINS) {
    const hit = domain.keywords.some((kw) => q.includes(kw) || kw.includes(q));
    if (hit) matched.push(domain);
  }
  return matched;
}

export function getRoleSuggestions(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return TRENDING_ROLES;

  const domains = detectDomains(query);
  if (domains.length === 0) {
    return TRENDING_ROLES.filter((r) => r.toLowerCase().includes(q)).slice(0, 10);
  }

  const roles = new Set<string>();
  for (const domain of domains) {
    const direct = domain.roles.filter((r) => r.toLowerCase().includes(q));
    if (direct.length > 0) {
      direct.slice(0, 10).forEach((r) => roles.add(r));
    }
  }

  if (roles.size === 0) {
    for (const domain of domains) {
      domain.roles.slice(0, 8).forEach((r) => roles.add(r));
    }
  }

  return [...roles].slice(0, 12);
}

export function getKeywordSuggestions(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return TRENDING_KEYWORDS;

  const domains = detectDomains(query);
  if (domains.length === 0) {
    return TRENDING_KEYWORDS.filter((k) => k.toLowerCase().includes(q)).slice(0, 10);
  }

  const skills = new Set<string>();
  for (const domain of domains) {
    domain.skills.filter((s) => s.toLowerCase().includes(q)).slice(0, 8).forEach((s) => skills.add(s));
  }
  if (skills.size === 0) {
    for (const domain of domains) {
      domain.skills.slice(0, 6).forEach((s) => skills.add(s));
    }
  }
  return [...skills].slice(0, 12);
}

export const PREDEFINED_ROLES = TRENDING_ROLES;
export const PREDEFINED_KEYWORDS = TRENDING_KEYWORDS;

export const PREDEFINED_LOCATIONS = [
  'Worldwide',
  'Europe',
  'Asia',
  'North America',
  'Singapore',
  'Kolkata, INDIA',
  'Bengaluru, INDIA',
  'San Francisco, CA',
  'New York, NY',
  'London, UK',
];

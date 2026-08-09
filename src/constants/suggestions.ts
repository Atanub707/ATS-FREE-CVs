// Generic job-search suggestions — a broad, industry-wide static dataset.
// No packages, no API: ~1,000 job titles and ~600 skills (inspired by open
// taxonomies such as O*NET and ESCO), matched with prefix-priority scoring.

export interface SuggestionDomain {
  id: string;
  label: string;
  keywords: string[];
  roles: string[];
  skills: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Job titles — ~1,000, across every industry
// ────────────────────────────────────────────────────────────────────────────

export const JOB_TITLES: string[] = [
  // ── DevOps, SRE & Cloud ──
  'DevOps Engineer', 'Senior DevOps Engineer', 'Junior DevOps Engineer', 'DevOps Architect', 'DevOps Manager',
  'DevSecOps Engineer', 'DevSecOps Architect', 'DevSecOps Manager',
  'Site Reliability Engineer (SRE)', 'Senior SRE', 'SRE Manager', 'Principal SRE',
  'Cloud Engineer', 'Senior Cloud Engineer', 'Cloud Architect', 'Cloud Infrastructure Engineer',
  'Cloud Platform Engineer', 'Cloud Solutions Architect', 'Cloud Security Engineer', 'Cloud Network Engineer',
  'Platform Engineer', 'Senior Platform Engineer', 'Principal Platform Engineer', 'Platform Architect',
  'Release Engineer', 'Build and Release Engineer', 'Release Manager',
  'Container Platform Engineer', 'Kubernetes Engineer', 'Kubernetes Administrator', 'Container Architect',
  'AWS Engineer', 'AWS Cloud Engineer', 'AWS Architect', 'AWS DevOps Engineer',
  'Azure Engineer', 'Azure DevOps Engineer', 'Azure Solutions Architect',
  'GCP Engineer', 'Google Cloud Engineer', 'Google Cloud Architect',
  'Infrastructure Engineer', 'Infrastructure Architect', 'Infrastructure Manager',
  'Linux Engineer', 'Linux Systems Engineer', 'Unix Administrator', 'Linux Administrator',
  'Observability Engineer', 'Monitoring Engineer', 'SRE Tools Engineer',
  'GitOps Engineer', 'IaC Engineer', 'Automation Engineer', 'Automation Architect',
  'Site Reliability Manager', 'Cloud Operations Engineer', 'Cloud Operations Manager',
  'DevOps Consultant', 'Cloud Consultant', 'SRE Consultant',

  // ── Software Engineering ──
  'Software Engineer', 'Senior Software Engineer', 'Staff Software Engineer', 'Principal Software Engineer',
  'Software Engineer II', 'Software Engineer III', 'Software Developer', 'Junior Software Engineer',
  'Software Architect', 'Software Engineering Manager', 'Engineering Manager', 'VP of Engineering',
  'Backend Engineer', 'Backend Developer', 'Senior Backend Engineer', 'Backend Architect',
  'Frontend Engineer', 'Frontend Developer', 'Senior Frontend Developer', 'Lead Frontend Engineer', 'Frontend Architect',
  'Full Stack Engineer', 'Full Stack Developer', 'Senior Full Stack Engineer', 'Lead Full Stack Developer',
  'Full Stack Architect', 'Web Developer', 'Web Engineer', 'Web Architect',
  'Application Developer', 'Application Engineer', 'Software Development Engineer',
  'API Engineer', 'API Developer', 'Integration Engineer', 'Integration Architect',
  'Systems Engineer', 'Systems Architect', 'Systems Software Engineer',
  'Embedded Software Engineer', 'Embedded Systems Engineer', 'Firmware Engineer', 'Hardware Engineer',
  'Mobile Developer', 'Mobile Engineer', 'iOS Developer', 'iOS Engineer', 'Android Developer', 'Android Engineer',
  'React Native Developer', 'Flutter Developer', 'Cross Platform Developer',
  'Game Developer', 'Game Engineer', 'Unity Developer', 'Unreal Engine Developer', 'Gameplay Engineer',
  'Graphics Engineer', 'Computer Vision Engineer', 'Realtime Systems Engineer',
  'Platform Software Engineer', 'Core Software Engineer', 'Research Software Engineer',
  'Software Consultant', 'Technical Consultant', 'Solutions Consultant', 'Implementation Engineer',
  'Desktop Application Developer', 'Client Side Engineer', 'Compiler Engineer', 'DevTools Engineer',
  'Streaming Engineer', 'Telecommunications Engineer', 'Network Software Engineer',

  // ── QA & Testing ──
  'QA Engineer', 'QA Tester', 'QA Analyst', 'QA Lead', 'QA Manager', 'QA Architect',
  'Software Tester', 'Test Engineer', 'Test Automation Engineer', 'SDET', 'SDET Lead',
  'Automation Tester', 'Performance Tester', 'Load Tester', 'Security Tester', 'Penetration Test Engineer',
  'Manual Tester', 'Mobile Tester', 'Usability Tester', 'Quality Analyst', 'Quality Assurance Lead',
  'Test Manager', 'Head of Quality Assurance', 'CI Tester', 'API Tester', 'Accessibility Tester',

  // ── Data ──
  'Data Engineer', 'Senior Data Engineer', 'Lead Data Engineer', 'Data Engineering Manager',
  'Data Architect', 'Data Warehouse Engineer', 'Data Platform Engineer', 'Data Infrastructure Engineer',
  'Data Analyst', 'Senior Data Analyst', 'Business Data Analyst', 'Data Analyst II',
  'Data Scientist', 'Senior Data Scientist', 'Lead Data Scientist', 'Principal Data Scientist',
  'Data Science Manager', 'Applied Scientist', 'Research Scientist', 'ML Scientist',
  'Machine Learning Engineer', 'Senior ML Engineer', 'MLOps Engineer', 'ML Platform Engineer',
  'AI Engineer', 'AI/ML Engineer', 'Generative AI Engineer', 'LLM Engineer', 'Prompt Engineer',
  'NLP Engineer', 'Speech Engineer', 'Computer Vision Scientist', 'Deep Learning Engineer',
  'Database Administrator', 'Senior DBA', 'Database Engineer', 'Database Architect',
  'Database Developer', 'SQL Developer', 'PostgreSQL Developer', 'MySQL Developer',
  'Data Modeler', 'Data Steward', 'Data Governance Analyst', 'Data Governance Manager',
  'Business Intelligence Analyst', 'BI Developer', 'BI Engineer', 'BI Manager',
  'Business Intelligence Architect', 'Analytics Engineer', 'Analytics Manager',
  'Data Visualization Specialist', 'Tableau Developer', 'Power BI Developer', 'Looker Developer',
  'ETL Developer', 'Data Pipeline Engineer', 'Streaming Data Engineer', 'Data Quality Engineer',
  'Chief Data Officer', 'Director of Data', 'Head of Data Engineering', 'Head of Data Science',

  // ── Cybersecurity ──
  'Cyber Security Engineer', 'Cybersecurity Engineer', 'Information Security Engineer', 'Security Engineer',
  'Security Analyst', 'Information Security Analyst', 'Cyber Security Analyst', 'Security Operations Analyst',
  'SOC Analyst', 'SOC Tier 1 Analyst', 'SOC Tier 2 Analyst', 'SOC Tier 3 Analyst', 'SOC Manager',
  'Penetration Tester', 'Penetration Testing Engineer', 'Ethical Hacker', 'Offensive Security Engineer',
  'Red Team Operator', 'Blue Team Analyst', 'Purple Team Engineer', 'Threat Hunter',
  'Incident Responder', 'Incident Response Analyst', 'Incident Response Manager', 'Digital Forensics Analyst',
  'Malware Analyst', 'Reverse Engineer', 'Threat Intelligence Analyst', 'Threat Intelligence Manager',
  'AppSec Engineer', 'Application Security Engineer', 'Application Security Analyst', 'DevSecOps Security Engineer',
  'Cloud Security Architect', 'Cloud Security Analyst', 'Network Security Engineer', 'Network Security Analyst',
  'Security Architect', 'Enterprise Security Architect', 'Security Consultant', 'Security Advisor',
  'Security Manager', 'Security Director', 'Chief Information Security Officer', 'CISO',
  'GRC Analyst', 'Governance Risk and Compliance Analyst', 'Compliance Analyst', 'Compliance Manager',
  'IAM Engineer', 'Identity and Access Management Analyst', 'Identity and Access Management Architect',
  'Vulnerability Management Analyst', 'Vulnerability Management Engineer', 'Security Auditor', 'Security Assessor',
  'Cryptographer', 'Cryptographic Engineer', 'Security Researcher', 'Exploit Developer', 'Zero Trust Architect',

  // ── IT Support & Operations ──
  'IT Support Specialist', 'IT Support Technician', 'IT Support Engineer', 'Help Desk Technician', 'Help Desk Analyst',
  'Help Desk Manager', 'Service Desk Analyst', 'Desktop Support Technician', 'Desktop Engineer',
  'IT Administrator', 'IT Systems Administrator', 'Systems Administrator', 'Server Administrator',
  'Network Administrator', 'Network Engineer', 'Network Architect', 'Network Manager',
  'IT Operations Engineer', 'IT Operations Manager', 'IT Manager', 'IT Director', 'Chief Technology Officer',
  'IT Project Manager', 'IT Business Analyst', 'IT Analyst', 'Technical Support Engineer', 'Technical Account Manager',
  'Systems Analyst', 'Business Systems Analyst', 'IT Coordinator', 'Infrastructure Manager',
  'NOC Engineer', 'Network Operations Center Analyst', 'Field Support Technician', 'Field Service Engineer',
  'Endpoint Administrator', 'Intune Administrator', 'Active Directory Administrator', 'Windows Administrator',
  'IT Security Administrator', 'Identity Engineer', 'VoIP Engineer', 'UC Engineer', 'Telecom Engineer',
  'Vendor Management Analyst', 'IT Asset Manager', 'IT Compliance Officer', 'IT Auditor',

  // ── Product & Project ──
  'Product Manager', 'Senior Product Manager', 'Principal Product Manager', 'Lead Product Manager',
  'Product Owner', 'Associate Product Manager', 'Director of Product', 'VP of Product', 'Chief Product Officer',
  'Product Analyst', 'Product Operations Manager', 'Product Marketing Manager', 'Growth Product Manager',
  'Technical Product Manager', 'AI Product Manager', 'Data Product Manager', 'Platform Product Manager',
  'Project Manager', 'Senior Project Manager', 'Technical Project Manager', 'IT Project Coordinator',
  'Delivery Manager', 'Program Manager', 'Senior Program Manager', 'Technical Program Manager',
  'Portfolio Manager', 'PMO Manager', 'Project Coordinator', 'Scrum Master', 'Agile Coach', 'Scrum Master II',
  'Kanban Lead', 'Release Train Engineer', 'Product Designer', 'Product Consultant',

  // ── Design & Creative ──
  'UI Designer', 'UX Designer', 'UI/UX Designer', 'Senior UX Designer', 'Senior UI Designer', 'Lead UX Designer',
  'Product Designer', 'Senior Product Designer', 'Staff Product Designer', 'Principal Product Designer',
  'UX Researcher', 'UX Researcher II', 'UX Writer', 'Content Designer', 'Interaction Designer',
  'Motion Designer', 'Motion Graphics Designer', '3D Artist', '3D Designer', 'Animator', 'Illustrator',
  'Graphic Designer', 'Senior Graphic Designer', 'Brand Designer', 'Brand Identity Designer', 'Visual Designer',
  'Web Designer', 'Digital Designer', 'Design Director', 'Head of Design', 'VP of Design', 'Chief Design Officer',
  'Design System Designer', 'Accessibility Designer', 'Service Designer', 'Prototyper',
  'Video Editor', 'Video Producer', 'Photographer', 'Photo Editor', 'Creative Director', 'Art Director',
  'Copywriter', 'Senior Copywriter', 'Creative Copywriter', 'Scriptwriter', 'Content Strategist',

  // ── Marketing & Growth ──
  'Marketing Manager', 'Senior Marketing Manager', 'Marketing Director', 'VP of Marketing', 'CMO',
  'Marketing Coordinator', 'Marketing Specialist', 'Marketing Analyst', 'Marketing Associate',
  'Digital Marketing Manager', 'Digital Marketing Specialist', 'Digital Marketing Analyst',
  'Growth Marketing Manager', 'Growth Lead', 'Growth Analyst', 'Growth Hacker',
  'Content Marketing Manager', 'Content Marketing Specialist', 'Content Manager', 'Content Creator',
  'SEO Specialist', 'SEO Manager', 'SEM Specialist', 'PPC Specialist', 'PPC Manager',
  'Social Media Manager', 'Social Media Specialist', 'Community Manager', 'Community Specialist',
  'Email Marketing Manager', 'Email Marketing Specialist', 'Lifecycle Marketing Manager',
  'Brand Manager', 'Brand Marketing Manager', 'Brand Strategist', 'Marketing Strategist',
  'Product Marketing Specialist', 'Field Marketing Manager', 'Event Marketing Manager',
  'Demand Generation Manager', 'Lead Generation Specialist', 'Performance Marketing Manager',
  'Influencer Marketing Manager', 'Affiliate Marketing Manager', 'Partnership Marketing Manager',
  'Media Buyer', 'Media Planner', 'Public Relations Manager', 'PR Specialist', 'Communications Manager',
  'Corporate Communications Specialist', 'Internal Communications Manager', 'Marketing Operations Manager',
  'Marketing Automation Specialist', 'Marketing Data Analyst', 'Marketing Analytics Manager', 'Market Research Analyst',
  'Web Analyst', 'Conversion Rate Optimization Specialist', 'CRO Manager', 'Copy Marketing Specialist',

  // ── Sales & Business Development ──
  'Account Executive', 'Senior Account Executive', 'Account Manager', 'Senior Account Manager', 'Key Account Manager',
  'Strategic Account Manager', 'Enterprise Account Executive', 'Mid Market Account Executive', 'SMB Account Executive',
  'Sales Representative', 'Sales Development Representative', 'SDR Manager', 'Business Development Representative',
  'Business Development Manager', 'Senior Business Development Manager', 'Business Development Director',
  'Sales Manager', 'Regional Sales Manager', 'Sales Director', 'VP of Sales', 'Chief Revenue Officer',
  'Sales Engineer', 'Pre Sales Engineer', 'Pre Sales Consultant', 'Solutions Engineer', 'Sales Consultant',
  'Sales Operations Analyst', 'Sales Operations Manager', 'Sales Enablement Manager', 'Sales Trainer',
  'Customer Success Manager', 'Senior Customer Success Manager', 'Customer Success Director',
  'Customer Success Specialist', 'Onboarding Specialist', 'Client Success Manager', 'Account Director',
  'Territory Manager', 'Channel Manager', 'Channel Partner Manager', 'Reseller Manager', 'Distributor Manager',
  'Inside Sales Representative', 'Outside Sales Representative', 'Field Sales Representative', 'Area Sales Manager',
  'International Sales Manager', 'Technical Sales Manager', 'Proposal Manager', 'Bid Manager', 'Tender Specialist',
  'Renewals Manager', 'Upsell Specialist', 'Client Relations Manager', 'Sales Analyst', 'Revenue Operations Manager',

  // ── Customer Support ──
  'Customer Support Specialist', 'Customer Support Representative', 'Customer Service Representative',
  'Customer Service Manager', 'Support Agent', 'Support Manager', 'Support Team Lead',
  'Technical Support Specialist', 'Technical Support Manager', 'Product Support Specialist',
  'Tier 2 Support Analyst', 'Tier 3 Support Engineer', 'Escalation Engineer', 'Knowledge Manager',
  'Customer Experience Manager', 'CX Specialist', 'Community Support Specialist', 'Contact Center Agent',
  'Call Center Supervisor', 'Customer Relations Manager', 'Client Support Analyst', 'QA Support Analyst',
  'Help Center Analyst', 'Support Operations Manager', 'Customer Advocacy Manager', 'Voice of Customer Analyst',

  // ── Finance & Accounting ──
  'Accountant', 'Senior Accountant', 'Staff Accountant', 'General Accountant', 'Tax Accountant', 'Tax Manager',
  'Accounts Payable Specialist', 'Accounts Receivable Specialist', 'Payroll Specialist', 'Payroll Manager',
  'Bookkeeper', 'Senior Bookkeeper', 'Financial Analyst', 'Senior Financial Analyst', 'Financial Analyst II',
  'FP&A Analyst', 'Financial Planning Analyst', 'Financial Manager', 'Finance Manager', 'Finance Director',
  'Chief Financial Officer', 'Controller', 'Assistant Controller', 'Accounting Manager', 'Financial Controller',
  'Treasury Analyst', 'Treasury Manager', 'Auditor', 'Internal Auditor', 'Senior Auditor', 'External Auditor',
  'Risk Analyst', 'Credit Analyst', 'Credit Manager', 'Investment Analyst', 'Portfolio Analyst',
  'Business Analyst', 'Senior Business Analyst', 'Business Analyst II', 'Lead Business Analyst',
  'Financial Advisor', 'Financial Consultant', 'Wealth Manager', 'Investment Banker', 'M&A Analyst',
  'Actuary', 'Underwriter', 'Insurance Analyst', 'Compliance Officer', 'Anti Money Laundering Analyst',
  'Revenue Analyst', 'Pricing Analyst', 'Cost Accountant', 'Management Accountant', 'Forensic Accountant',
  'Data Analyst Finance', 'Operations Analyst', 'Procurement Analyst', 'Budget Analyst', 'Reporting Analyst',

  // ── Human Resources ──
  'HR Generalist', 'HR Specialist', 'HR Manager', 'HR Business Partner', 'Senior HR Business Partner',
  'HR Director', 'VP of Human Resources', 'Chief Human Resources Officer',
  'Recruiter', 'Technical Recruiter', 'Talent Acquisition Specialist', 'Talent Acquisition Manager',
  'Talent Acquisition Director', 'Sourcer', 'Recruiting Coordinator', 'Campus Recruiter', 'Executive Recruiter',
  'HR Coordinator', 'HR Analyst', 'HRIS Analyst', 'HRIS Administrator', 'People Operations Manager',
  'People Partner', 'People Analytics Manager', 'Compensation Analyst', 'Compensation Manager',
  'Benefits Administrator', 'Benefits Manager', 'Payroll and Benefits Specialist', 'Payroll Administrator',
  'Employee Relations Specialist', 'Employee Relations Manager', 'Labor Relations Specialist',
  'Training and Development Specialist', 'Training Manager', 'Learning and Development Manager', 'L&D Specialist',
  'Instructional Designer', 'Diversity Equity and Inclusion Manager', 'DEI Specialist', 'Talent Development Manager',
  'Performance Management Specialist', 'Succession Planning Manager', 'Onboarding Manager', 'HR Consultant',
  'Employment Specialist', 'Workforce Planning Analyst', 'Organizational Development Specialist', 'HR Operations Manager',

  // ── Legal & Compliance ──
  'Legal Counsel', 'Corporate Counsel', 'General Counsel', 'Chief Legal Officer', 'Associate Attorney',
  'Paralegal', 'Senior Paralegal', 'Legal Assistant', 'Legal Analyst', 'Legal Operations Manager',
  'Compliance Specialist', 'Compliance Officer', 'Compliance Manager', 'Senior Compliance Manager',
  'Chief Compliance Officer', 'Regulatory Affairs Specialist', 'Regulatory Affairs Manager',
  'Contract Administrator', 'Contracts Manager', 'Contract Specialist', 'Contract Analyst',
  'Intellectual Property Lawyer', 'IP Paralegal', 'Patent Agent', 'Patent Attorney', 'Trademark Attorney',
  'Employment Lawyer', 'Litigation Associate', 'Litigation Paralegal', 'Privacy Officer', 'Data Protection Officer',
  'Risk and Compliance Analyst', 'Corporate Secretary', 'Notary Public Specialist', 'Legal Researcher',
  'Immigration Paralegal', 'Family Law Attorney', 'Real Estate Attorney', 'Mergers and Acquisitions Lawyer',
  'Securities Lawyer', 'Banking Compliance Analyst', 'AML Compliance Manager', 'Ethics and Compliance Specialist',

  // ── Operations, Admin & Management ──
  'Operations Manager', 'Senior Operations Manager', 'Operations Director', 'VP of Operations', 'Chief Operating Officer',
  'Operations Analyst', 'Operations Coordinator', 'Operations Specialist', 'Business Operations Manager',
  'Revenue Operations Manager', 'Sales Operations Specialist', 'Office Manager', 'Executive Assistant',
  'Administrative Assistant', 'Administrative Coordinator', 'Administrative Manager', 'Office Coordinator',
  'Executive Assistant to CEO', 'Personal Assistant', 'Receptionist', 'Front Desk Coordinator',
  'Facilities Manager', 'Facilities Coordinator', 'Maintenance Manager', 'Property Manager', 'Community Manager Real Estate',
  'Logistics Manager', 'Logistics Coordinator', 'Logistics Analyst', 'Supply Chain Manager', 'Supply Chain Analyst',
  'Supply Chain Director', 'Procurement Manager', 'Procurement Specialist', 'Buyer', 'Purchasing Manager',
  'Purchasing Agent', 'Inventory Manager', 'Inventory Analyst', 'Warehouse Manager', 'Warehouse Supervisor',
  'Fleet Manager', 'Transportation Manager', 'Dispatch Coordinator', 'Customs Broker', 'Freight Coordinator',
  'Quality Manager', 'Quality Assurance Manager', 'Quality Control Inspector', 'Process Improvement Manager',
  'Business Operations Specialist', 'Strategy Manager', 'Strategy Analyst', 'Management Consultant', 'Business Consultant',
  'Transformation Manager', 'Continuous Improvement Manager', 'Lean Specialist', 'Six Sigma Black Belt', 'Six Sigma Green Belt',

  // ── Executive & Leadership ──
  'Chief Executive Officer', 'Chief Operating Officer', 'Chief Financial Officer', 'Chief Technology Officer',
  'Chief Information Officer', 'Chief Product Officer', 'Chief Marketing Officer', 'Chief Revenue Officer',
  'Chief Human Resources Officer', 'Chief Data Officer', 'Chief Information Security Officer',
  'VP of Engineering', 'VP of Product', 'VP of Marketing', 'VP of Sales', 'VP of Operations',
  'VP of Finance', 'VP of Customer Success', 'VP of Human Resources', 'VP of Business Development',
  'Director of Engineering', 'Director of Product Management', 'Director of Marketing', 'Director of Sales',
  'Director of Operations', 'Director of Finance', 'Director of IT', 'Director of Data', 'Director of Design',
  'Director of Security', 'Director of Customer Success', 'Director of Talent Acquisition', 'Director of Analytics',
  'Head of Engineering', 'Head of Product', 'Head of Design', 'Head of Data', 'Head of Growth',
  'Head of Operations', 'Head of People', 'Head of Partnerships', 'Head of Strategy', 'Head of Innovation',
  'Founder', 'Co-Founder', 'Managing Director', 'General Manager', 'Country Manager', 'Regional Director',
  'Board Member', 'Advisor', 'Startup Advisor', 'Non Executive Director',

  // ── Healthcare & Medical ──
  'Registered Nurse', 'Registered Nurse (RN)', 'Nurse Practitioner', 'Licensed Practical Nurse', 'Nursing Assistant',
  'Medical Doctor', 'Physician', 'General Practitioner', 'Family Physician', 'Pediatrician', 'Cardiologist',
  'Neurologist', 'Oncologist', 'Dermatologist', 'Radiologist', 'Anesthesiologist', 'Surgeon', 'Orthopedic Surgeon',
  'Psychiatrist', 'Psychologist', 'Clinical Psychologist', 'Therapist', 'Physical Therapist', 'Occupational Therapist',
  'Speech Language Pathologist', 'Pharmacist', 'Pharmacy Technician', 'Pharmacy Manager',
  'Dentist', 'Dental Hygienist', 'Dental Assistant', 'Optometrist', 'Veterinarian', 'Veterinary Technician',
  'Medical Assistant', 'Physician Assistant', 'Paramedic', 'EMT', 'Radiologic Technologist', 'MRI Technologist',
  'Lab Technician', 'Medical Laboratory Technician', 'Phlebotomist', 'Medical Biller', 'Medical Coder',
  'Health Information Manager', 'Medical Records Specialist', 'Hospital Administrator', 'Clinic Manager',
  'Healthcare Consultant', 'Public Health Analyst', 'Epidemiologist', 'Nutritionist', 'Dietitian',
  'Chiropractor', 'Acupuncturist', 'Massage Therapist', 'Midwife', 'Home Health Aide', 'Medical Receptionist',
  'Care Coordinator', 'Case Manager', 'Patient Advocate', 'Health Coach', 'Wellness Coordinator', 'Clinical Research Coordinator',
  'Clinical Research Associate', 'Medical Science Liaison', 'Healthcare Data Analyst', 'Telehealth Nurse',

  // ── Education ──
  'Teacher', 'Elementary School Teacher', 'Middle School Teacher', 'High School Teacher', 'Substitute Teacher',
  'Preschool Teacher', 'Kindergarten Teacher', 'Special Education Teacher', 'ESL Teacher', 'Tutor',
  'College Professor', 'Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Adjunct Professor',
  'Teaching Assistant', 'Graduate Teaching Assistant', 'Research Assistant', 'Postdoctoral Fellow',
  'School Principal', 'Vice Principal', 'School Counselor', 'Academic Advisor', 'Career Counselor',
  'Curriculum Developer', 'Curriculum Specialist', 'Instructional Coordinator', 'Education Consultant',
  'Dean of Students', 'Registrar', 'Admissions Counselor', 'Admissions Director', 'Academic Dean',
  'Online Instructor', 'E-Learning Specialist', 'Learning Designer', 'Training Coordinator',
  'Language Teacher', 'Music Teacher', 'Art Teacher', 'Science Teacher', 'Math Teacher', 'Computer Science Teacher',
  'Athletic Coach', 'Sports Coach', 'Education Technology Specialist', 'Director of Education', 'School Psychologist',

  // ── Engineering (physical) ──
  'Mechanical Engineer', 'Senior Mechanical Engineer', 'Mechanical Design Engineer', 'Thermal Engineer',
  'Electrical Engineer', 'Senior Electrical Engineer', 'Electronics Engineer', 'Power Engineer',
  'Civil Engineer', 'Senior Civil Engineer', 'Structural Engineer', 'Geotechnical Engineer', 'Transportation Engineer',
  'Chemical Engineer', 'Process Engineer', 'Senior Process Engineer', 'Industrial Engineer', 'Manufacturing Engineer',
  'Industrial Automation Engineer', 'Robotics Engineer', 'Robotics Software Engineer', 'Controls Engineer',
  'Automation Controls Engineer', 'Instrumentation Engineer', 'Aerospace Engineer', 'Aerospace Systems Engineer',
  'Avionics Engineer', 'Flight Test Engineer', 'Automotive Engineer', 'Automotive Software Engineer', 'EV Engineer',
  'Marine Engineer', 'Naval Architect', 'Biomedical Engineer', 'Bioengineer', 'Environmental Engineer',
  'Environmental Scientist', 'Materials Engineer', 'Metallurgist', 'Packaging Engineer', 'Reliability Engineer',
  'Maintenance Engineer', 'Plant Engineer', 'Facility Engineer', 'Safety Engineer', 'Fire Protection Engineer',
  'Mining Engineer', 'Petroleum Engineer', 'Drilling Engineer', 'Reservoir Engineer', 'Surveyor', 'Land Surveyor',
  'BIM Engineer', 'CAD Designer', 'Drafter', 'Engineering Manager Manufacturing', 'Chief Engineer', 'Field Engineer',

  // ── Construction & Trades ──
  'Construction Manager', 'Construction Project Manager', 'Site Manager', 'Construction Supervisor',
  'Project Engineer Construction', 'Quantity Surveyor', 'Estimator', 'Construction Estimator', 'Cost Estimator',
  'Architect', 'Senior Architect', 'Landscape Architect', 'Urban Planner', 'Interior Designer', 'Interior Architect',
  'Carpenter', 'Electrician', 'Plumber', 'Welder', 'HVAC Technician', 'Mason', 'Roofer', 'Painter',
  'Construction Worker', 'Equipment Operator', 'Heavy Equipment Operator', 'Crane Operator', 'Forklift Operator',
  'Safety Officer Construction', 'Site Safety Manager', 'Inspector', 'Building Inspector', 'Code Inspector',
  'Scheduler Construction', 'Expeditor', 'Construction Coordinator', 'Project Superintendent', 'Superintendent',
  'Facility Maintenance Technician', 'Building Maintenance Technician', 'Handyman', 'Glazier', 'Insulation Installer',

  // ── Manufacturing & Warehouse ──
  'Production Manager', 'Production Supervisor', 'Production Planner', 'Production Coordinator',
  'Manufacturing Supervisor', 'Plant Manager', 'Factory Manager', 'Operations Supervisor',
  'Machine Operator', 'CNC Machinist', 'CNC Operator', 'CNC Programmer', 'Tool and Die Maker', 'Mold Maker',
  'Assembly Technician', 'Assembly Line Worker', 'Quality Inspector Manufacturing', 'QC Inspector',
  'Test Technician', 'Electronics Technician', 'Bench Technician', 'Field Service Technician Manufacturing',
  'Maintenance Technician', 'Industrial Maintenance Technician', 'Electrical Technician', 'Mechatronics Technician',
  'Fabricator', 'Sheet Metal Worker', 'Machinist', 'Millwright', 'Precision Machinist', 'Boilermaker',
  'Packaging Operator', 'Line Operator', 'Material Handler', 'Picker Packer', 'Order Picker',
  'Forklift Driver', 'Shipper', 'Receiver', 'Shipping and Receiving Clerk', 'Stock Clerk', 'Cycle Counter',
  'Warehouse Associate', 'Warehouse Clerk', 'Distribution Center Associate', 'Logistics Associate', 'Fulfillment Associate',
  'R&D Engineer Manufacturing', 'Product Engineer', 'NPI Engineer', 'Manufacturing Engineer II', 'Lean Manufacturing Engineer',

  // ── Energy & Utilities ──
  'Energy Analyst', 'Renewable Energy Engineer', 'Solar Engineer', 'Solar Installer', 'Wind Turbine Technician',
  'Electrical Power Engineer', 'Power Systems Engineer', 'Grid Engineer', 'Transmission Engineer',
  'Distribution Engineer', 'Utility Engineer', 'Energy Manager', 'Sustainability Manager', 'Sustainability Analyst',
  'Environmental Health and Safety Manager', 'EHS Specialist', 'HSE Manager', 'Health and Safety Officer',
  'Energy Consultant', 'Carbon Analyst', 'Climate Analyst', 'ESG Analyst', 'ESG Manager',
  'Nuclear Engineer', 'Plant Operator', 'Power Plant Operator', 'Control Room Operator', 'Substation Technician',
  'Lineworker', 'Lineman', 'Gas Technician', 'Water Treatment Plant Operator', 'Wastewater Operator',
  'Hydro Engineer', 'Geothermal Engineer', 'Battery Engineer', 'Energy Storage Engineer', 'Hydrogen Engineer',

  // ── Media, Content & Communications ──
  'Journalist', 'Reporter', 'News Editor', 'Editor', 'Managing Editor', 'Copy Editor', 'Proofreader',
  'Content Writer', 'Technical Writer', 'Senior Technical Writer', 'Documentation Specialist', 'Grant Writer',
  'Blog Writer', 'Ghostwriter', 'Author', 'Novelist', 'Screenwriter', 'Playwright',
  'Podcast Producer', 'Podcast Host', 'Radio Host', 'Broadcast Producer', 'News Producer',
  'Social Media Content Creator', 'Influencer', 'YouTuber', 'Video Content Creator', 'Short Form Content Creator',
  'Photography Editor', 'Videographer', 'Camera Operator', 'Sound Engineer', 'Audio Engineer', 'Music Producer',
  'Editorial Assistant', 'Publishing Manager', 'Librarian', 'Archivist', 'Museum Curator', 'Translator',
  'Interpreter', 'Localization Specialist', 'Proofreading Specialist', 'Captioner', 'Accessibility Specialist Media',
  'News Anchor', 'Sports Journalist', 'Data Journalist', 'Investigative Journalist', 'Political Correspondent',
  'Correspondent', 'Media Planner Content', 'Audience Development Manager', 'Community Content Manager', 'Brand Journalist',

  // ── Hospitality, Travel & Food ──
  'Hotel Manager', 'Front Office Manager', 'Front Desk Agent', 'Concierge', 'Housekeeping Supervisor',
  'Housekeeper', 'Reservation Agent', 'Revenue Manager Hotel', 'Event Manager', 'Event Coordinator',
  'Wedding Planner', 'Conference Coordinator', 'Banquet Manager', 'Restaurant Manager', 'Assistant Restaurant Manager',
  'Chef', 'Executive Chef', 'Sous Chef', 'Line Cook', 'Prep Cook', 'Pastry Chef', 'Baker',
  'Waiter', 'Waitress', 'Server', 'Bartender', 'Barista', 'Bar Manager', 'Food and Beverage Manager',
  'Catering Manager', 'Caterer', 'Sommelier', 'Food Safety Manager', 'Kitchen Manager', 'Dishwasher',
  'Travel Agent', 'Travel Consultant', 'Tour Guide', 'Tour Manager', 'Cruise Director', 'Airport Services Agent',
  'Resort Manager', 'Recreation Coordinator', 'Entertainment Manager', 'Nightclub Manager', 'Casino Manager',
  'Guest Relations Manager', 'Lodging Manager', 'Bed and Breakfast Manager', 'Cafe Manager', 'Bakery Manager',

  // ── Retail & Consumer ──
  'Store Manager', 'Assistant Store Manager', 'Retail Manager', 'Shop Manager', 'Department Manager',
  'Sales Associate', 'Retail Associate', 'Store Associate', 'Cashier', 'Retail Salesperson',
  'Visual Merchandiser', 'Buyer Retail', 'Merchandise Planner', 'Store Planner', 'Retail Buyer',
  'Category Manager', 'Ecommerce Manager', 'Ecommerce Specialist', 'Online Store Manager', 'Marketplace Manager',
  'Amazon Seller Specialist', 'Shopify Developer', 'Ecommerce Marketing Manager', 'Dropshipping Specialist',
  'Inventory Planner', 'Retail Operations Manager', 'Area Manager Retail', 'District Manager', 'Regional Manager Retail',
  'Loss Prevention Officer', 'Security Guard', 'Loss Prevention Manager', 'Customer Service Associate',
  'Luxury Retail Consultant', 'Beauty Advisor', 'Cosmetics Sales Representative', 'Pharmacy Sales Associate',
  'Fashion Consultant', 'Personal Shopper', 'Brand Ambassador', 'Retail Trainer', 'Store Designer',

  // ── Real Estate & Property ──
  'Real Estate Agent', 'Real Estate Broker', 'Realtor', 'Commercial Real Estate Agent', 'Residential Real Estate Agent',
  'Real Estate Consultant', 'Property Consultant', 'Leasing Agent', 'Leasing Manager', 'Tenant Relations Manager',
  'Property Manager Real Estate', 'Facilities Manager Real Estate', 'Real Estate Analyst', 'Real Estate Investment Analyst',
  'Real Estate Developer', 'Real Estate Project Manager', 'Housing Officer', 'Estate Manager', 'Building Manager',
  'Maintenance Supervisor', 'HOA Manager', 'Community Association Manager', 'Real Estate Appraiser', 'Home Inspector',
  'Escrow Officer', 'Title Officer', 'Real Estate Attorney Assistant', 'Mortgage Loan Officer', 'Loan Processor',
  'Loan Underwriter', 'Mortgage Broker', 'Notary', 'Real Estate Photographer', 'Staging Specialist',

  // ── Aviation & Transportation ──
  'Pilot', 'Commercial Pilot', 'Airline Pilot', 'Captain', 'First Officer', 'Helicopter Pilot', 'Drone Pilot',
  'Flight Attendant', 'Cabin Crew', 'Air Traffic Controller', 'Aircraft Mechanic', 'Aviation Maintenance Technician',
  'Aircraft Engineer', 'Ground Handling Agent', 'Ramp Agent', 'Flight Dispatcher', 'Aircraft Inspector',
  'Aviation Safety Officer', 'Airlines Operations Manager', 'Airport Operations Manager', 'Gate Agent',
  'Cargo Agent', 'Baggage Handler', 'Railway Conductor', 'Train Operator', 'Locomotive Engineer', 'Bus Driver',
  'Truck Driver', 'CDL Driver', 'Delivery Driver', 'Courier', 'Ride Share Driver', 'Chauffeur',
  'Ship Captain', 'Marine Deck Officer', 'Seafarer', 'Sailor', 'Port Operations Manager', 'Harbor Master',
  'Logistics Dispatcher', 'Fleet Dispatcher', 'Route Planner', 'Mobility Manager', 'Transportation Planner',

  // ── Agriculture & Environment ──
  'Agronomist', 'Agricultural Engineer', 'Farm Manager', 'Farmhand', 'Crop Specialist', 'Greenhouse Manager',
  'Forester', 'Forestry Technician', 'Landscaper', 'Landscape Technician', 'Groundskeeper', 'Gardener',
  'Arborist', 'Horticulturist', 'Botanist', 'Ecologist', 'Environmental Consultant', 'Climate Scientist',
  'Water Resource Specialist', 'Soil Scientist', 'Marine Biologist', 'Biologist', 'Zoologist', 'Wildlife Biologist',
  'Fisheries Manager', 'Aquaculturist', 'Viticulturist', 'Winemaker', 'Brewer', 'Brewery Manager', 'Food Scientist',
  'Food Technologist', 'Nutrition Scientist', 'Laboratory Analyst', 'Quality Assurance Lab Technician',

  // ── Government, Public & Nonprofit ──
  'Policy Analyst', 'Public Policy Manager', 'Government Relations Manager', 'Lobbyist', 'Public Administrator',
  'City Planner', 'Urban Development Officer', 'Economic Development Officer', 'Community Development Manager',
  'Civil Servant', 'Diplomat', 'Foreign Service Officer', 'Intelligence Analyst', 'Counterintelligence Analyst',
  'Defense Analyst', 'Logistics Officer', 'Contracting Officer', 'Grants Manager', 'Grant Coordinator',
  'Program Manager Nonprofit', 'Program Coordinator Nonprofit', 'Development Manager', 'Fundraising Manager',
  'Major Gifts Officer', 'Donor Relations Manager', 'Volunteer Coordinator', 'Advocacy Manager', 'Outreach Coordinator',
  'Case Worker', 'Social Worker', 'Community Organizer', 'Youth Program Coordinator', 'Public Health Educator',
  'Emergency Management Specialist', 'Firefighter', 'Police Officer', 'Detective', 'Parole Officer', 'Probation Officer',
  'Correctional Officer', '911 Dispatcher', 'Emergency Dispatcher', 'Border Patrol Agent', 'Customs Officer',

  // ── Science & Research ──
  'Research Scientist', 'Senior Research Scientist', 'Principal Scientist', 'Research Associate', 'Laboratory Researcher',
  'Postdoctoral Researcher', 'Scientist', 'Analytical Chemist', 'Organic Chemist', 'Biochemist', 'Molecular Biologist',
  'Geneticist', 'Microbiologist', 'Immunologist', 'Neuroscientist', 'Physicist', 'Astrophysicist', 'Astronomer',
  'Mathematician', 'Statistician', 'Data Statistician', 'Quantitative Analyst', 'Quantitative Researcher',
  'Geologist', 'Geoscientist', 'Meteorologist', 'Oceanographer', 'Hydrologist', 'Seismologist',
  'Research Technician', 'Lab Manager', 'Clinical Laboratory Scientist', 'R&D Manager', 'Innovation Manager',
  'Product Researcher', 'User Researcher', 'Market Researcher', 'Economist', 'Senior Economist',
  'Social Scientist', 'Anthropologist', 'Sociologist', 'Political Scientist', 'Historian', 'Archaeologist',
  'Science Writer', 'Lab Assistant', 'Pharmaceutical Scientist', 'Formulation Scientist', 'Quality Control Chemist',

  // ── Sports, Fitness & Wellness ──
  'Personal Trainer', 'Fitness Trainer', 'Fitness Coach', 'Fitness Instructor', 'Group Fitness Instructor',
  'Yoga Instructor', 'Pilates Instructor', 'Gym Manager', 'Fitness Center Manager', 'Exercise Physiologist',
  'Sports Coach Fitness', 'Athletic Trainer', 'Strength and Conditioning Coach', 'Sports Scientist',
  'Physical Education Teacher', 'Swim Instructor', 'Dance Instructor', 'Martial Arts Instructor',
  'Nutrition Coach', 'Wellness Coach', 'Health Coach Fitness', 'Spa Manager', 'Massage Therapist Wellness',
  'Beauty Therapist', 'Esthetician', 'Hair Stylist', 'Barber', 'Nail Technician', 'Makeup Artist',
  'Salon Manager', 'Spa Therapist', 'Meditation Instructor', 'Recreation Therapist', 'Outdoor Guide', 'Surf Instructor',

  // ── Consulting & Professional Services ──
  'Management Consultant', 'Senior Consultant', 'Principal Consultant', 'Managing Consultant', 'Associate Consultant',
  'Strategy Consultant', 'Operations Consultant', 'Financial Consultant Business', 'HR Consultant Business',
  'IT Consultant', 'Digital Transformation Consultant', 'Business Transformation Manager', 'Organizational Consultant',
  'Process Consultant', 'Data Consultant', 'AI Consultant', 'Security Consultant Professional',
  'Compliance Consultant', 'Sustainability Consultant', 'Supply Chain Consultant', 'Pricing Consultant',
  'Business Development Consultant', 'Advisory Consultant', 'Risk Consultant', 'Audit Consultant', 'Tax Consultant',
  'Implementation Consultant', 'Change Management Consultant', 'Project Management Consultant', 'Research Consultant',
  'Fractional CFO', 'Fractional CTO', 'Interim Manager', 'Interim Executive', 'Business Coach', 'Executive Coach',
  'Career Coach', 'Leadership Coach', 'Speaking Coach', 'Training Consultant', 'Workshop Facilitator',

  // ── Emerging & Specialist Roles ──
  'Blockchain Developer', 'Blockchain Engineer', 'Smart Contract Developer', 'Web3 Developer', 'Crypto Analyst',
  'Cryptocurrency Analyst', 'DeFi Developer', 'NFT Designer', 'Quantum Computing Researcher', 'Quantum Engineer',
  'AR/VR Developer', 'AR Engineer', 'VR Engineer', 'XR Developer', 'Metaverse Developer', '3D Engine Developer',
  'Prompt Engineer AI', 'AI Ethics Officer', 'AI Safety Researcher', 'ML Infrastructure Engineer', 'Data Labeling Specialist',
  'Annotation Specialist', 'Chatbot Developer', 'Voice Assistant Developer', 'Conversational AI Designer',
  'Robotics Process Automation Developer', 'RPA Developer', 'RPA Analyst', 'Automation Consultant',
  'Low Code Developer', 'No Code Developer', 'No Code Automation Specialist', 'Zapier Specialist', 'Make.com Specialist',
  'Workflow Automation Specialist', 'Bubble Developer', 'Webflow Developer', 'Framer Developer',
  'Digital Nomad Consultant', 'Remote Work Consultant', 'Virtual Assistant', 'AI Trainer', 'Data Annotator',
  'Cyber Threat Analyst', 'Dark Web Analyst', 'OSINT Analyst', 'Geospatial Analyst', 'GIS Specialist', 'GIS Developer',
  'Cartographer', 'Drone Operations Manager', 'Autonomous Vehicle Engineer', 'Robotics Technician', 'Simulation Engineer',
  'F1 Engineer', 'Motorsport Engineer', 'Esports Manager', 'Esports Coach', 'Game Tester', 'Playtester',
  'Streamer Manager', 'Fan Engagement Manager', 'Community Builder', 'Ambassador Program Manager', 'Loyalty Manager',
];

// ────────────────────────────────────────────────────────────────────────────
// Skills & keywords — ~600, across every domain
// ────────────────────────────────────────────────────────────────────────────

export const SKILLS: string[] = [
  // DevOps, Cloud & Infrastructure
  'Docker', 'Kubernetes', 'Helm', 'Terraform', 'Ansible', 'Puppet', 'Chef', 'CI/CD', 'Jenkins', 'GitLab CI',
  'GitHub Actions', 'ArgoCD', 'Flux', 'GitOps', 'IaC', 'Infrastructure as Code', 'CloudFormation', 'CDK', 'Pulumi',
  'AWS', 'Amazon Web Services', 'AWS Lambda', 'Amazon ECS', 'Amazon EKS', 'S3', 'EC2', 'RDS', 'DynamoDB', 'VPC',
  'Azure', 'Microsoft Azure', 'Azure DevOps', 'Azure Functions', 'GCP', 'Google Cloud', 'Google Cloud Platform',
  'Serverless', 'OpenShift', 'Vault', 'HashiCorp Vault', 'Consul', 'Nomad', 'Prometheus', 'Grafana', 'Datadog',
  'New Relic', 'OpenTelemetry', 'ELK Stack', 'Elasticsearch', 'Logstash', 'Kibana', 'Splunk', 'Sentry',
  'Monitoring', 'Alerting', 'Observability', 'SLO', 'SLI', 'Incident Management', 'On-Call', 'Chaos Engineering',
  'Blue-Green Deployment', 'Canary Deployment', 'Rolling Deployment', 'Feature Flags', 'Nginx', 'Apache', 'HAProxy',
  'Load Balancing', 'Reverse Proxy', 'DNS', 'BIND', 'Networking', 'TCP/IP', 'VPN', 'VLAN', 'Firewall', 'Proxy',
  'Linux', 'Unix', 'Ubuntu', 'Debian', 'Red Hat', 'CentOS', 'Alpine', 'systemd', 'System Administration', 'Bash',
  'PowerShell', 'Shell Scripting', 'Zsh', 'cron', 'Virtualization', 'VMware', 'Hyper-V', 'Proxmox', 'KVM',
  'Containers', 'Container Orchestration', 'Microservices', 'Service Mesh', 'Istio', 'Linkerd', 'API Gateway',
  'Kong', 'Traefik', 'gRPC', 'REST API', 'GraphQL', 'WebSockets', 'Message Queues', 'Kafka', 'RabbitMQ', 'Redis',
  'Active Directory', 'LDAP', 'SCCM', 'Intune', 'Windows Server', 'Windows Administration', 'Office 365',
  'Mail Server', 'Postfix', 'Email Deliverability', 'S3 Buckets', 'CDN', 'CloudFront', 'Cloudflare', 'Fastly',

  // Cybersecurity
  'Penetration Testing', 'PenTest', 'Ethical Hacking', 'Vulnerability Assessment', 'Vulnerability Management',
  'OWASP', 'OWASP Top 10', 'SIEM', 'Splunk SIEM', 'QRadar', 'SOAR', 'IDS', 'IPS', 'Suricata', 'Snort',
  'Endpoint Security', 'EDR', 'XDR', 'Antivirus', 'CrowdStrike', 'SentinelOne', 'Carbon Black', 'Defender',
  'Firewalls', 'Fortinet', 'Palo Alto', 'Check Point', 'Cisco ASA', 'WAF', 'ModSecurity', 'AWS WAF',
  'IAM', 'Identity and Access Management', 'SSO', 'SAML', 'OAuth', 'OIDC', 'Okta', 'Azure AD', 'Entra ID',
  'MFA', 'Zero Trust', 'Zero Trust Architecture', 'PKI', 'X.509', 'TLS', 'SSL', 'HTTPS', 'Cryptography',
  'Encryption', 'AES', 'RSA', 'HSM', 'Key Management', 'Secrets Management', 'Vault Secrets',
  'Threat Hunting', 'Threat Intelligence', 'MITRE ATT&CK', 'Incident Response', 'IR Playbooks', 'Digital Forensics',
  'Memory Forensics', 'Malware Analysis', 'Sandbox Analysis', 'Reverse Engineering', 'Binary Analysis', 'Ghidra', 'IDA Pro',
  'Network Security', 'Segmentation', 'Microsegmentation', 'DDoS Mitigation', 'Rate Limiting', 'Security Auditing',
  'Security Assessment', 'Red Team', 'Blue Team', 'Purple Team', 'Attack Surface Management', 'ASM',
  'Compliance', 'NIST', 'NIST CSF', 'ISO 27001', 'ISO 27002', 'SOC 2', 'PCI DSS', 'GDPR', 'HIPAA', 'FedRAMP',
  'CIS Benchmarks', 'CIS Controls', 'Hardening', 'Security Hardening', 'GRC', 'Risk Assessment', 'Risk Management',
  'Data Loss Prevention', 'DLP', 'DLP Policy', 'Data Classification', 'Privacy', 'DPO', 'CCPA',
  'SAST', 'DAST', 'SCA', 'Software Composition Analysis', 'Secrets Scanning', 'Code Signing', 'Security Testing',
  'Bug Bounty', 'Responsible Disclosure', 'OSINT', 'Phishing Analysis', 'Social Engineering', 'Awareness Training',
  'Security Awareness', 'Secure Coding', 'Threat Modeling', 'STRIDE', 'Attack Simulation', 'Breach and Attack Simulation',

  // Programming languages
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'C#', 'Go', 'Golang', 'Rust', 'Ruby', 'PHP',
  'Swift', 'Kotlin', 'Scala', 'Groovy', 'Elixir', 'Erlang', 'Clojure', 'Haskell', 'R', 'MATLAB', 'Perl',
  'Objective-C', 'Dart', 'Lua', 'Zig', 'VBA', 'Assembly', 'COBOL', 'Fortran', 'Pascal', 'Delphi', 'Julia',
  'Solidity', 'SQL', 'PL/SQL', 'T-SQL', 'NoSQL', 'GraphQL Schema', 'Prisma', 'SQLAlchemy', 'GORM',
  'Functional Programming', 'Object Oriented Programming', 'OOP', 'Test Driven Development', 'TDD', 'Pair Programming',
  'Code Review', 'Clean Code', 'Design Patterns', 'SOLID', 'Domain Driven Design', 'DDD', 'Event Driven Architecture',
  'HPC', 'High Performance Computing', 'CUDA', 'Parallel Computing', 'SIMD', 'Scientific Computing',

  // Frameworks & libraries
  'React', 'React.js', 'React Native', 'Next.js', 'Remix', 'Vue', 'Vue.js', 'Nuxt', 'Svelte', 'SvelteKit',
  'Angular', 'Ember', 'Backbone', 'SolidJS', 'Preact', 'Redux', 'Zustand', 'Recoil', 'Jotai', 'MobX',
  'Tailwind CSS', 'Tailwind', 'Bootstrap', 'Material UI', 'MUI', 'Chakra UI', 'Ant Design', 'shadcn/ui', 'Radix UI',
  'CSS', 'SCSS', 'Sass', 'LESS', 'Styled Components', 'CSS Modules', 'PostCSS', 'Webpack', 'Vite', 'Parcel', 'Rollup',
  'esbuild', 'Babel', 'TypeScript Compiler', 'Node.js', 'Express', 'Fastify', 'NestJS', 'Koa', 'Hapi',
  'Django', 'Flask', 'FastAPI', 'Rails', 'Ruby on Rails', 'Laravel', 'Symfony', 'Spring', 'Spring Boot',
  'ASP.NET', '.NET', '.NET Core', '.NET 8', 'Blazor', 'Entity Framework', 'EF Core', 'Hibernate',
  'Flutter', 'Jetpack Compose', 'SwiftUI', 'UIKit', 'Xamarin', 'Ionic', 'Capacitor', 'Expo',
  'Electron', 'Tauri', 'PWA', 'Service Workers', 'Web Components', 'Shadow DOM', 'WebAssembly', 'WASM',
  'Three.js', 'D3.js', 'Chart.js', 'Recharts', 'Framer Motion', 'GSAP', 'jQuery', 'Lodash', 'RxJS',

  // Data, AI & ML
  'PostgreSQL', 'MySQL', 'MariaDB', 'SQLite', 'MongoDB', 'Firebase', 'Firestore', 'Supabase', 'Neon',
  'DynamoDB Database', 'Cassandra', 'ScyllaDB', 'Redis Cache', 'Memcached', 'CouchDB', 'InfluxDB', 'ClickHouse',
  'Snowflake', 'BigQuery', 'Redshift', 'Databricks', 'Lakehouse', 'Data Warehouse', 'Data Lake', 'Delta Lake',
  'ETL', 'ELT', 'Data Pipeline', 'Streaming', 'Apache Kafka', 'Kafka Streams', 'Apache Spark', 'PySpark',
  'Apache Flink', 'Apache Airflow', 'Prefect', 'Dagster', 'dbt', 'DBT', 'Fivetran', 'Stitch', 'Matillion',
  'Data Modeling', 'Star Schema', 'Dimensional Modeling', 'Data Vault', 'Data Governance', 'Data Quality',
  'Master Data Management', 'MDM', 'Data Catalog', 'Data Lineage', 'Metadata Management',
  'Pandas', 'NumPy', 'SciPy', 'Scikit-learn', 'scikit-learn', 'XGBoost', 'LightGBM', 'CatBoost',
  'TensorFlow', 'Keras', 'PyTorch', 'JAX', 'Hugging Face', 'Transformers', 'ONNX', 'MLflow', 'Weights and Biases',
  'Kubeflow', 'Vertex AI', 'SageMaker', 'Azure ML', 'MLOps', 'Model Deployment', 'Model Monitoring',
  'Feature Engineering', 'Feature Store', 'Embeddings', 'Vector Databases', 'Pinecone', 'Weaviate', 'Milvus', 'Qdrant',
  'LangChain', 'LlamaIndex', 'RAG', 'Retrieval Augmented Generation', 'Prompt Engineering', 'Fine-tuning', 'LoRA',
  'LLM', 'Large Language Models', 'Generative AI', 'GenAI', 'Diffusion Models', 'Computer Vision', 'OpenCV',
  'Image Processing', 'Object Detection', 'YOLO', 'Semantic Segmentation', 'OCR', 'NLP', 'Natural Language Processing',
  'Tokenization', 'Sentiment Analysis', 'Named Entity Recognition', 'NER', 'Speech Recognition', 'ASR', 'TTS',
  'Text to Speech', 'Time Series Analysis', 'Forecasting', 'ARIMA', 'Prophet', 'Statistical Analysis', 'Hypothesis Testing',
  'A/B Testing', 'Experimental Design', 'Bayesian Statistics', 'Regression Analysis', 'Classification', 'Clustering',
  'K-Means', 'Dimensionality Reduction', 'PCA', 'Recommendation Systems', 'Collaborative Filtering', 'Reinforcement Learning',
  'Anomaly Detection', 'Predictive Modeling', 'Analytics', 'Business Intelligence', 'BI', 'Dashboards', 'KPI Dashboards',
  'Tableau', 'Power BI', 'Looker', 'LookML', 'Metabase', 'Grafana Dashboards', 'Excel', 'Advanced Excel', 'Pivot Tables',
  'Google Sheets', 'Data Visualization', 'Storytelling with Data', 'SQL Query Optimization', 'Data Analysis',

  // Product & Design
  'Figma', 'Sketch', 'Adobe XD', 'Framer', 'InVision', 'Zeplin', 'Photoshop', 'Illustrator', 'InDesign',
  'After Effects', 'Premiere Pro', 'Blender', 'Maya', 'ZBrush', 'Cinema 4D', 'Wireframing', 'Prototyping',
  'Interactive Prototypes', 'User Flows', 'Journey Mapping', 'User Research', 'Usability Testing', 'UX Research',
  'Card Sorting', 'Tree Testing', 'Heuristic Evaluation', 'Accessibility', 'WCAG', 'WCAG 2.2', 'Section 508',
  'Design Systems', 'Design Tokens', 'Component Libraries', 'Information Architecture', 'IA', 'Interaction Design',
  'IxD', 'Motion Design', 'Micro-interactions', 'Branding', 'Brand Identity', 'Logo Design', 'Typography',
  'Color Theory', 'Layout Design', 'Print Design', 'UI Design', 'UX Design', 'Responsive Design', 'Mobile-first Design',
  'Design Handoff', 'Design QA', 'Aesthetics', 'Visual Hierarchy', 'White Space', 'Material Design', 'Human Interface Guidelines',
  'Product Strategy', 'Product Roadmap', 'Roadmapping', 'Prioritization', 'RICE', 'MVP', 'Go to Market', 'GTM',
  'Product Discovery', 'Jobs to be Done', 'JTBD', 'Customer Interviews', 'Personas', 'Product Analytics',
  'Product Metrics', 'North Star Metric', 'Retention Analysis', 'Cohort Analysis', 'Funnel Analysis', 'Hockey Stick Growth',

  // Marketing, Growth & Sales
  'SEO', 'Search Engine Optimization', 'Technical SEO', 'On-page SEO', 'Off-page SEO', 'Local SEO', 'Link Building',
  'SEM', 'Google Ads', 'Bing Ads', 'Meta Ads', 'Facebook Ads', 'Instagram Ads', 'LinkedIn Ads', 'TikTok Ads',
  'Programmatic Advertising', 'Display Advertising', 'Native Advertising', 'Retargeting', 'Remarketing',
  'PPC', 'Cost Per Click', 'CPM', 'ROAS', 'Return on Ad Spend', 'CAC', 'Customer Acquisition Cost', 'LTV',
  'Content Marketing', 'Content Strategy', 'Editorial Calendar', 'Copywriting', 'Ad Copy', 'Email Marketing',
  'Email Automation', 'Newsletters', 'Email Deliverability Marketing', 'ESP', 'Mailchimp', 'Klaviyo', 'HubSpot',
  'Salesforce', 'Salesforce CRM', 'CRM', 'Customer Relationship Management', 'Pipedrive', 'Zoho CRM', 'Close.com',
  'Marketing Automation', 'Lead Scoring', 'Lead Nurturing', 'Lead Generation', 'Demand Generation', 'Inbound Marketing',
  'Outbound Marketing', 'Account Based Marketing', 'ABM', 'Social Media Marketing', 'Social Media Management',
  'Community Management', 'Influencer Marketing', 'Affiliate Marketing', 'Partnership Marketing', 'Referral Marketing',
  'Growth Hacking', 'Growth Loops', 'Viral Marketing', 'Conversion Optimization', 'CRO', 'Landing Pages',
  'Landing Page Design', 'Google Analytics', 'GA4', 'GTM Tag Manager', 'Google Tag Manager', 'Attribution Modeling',
  'Marketing Analytics', 'Marketing KPIs', 'Brand Strategy', 'Brand Awareness', 'Public Relations', 'PR',
  'Media Relations', 'Press Releases', 'Crisis Communications', 'Market Research', 'Competitive Analysis',
  'Customer Surveys', 'NPS', 'Net Promoter Score', 'Surveys', 'Market Segmentation', 'Positioning', 'Messaging',
  'Storytelling', 'Pitch Decks', 'Sales Pitch', 'Cold Outreach', 'Cold Emailing', 'Cold Calling', 'Prospecting',
  'Qualifying Leads', 'BANT', 'MEDDIC', 'Sales Pipeline', 'Pipeline Management', 'Forecasting Sales', 'Closing',
  'Negotiation', 'Objection Handling', 'Discovery Calls', 'Demos', 'Product Demos', 'Proposals', 'Contracts',
  'Upselling', 'Cross-selling', 'Churn Reduction', 'Retention Marketing', 'Customer Retention', 'Renewals',

  // Finance, Accounting & Operations
  'Financial Modeling', 'Excel Modeling', 'Three Statement Model', 'DCF', 'Valuation', 'M&A', 'Due Diligence',
  'Budgeting', 'Forecasting Finance', 'FP&A', 'Variance Analysis', 'Profit and Loss', 'P&L', 'Balance Sheet',
  'Cash Flow', 'Cash Flow Forecasting', 'GAAP', 'IFRS', 'US GAAP', 'Auditing', 'Internal Audit', 'SOX',
  'Sarbanes Oxley', 'Tax Preparation', 'Tax Planning', 'Transfer Pricing', 'Payroll', 'Payroll Processing',
  'Bookkeeping', 'QuickBooks', 'Xero', 'SAP', 'SAP FICO', 'Oracle Financials', 'NetSuite', 'ERP', 'ERP Systems',
  'Accounts Payable', 'Accounts Receivable', 'Invoicing', 'Reconciliation', 'Bank Reconciliation', 'General Ledger',
  'Journal Entries', 'Cost Accounting', 'Managerial Accounting', 'Financial Reporting', 'SEC Reporting', 'EDGAR',
  'Treasury', 'Cash Management', 'Liquidity Management', 'Credit Analysis', 'Credit Risk', 'Underwriting',
  'Investment Analysis', 'Portfolio Management', 'Asset Management', 'Risk Modeling', 'Value at Risk', 'VaR',
  'Derivatives', 'Options', 'Futures', 'Fixed Income', 'Equities', 'Private Equity', 'Venture Capital', 'Angel Investing',
  'IPO', 'Financial Planning', 'Retirement Planning', 'Insurance', 'Claims Management', 'Actuarial Science',
  'Business Analysis', 'Requirements Gathering', 'BRD', 'FRD', 'Functional Requirements', 'Process Mapping',
  'Business Process Modeling', 'BPMN', 'UML', 'Stakeholder Management', 'Requirements Management', 'Gap Analysis',
  'Impact Analysis', 'User Stories', 'Acceptance Criteria', 'Sprint Planning', 'Backlog Management', 'Kanban Board',

  // Project management & methodology
  'Project Management', 'PMBOK', 'Waterfall', 'Agile', 'Scrum', 'Kanban', 'Lean', 'Six Sigma', 'Lean Six Sigma',
  'DMAIC', 'Kaizen', 'Continuous Improvement', 'Process Improvement', 'Workflow Automation', 'OKRs', 'KPIs',
  'Objectives and Key Results', 'Milestones', 'Gantt Charts', 'Critical Path', 'Resource Planning', 'Capacity Planning',
  'Stakeholder Communication', 'Risk Register', 'Change Management', 'ADKAR', 'Agile Transformation', 'SAFe',
  'Scaled Agile', 'Spotify Model', 'Retrospectives', 'Stand-ups', 'Velocity Tracking', 'Burndown Charts',
  'Jira', 'Confluence', 'Asana', 'Monday.com', 'Trello', 'ClickUp', 'Linear', 'Notion', 'Airtable', 'Basecamp',
  'Smartsheet', 'Documentation', 'Technical Documentation', 'API Documentation', 'Wiki Management', 'Knowledge Management',
  'SOP', 'Standard Operating Procedures', 'Playbooks', 'Runbooks', 'Onboarding Documentation', 'Release Notes',
  'Changelog', 'Meeting Facilitation', 'Workshops', 'Facilitation', 'Decision Making', 'Problem Solving',
  'Critical Thinking', 'Analytical Thinking', 'Strategic Thinking', 'Strategic Planning', 'Execution', 'Prioritization Matrix',
  'RACI', 'Cross-functional Collaboration', 'Cross Team Coordination', 'Vendor Management', 'Third-party Management',
  'Contract Negotiation', 'SLA Management', 'Service Level Agreements', 'Procurement', 'Sourcing', 'Request for Proposal',
  'RFP', 'Tendering', 'Bid Management', 'Cost Estimation', 'Budget Management', 'Expense Management', 'Forecast Accuracy',

  // HR & People
  'Recruiting', 'Sourcing', 'Candidate Sourcing', 'Screening', 'Interviewing', 'Behavioral Interviews', 'Technical Interviews',
  'Talent Acquisition', 'Employer Branding', 'ATS', 'Applicant Tracking System', 'Workday', 'BambooHR', 'Greenhouse',
  'Lever', 'Recruiter Workflow', 'Hiring Pipeline', 'Offer Management', 'Onboarding', 'Offboarding', 'Exit Interviews',
  'HRIS', 'Payroll Administration', 'Benefits Administration', 'Compensation Planning', 'Salary Benchmarking', 'Equity Compensation',
  'Performance Management', 'Performance Reviews', '360 Feedback', 'OKR Setting', 'Goal Setting', 'Individual Development Plan',
  'Employee Engagement', 'Pulse Surveys', 'eNPS', 'Culture Building', 'Company Culture', 'DEI', 'Diversity Equity Inclusion',
  'Labor Law', 'Employment Law', 'HR Compliance', 'EEOC', 'FLSA', 'Policy Development', 'HR Policies', 'Employee Handbook',
  'Employee Relations', 'Grievance Handling', 'Disciplinary Action', 'Termination', 'Severance', 'Succession Planning',
  'Talent Review', 'Talent Management', 'People Analytics', 'Workforce Planning', 'Headcount Planning', 'Org Design',
  'Organizational Design', 'Change Management People', 'Training and Development', 'LMS', 'Learning Management System',
  'E-learning', 'Instructional Design', 'Curriculum Design', 'Course Creation', 'Mentoring', 'Coaching', 'Leadership Development',
  'Executive Coaching', 'Public Speaking', 'Presentation Skills', 'Communication Skills', 'Interpersonal Skills',
  'Team Building', 'Conflict Resolution', 'Feedback', 'Active Listening', 'Empathy', 'Emotional Intelligence',
  'Adaptability', 'Resilience', 'Time Management', 'Organization', 'Attention to Detail', 'Multitasking', 'Remote Collaboration',
  'Distributed Teams', 'Asynchronous Communication', 'Written Communication', 'Verbal Communication', 'Persuasion', 'Influence',
  'Leadership', 'Management', 'People Management', 'Team Leadership', 'Motivation', 'Delegation', 'Empowerment', 'Accountability',

  // Design & creative tools
  'Photography', 'Photo Editing', 'Lightroom', 'Color Grading', 'Sound Design', 'Audio Mixing', 'Mastering',
  'Music Production', 'Ableton', 'Logic Pro', 'Pro Tools', 'FL Studio', 'Video Production', 'Video Editing',
  'Storyboarding', 'Scriptwriting', 'Narrative Design', 'World Building', 'Level Design', 'Game Design',
  'Game Balance', 'Unity', 'Unreal Engine', 'Godot', 'Playtesting', 'Game Analytics', 'LiveOps',
  'Motion Capture', 'Rigging', 'Texturing', 'UV Mapping', 'Substance Painter', 'Digital Painting', 'Concept Art',
  'Character Design', 'Story Art', 'Compositing', 'VFX', 'Visual Effects', 'Keying', 'Rotoscoping',
  'Localization', 'i18n', 'Internationalization', 'Translation', 'Transcreation', 'Subtitling', 'Dubbing',

  // Industry-specific
  'CAD', 'AutoCAD', 'SolidWorks', 'CATIA', 'Fusion 360', 'Revit', 'BIM', 'Building Information Modeling',
  'Architecture Design', 'Interior Design', 'Landscape Design', 'Construction Management', 'Construction Scheduling',
  'Blueprint Reading', 'Site Management', 'Safety Compliance', 'OSHA', 'Construction Safety', 'EHS',
  'Environmental Health and Safety', 'HSE', 'ISO 14001', 'ISO 9001', 'Quality Management', 'QMS', 'SPC',
  'Statistical Process Control', 'FMEA', 'Failure Mode Analysis', 'Root Cause Analysis', 'RCA', '8D', '5 Whys',
  'Fishbone Diagram', 'Ishikawa', 'Pareto Analysis', 'Lean Manufacturing', 'JIT', 'Just in Time', '5S', 'TPM',
  'PLC Programming', 'SCADA', 'HMI', 'Siemens PLC', 'Allen Bradley', 'Robotics', 'Robot Programming', 'FANUC',
  'CNC Machining', 'CNC Programming', 'G-code', 'CAM', 'Mastercam', 'Precision Machining', 'Metal Fabrication',
  'Welding', 'MIG Welding', 'TIG Welding', 'Soldering', 'Electronics Assembly', 'PCB Design', 'Altium', 'KiCad',
  'Circuit Design', 'SPICE', 'Signal Processing', 'Embedded C', 'RTOS', 'FreeRTOS', 'Bare Metal Programming',
  'Electrical Systems', 'Power Distribution', 'Transformer', 'Switchgear', 'Generator', 'Solar Installation',
  'Photovoltaic', 'Wind Energy', 'Battery Systems', 'Energy Storage', 'Grid Integration', 'Smart Grid',
  'Water Treatment', 'Wastewater Treatment', 'Pump Systems', 'HVAC', 'Refrigeration', 'Boiler', 'Chiller',
  'Piping', 'P&ID', 'PFD', 'Chemical Process', 'Unit Operations', 'Distillation', 'Reactor Design', 'Pharmaceutical Manufacturing',
  'GMP', 'Good Manufacturing Practices', 'Cleanroom', 'ISO Class Cleanroom', 'Validation', 'Qualification', 'IQ/OQ/PQ',
  'Clinical Trials', 'Regulatory Affairs', 'FDA', 'EMA', 'Pharmacovigilance', 'Medical Writing', 'Biostatistics',
  'Patient Care', 'Nursing', 'Clinical Documentation', 'Medical Coding', 'ICD-10', 'CPT Coding', 'EMR', 'EHR',
  'Electronic Health Records', 'Epic', 'Cerner', 'Telehealth', 'HIPAA Compliance', 'Health Informatics', 'Public Health',
  'Epidemiology', 'Biostatistics Health', 'Case Management', 'Care Planning', 'First Aid', 'CPR', 'Emergency Response',
  'Education', 'Teaching', 'Lesson Planning', 'Classroom Management', 'Curriculum Development', 'Differentiated Instruction',
  'Educational Technology', 'EdTech', 'Gamification', 'Assessment Design', 'Grading', 'Student Mentoring', 'Academic Advising',
  'Research Methodology', 'Literature Review', 'Systematic Review', 'Meta-analysis', 'Qualitative Research', 'Quantitative Research',
  'Survey Design', 'Questionnaire Design', 'Data Collection', 'Field Research', 'Ethnography', 'Grounded Theory',
  'Academic Writing', 'Peer Review', 'Publication', 'Citation', 'Reference Management', 'Zotero', 'EndNote',
  'Library Science', 'Cataloging', 'Metadata', 'Digitization', 'Records Management', 'Archival Science',
  'Geographic Information Systems', 'GIS', 'QGIS', 'ArcGIS', 'Remote Sensing', 'Satellite Imagery', 'Spatial Analysis',
  'Cartography', 'Surveying', 'Topography', 'Geology', 'Geophysics', 'Seismic Interpretation', 'Mineral Exploration',
  'Drilling', 'Well Logging', 'Reservoir Simulation', 'Production Engineering', 'Refinery', 'Pipelines Oil and Gas',
  'Maritime', 'Navigation', 'Seamanship', 'Port Operations', 'Freight Forwarding', 'Customs Clearance', 'Incoterms',
  'Shipping', 'Ocean Freight', 'Air Freight', 'Ground Transport', 'Last Mile Delivery', 'Route Optimization',
  'Inventory Control', 'Stock Management', 'Cycle Counting', 'SKU Management', 'Demand Planning', 'Supply Planning',
  'Forecasting Demand', 'MRP', 'Material Requirements Planning', 'Vendor Managed Inventory', 'Just in Time Inventory',
  'Third Party Logistics', '3PL', 'Warehouse Management System', 'WMS', 'Transportation Management System', 'TMS',
  'Retail Operations', 'Merchandising', 'Planogram', 'Visual Merchandising', 'Store Layout', 'Point of Sale', 'POS',
  'Retail Analytics', 'Loss Prevention', 'Shrinkage', 'Customer Experience', 'CX', 'Omnichannel', 'Omni-channel Retail',
  'E-commerce', 'Ecommerce', 'Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'Amazon Marketplace', 'FBA',
  'Product Listing', 'Catalogue Management', 'Pricing Strategy', 'Dynamic Pricing', 'Discounting', 'Promotions',
  'Food Safety', 'HACCP', 'Food Handling', 'Culinary Skills', 'Menu Planning', 'Restaurant Operations', 'Hospitality Management',
  'Hotel Operations', 'Front Desk Operations', 'Guest Services', 'Housekeeping Standards', 'Event Planning', 'Catering',
  'Sports Coaching', 'Fitness Programming', 'Personal Training Certification', 'Exercise Prescription', 'Injury Prevention',
  'Sports Rehabilitation', 'Biomechanics', 'Kinesiology', 'Wellness Programs', 'Corporate Wellness', 'Meditation', 'Mindfulness',
  'Journalism', 'Reporting', 'News Writing', 'Interviewing Skills', 'Fact Checking', 'Editing', 'Copy Editing', 'Proofreading',
  'Content Management System', 'CMS', 'WordPress', 'Headless CMS', 'Sanity', 'Contentful', 'Storyblok', 'Ghost CMS',
  'SEO Writing', 'Long-form Content', 'Short-form Content', 'Microcopy', 'UX Writing', 'Voice and Tone', 'Brand Voice',
  'Editing Video', 'Podcasting', 'Audio Editing', 'Broadcasting', 'Live Streaming', 'Streaming Platform', 'Twitch',
  'Esports', 'Esports Broadcasting', 'Community Events', 'Event Marketing', 'Trade Shows', 'Exhibitions', 'Sponsorship',
  'Fundraising', 'Grant Writing', 'Nonprofit Management', 'Donor Management', 'Volunteer Management', 'Advocacy',
  'Policy Analysis', 'Legislative Affairs', 'Government Relations', 'Regulatory Compliance', 'Public Affairs',
  'Political Campaigns', 'Public Opinion Research', 'Stakeholder Engagement', 'Community Outreach', 'Public Engagement',
  'Emergency Management', 'Business Continuity', 'Disaster Recovery', 'DR Plan', 'Backup Strategy', 'RTO', 'RPO',
  'Site Reliability Practices', 'SRE Principles', 'Error Budgets', 'Postmortems', 'Blameless Culture', 'Blameless Postmortems',
  'Version Control', 'Git', 'GitHub', 'GitLab', 'Bitbucket', 'Code Review Process', 'Branching Strategy', 'Trunk Based Development',
  'Monorepo', 'Lerna', 'Turborepo', 'Nx', 'Package Management', 'npm', 'yarn', 'pnpm', 'Bun',
  'Testing Frameworks', 'Jest', 'Vitest', 'Mocha', 'Cypress', 'Playwright', 'Selenium', 'Puppeteer', 'TestCafe',
  'Unit Testing', 'Integration Testing', 'End-to-end Testing', 'E2E', 'Smoke Testing', 'Regression Testing', 'Contract Testing',
  'Performance Testing', 'Load Testing', 'JMeter', 'k6', 'Locust', 'Stress Testing', 'Capacity Testing',
  'Mobile Testing', 'Appium', 'Detox', 'Emulator Testing', 'Device Farm', 'BrowserStack', 'Sauce Labs',
  'Code Coverage', 'Mutation Testing', 'Test Strategy', 'Test Planning', 'Test Case Design', 'Exploratory Testing',
  'Accessibility Testing', 'Lighthouse', 'axe', 'Pa11y', 'Screen Reader Testing', 'Keyboard Navigation',
  'Web Performance', 'Core Web Vitals', 'LCP', 'INP', 'CLS', 'Page Speed', 'Lighthouse Scores', 'Image Optimization',
  'Caching', 'HTTP Caching', 'CDN Caching', 'Browser Caching', 'Compression', 'Gzip', 'Brotli', 'Minification',
  'SEO Performance', 'Sitemap', 'Robots.txt', 'Structured Data', 'Schema.org', 'JSON-LD', 'Open Graph', 'Canonical URLs',
  'Redirects', '301 Redirects', 'URL Structure', 'Site Architecture', 'Crawl Budget', 'Indexing', 'Google Search Console',
  'Bing Webmaster Tools', 'Local Listings', 'Google Business Profile', 'Review Management', 'Reputation Management',
  'Online Reputation', 'Crisis Management', 'Social Listening', 'Trend Analysis', 'Viral Content', 'Engagement Rate',
  'Follower Growth', 'Community Growth', 'Discord Moderation', 'Slack Management', 'Community Platforms', 'Reddit Marketing',
  'Newsletter Growth', 'Email List Building', 'Lead Magnets', 'Funnel Building', 'Sales Funnel', 'Marketing Funnel',
  'Customer Journey', 'User Journey', 'Touchpoints', 'Moments that Matter', 'Experience Mapping', 'Service Blueprint',
  'Blue Ocean Strategy', 'Porter Five Forces', 'SWOT', 'PESTEL', 'Business Model Canvas', 'Lean Canvas', 'Value Proposition',
  'Design Thinking', 'Sprint Methodology', 'Google Ventures Sprint', 'Ideation', 'Brainstorming', 'Prototyping Workshop',
  'Product Led Growth', 'PLG', 'Sales Led Growth', 'Bottom-up Adoption', 'Self-serve', 'Free Trial', 'Freemium',
  'Pricing Models', 'Subscription Pricing', 'Usage Based Pricing', 'Tiered Pricing', 'Monetization', 'Unit Economics',
  'Gross Margin', 'Net Revenue Retention', 'NRR', 'MRR', 'ARR', 'Recurring Revenue', 'Customer Lifetime Value', 'CLV',
];

// ────────────────────────────────────────────────────────────────────────────
// Trending (shown when the search box is empty)
// ────────────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────────────
// Matching — generic, prefix-priority, no domain detection
// ────────────────────────────────────────────────────────────────────────────

function matchAll(list: string[], query: string, limit: number): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const item of list) {
    const l = item.toLowerCase();
    if (l.startsWith(q)) starts.push(item);
    else if (l.includes(q)) contains.push(item);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

export function getRoleSuggestions(query: string): string[] {
  const q = query.trim();
  if (!q) return TRENDING_ROLES.slice(0, 10);
  return matchAll(JOB_TITLES, q, 12);
}

export function getKeywordSuggestions(query: string): string[] {
  const q = query.trim();
  if (!q) return TRENDING_KEYWORDS.slice(0, 10);
  return matchAll(SKILLS, q, 12);
}

// ────────────────────────────────────────────────────────────────────────────
// Predefined lists (kept for Master CV + other screens)
// ────────────────────────────────────────────────────────────────────────────

export const PREDEFINED_ROLES = TRENDING_ROLES;
export const PREDEFINED_KEYWORDS = TRENDING_KEYWORDS;
export const PREDEFINED_LOCATIONS = [
  'Worldwide',
  'United States',
  'United Kingdom',
  'India',
  'Singapore',
  'Germany',
  'Netherlands',
  'Canada',
  'Australia',
  'United Arab Emirates',
  'Remote',
];

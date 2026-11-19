// Single source of truth for both the standard page and the drive mode.
// Content is taken from RESUMES/Haani__Siddiqui_CV (1).pdf.

export const profile = {
  name: "Haani Shafiq Siddiqui",
  first: "Haani Shafiq",
  last: "Siddiqui",
  role: "Technical Support Engineer & Implementation Specialist",
  location: "Lahore, Pakistan",
  email: "haanisiddiqui76@gmail.com",
  summary:
    "I sit between clinics, product and engineering on an AI healthcare SaaS platform: onboarding US radiology and vascular clinics, wiring up DICOM, HL7 and EMR integrations (Epic, AthenaHealth), and digging through network configs, Sentry logs and SQL until the root cause turns up. On the side I build hydrology and ML tools for flood forecasting.",
  rotating: ["networks", "DICOM", "VPNs", "firewalls", "EMR integrations", "AWS servers"],
};

export const stats = [
  { value: "3+", label: "years in support" },
  { value: "90%", label: "SLA compliance" },
  { value: "90%", label: "client retention" },
  { value: "−80%", label: "manual DICOM work, via my OCR tool" },
];

export type Job = { when: string; title: string; org: string; current?: boolean; points: string[] };
export const jobs: Job[] = [
  {
    when: "Dec 2023 – now",
    title: "Technical Support Engineer (L1 + L2)",
    org: "SarcMedIQ · AI Healthcare SaaS · US, remote",
    current: true,
    points: [
      "Built a Python DICOM OCR tool (pydicom + Tesseract) that cut manual measurement extraction by 80%, plus a DICOM SR mapping script saving 60%.",
      "Configured DICOM Modality Worklists fed from Epic and AthenaHealth EMRs.",
      "Networked clinical workstations and imaging devices: static IP, DNS, ports, VPN, firewall, C-STORE/C-MOVE.",
      "Provisioned AWS EC2 and Windows Server VMs; migrated on-prem workloads to the cloud.",
      "Led onboarding for US clinics with 90% SLA compliance and 90% retention.",
    ],
  },
  {
    when: "Jul – Dec 2023",
    title: "Airbnb Associate",
    org: "Digitech Outsourcing · Hospitality",
    points: ["25–30 calls and chats a day for short-stay properties across the US, Canada and Germany, at 80% CSAT with replies under 5 minutes."],
  },
  {
    when: "Jun 2022 – Jun 2023",
    title: "Customer Support Executive",
    org: "Mindbridge · Foodpanda",
    points: ["100–120 chats a day across the Philippines, Singapore and Malaysia, at 4.5/5 CSAT with a 25-second first response."],
  },
];

export type Project = { name: string; blurb: string; tags: string[]; href?: string; cta?: string; feature?: boolean };
export const projects: Project[] = [
  {
    name: "HydroSentinel",
    blurb: "A full-stack, AI-powered flood intelligence and early-warning platform that ingests real-time streamflow from ten major USGS river gauges.",
    tags: ["Python", "ML", "USGS API", "Full-stack"],
    href: "https://github.com/Haani76/HydroSentinel---Flood-Intelligence-Early-Warning-System",
    feature: true,
  },
  {
    name: "HydroML-Fusion",
    blurb: "A multi-model ensemble forecaster combining physics-based models, ML and deep learning, with climate-scenario analysis.",
    tags: ["Deep learning", "Ensembles"],
    href: "https://github.com/Haani76/hydroml-fusion",
  },
  {
    name: "ANN Streamflow Prediction",
    blurb: "Research project benchmarking neural networks for streamflow (R², RMSE, MAE), served through FastAPI and Streamlit.",
    tags: ["TensorFlow", "FastAPI", "Streamlit"],
    href: "https://github.com/Haani76/ANN-Streamflow-Prediction",
  },
  {
    name: "Schema Mapping Platform",
    blurb: "An NER model that maps messy customer spreadsheet columns to a standard schema. The model is published on Hugging Face.",
    tags: ["NLP", "Hugging Face", "Streamlit"],
    href: "https://schema-mapping-platform-apbvzvujnb8gthfwdiuf63.streamlit.app/",
    cta: "Live demo",
  },
  {
    name: "RAG Analytics Chatbot",
    blurb: "A retrieval-augmented chatbot for asking questions about analytics data in plain language.",
    tags: ["RAG", "LLMs"],
    href: "https://github.com/Haani76/rag-analytics-chatbot",
  },
  {
    name: "DICOM OCR Extractor",
    blurb: "A production tool at SarcMedIQ that pulls burned-in measurements from bulk ultrasound images, cutting manual work by 80%.",
    tags: ["pydicom", "Tesseract", "Healthcare"],
  },
];

export const education = [
  { mark: "MSc", meta: "Masters · HEC merit scholarship (2024)", title: "University of Engineering & Technology (UET)" },
  { mark: "BS", meta: "Software Engineering · 2021", title: "Mirpur University of Science & Technology (MUST)" },
  { mark: "N+", meta: "In progress · NVTTI", title: "CompTIA Network+ (N10-009)" },
  { mark: "#19", meta: "Province-wide · BISE Quetta (2015)", title: "19th position, Matriculation" },
];

export const skills: { group: string; wide?: boolean; items: string[] }[] = [
  { group: "Networking", wide: true, items: ["TCP/IP", "UDP", "DNS", "Static IP / DHCP", "Subnet & gateway", "Port config", "Firewall rules", "IP whitelisting", "VPN", "ipconfig", "netstat", "netsh", "tracert"] },
  { group: "Healthcare IT", items: ["DICOM", "HL7", "Modality Worklist", "C-STORE / C-MOVE", "Epic", "AthenaHealth", "EMR integration"] },
  { group: "Cloud & Infra", items: ["AWS EC2", "RDS", "S3", "CloudFront", "Route 53", "Azure AD", "Windows Server", "RDP"] },
  { group: "Code & Data", wide: true, items: ["Python", "SQL", "Pandas", "NumPy", "TensorFlow", "REST APIs", "JSON / XML", "HTML", "CSS", "Django templates", "Linux / WSL", "Sentry"] },
  { group: "Microsoft 365", items: ["Exchange Online", "Intune", "MFA / SSO", "Teams", "SharePoint"] },
  { group: "Tools", items: ["Jira", "Confluence", "HubSpot", "Zendesk", "Zoho", "Salesforce"] },
  { group: "Languages", items: ["English · professional", "Urdu · native"] },
];

export const socials = [
  { label: "Email", href: `mailto:${profile.email}` },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/haanisiddiqui/" },
  { label: "GitHub", href: "https://github.com/Haani76" },
  { label: "Hugging Face", href: "https://huggingface.co/Haani76" },
];

// Order = order on the page and order of checkpoints on the road.
export const sections = [
  { id: "about", label: "About", title: "Part engineer, ", em: "part translator." },
  { id: "work", label: "Experience", title: "Where I've ", em: "shipped fixes." },
  { id: "projects", label: "Projects", title: "Things I've ", em: "built." },
  { id: "edu", label: "Education", title: "Always ", em: "learning." },
  { id: "skills", label: "Skills", title: "What's in the ", em: "toolbox." },
  { id: "contact", label: "Contact", title: "Let's ", em: "talk." },
] as const;

export type SectionId = (typeof sections)[number]["id"];

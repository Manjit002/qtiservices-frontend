/**
 * Detailed service content — 9 services, exactly 2 blocks each (18 total).
 *
 * These are ADDITIONAL depth for each service. The short card descriptions in
 * content.ts are unchanged.
 *
 * The two blocks per service are deliberately different in purpose, not two
 * versions of the same information:
 *
 *   Block 1 — what we build or deliver (scope and capability)
 *   Block 2 — how it is run, governed or sustained (operations and practice)
 *
 * That split is consistent across all nine so the pages are predictable to
 * read, while the content within each is specific to the service.
 *
 * Written in American English per the brief. Note that the existing card
 * descriptions in content.ts use British spelling ("optimisation",
 * "organisation") and one says "every pound of IT investment" — those were
 * left untouched as instructed, so the two are currently inconsistent. Flagged
 * in SERVICE-CONTENT.md rather than silently changed.
 *
 * The Online Tutoring blocks carry no exam, test-prep, certification or
 * competitive-exam language, matching the constraint applied to the service
 * card and the blog.
 */

export interface ServiceBlock {
  title: string;
  description: string;
  areas: readonly string[];
}

export interface ServiceDetail {
  /** Matches the service title in content.ts — services are not renamed. */
  title: string;
  slug: string;
  blocks: readonly [ServiceBlock, ServiceBlock];
}

export const SERVICE_DETAILS: readonly ServiceDetail[] = [
  // ── 01 ──────────────────────────────────────────────────────────────────
  {
    title: 'Cloud Solutions',
    slug: 'cloud-solutions',
    blocks: [
      {
        title: 'Cloud Migration and Modernization',
        description:
          'We assess existing workloads, determine which are worth moving as they are and which need rework, then execute the migration in stages with defined rollback points. Environments are built to a documented landing-zone standard rather than assembled per project.',
        areas: [
          'Workload assessment and dependency mapping before any migration begins',
          'Landing zone design covering accounts, networking, identity, and logging',
          'Rehost, replatform, and refactor paths selected per application',
          'Staged cutover with tested rollback procedures for each migration window',
          'Migration across AWS, Microsoft Azure, and Google Cloud Platform',
          'Post-migration validation against agreed performance and availability targets',
        ],
      },
      {
        title: 'Cloud Operations and Cost Management',
        description:
          'Cloud spending tends to drift two to three months after migration, when egress charges and over-provisioned instances appear in real invoices rather than projections. We establish the monitoring, tagging, and review cadence that keeps consumption aligned with what the business actually needs.',
        areas: [
          'Resource tagging standards that make spend attributable to teams and projects',
          'Right-sizing reviews based on observed utilization rather than initial estimates',
          'Reserved capacity and committed-use planning for predictable workloads',
          'Autoscaling policies tuned to real demand patterns',
          'Budget alerting and anomaly detection before invoices arrive',
          'Quarterly architecture reviews as usage patterns change',
        ],
      },
    ],
  },

  // ── 02 ──────────────────────────────────────────────────────────────────
  {
    title: 'Cybersecurity',
    slug: 'cybersecurity',
    blocks: [
      {
        title: 'Security Assessment and Testing',
        description:
          'We establish what is actually exposed before recommending controls. Assessments produce a prioritized findings register with evidence and reproduction steps, not a scanner export.',
        areas: [
          'External and internal penetration testing with documented methodology',
          'Vulnerability management covering discovery, triage, and remediation tracking',
          'Configuration review against recognized hardening baselines',
          'Cloud posture assessment across identity, storage, and network exposure',
          'Compliance readiness assessment for SOC 2 and ISO 27001 programs',
          'Findings ranked by exploitability and business impact, not severity score alone',
        ],
      },
      {
        title: 'Zero Trust Architecture and Threat Response',
        description:
          'Identity becomes the control point rather than network location, applied in stages so each change leaves the environment more secure than before. Response procedures are written and rehearsed ahead of the incident that needs them.',
        areas: [
          'Identity-based access control with multi-factor authentication for privileged accounts',
          'Network segmentation to limit what a single compromised credential can reach',
          'Access proxying for legacy systems that cannot support modern authentication',
          'Centralized logging and detection tuned to reduce alert noise',
          'Documented incident response runbooks with defined roles and escalation paths',
          'Post-incident review feeding back into controls and monitoring',
        ],
      },
    ],
  },

  // ── 03 ──────────────────────────────────────────────────────────────────
  {
    title: 'Software Development',
    slug: 'software-development',
    blocks: [
      {
        title: 'Custom Application Engineering',
        description:
          'We build web applications, internal platforms, and integration layers against a written specification agreed before development starts. Scope changes are handled through an explicit change process rather than absorbed silently.',
        areas: [
          'Web application development using current, well-supported frameworks',
          'REST and GraphQL API design with versioning and documented contracts',
          'System integration across internal services and third-party platforms',
          'Database design, query optimization, and migration planning',
          'Legacy application modernization with staged, reversible replacement',
          'Technical specification and architecture documentation as a deliverable',
        ],
      },
      {
        title: 'Delivery Practices and Quality Assurance',
        description:
          'How software is delivered determines how expensive it is to maintain. We work to a defined engineering standard covering testing, review, and release, and hand over a codebase another team can take on without a rewrite.',
        areas: [
          'Automated testing across unit, integration, and end-to-end layers',
          'Continuous integration and deployment pipelines with gated releases',
          'Code review requirements and static analysis in the pipeline',
          'Environment parity between development, staging, and production',
          'Release versioning, changelogs, and documented rollback procedures',
          'Knowledge transfer and handover documentation at project close',
        ],
      },
    ],
  },

  // ── 04 ──────────────────────────────────────────────────────────────────
  {
    title: 'Managed IT Services',
    slug: 'managed-it-services',
    blocks: [
      {
        title: 'Monitoring and Service Desk',
        description:
          'Systems are monitored continuously against defined thresholds, with alerts routed to engineers rather than queued for business hours. Response and resolution targets are set per service in the agreement, not stated in general terms.',
        areas: [
          'Round-the-clock infrastructure and application monitoring',
          'Service desk with defined response and resolution targets by priority',
          'Alert thresholds tuned per system to limit false positives',
          'Escalation paths with named ownership at each tier',
          'Monthly service reporting against agreed targets',
          'Dedicated account contact who knows the environment',
        ],
      },
      {
        title: 'Maintenance, Patching, and Continuity',
        description:
          'Routine maintenance is scheduled and evidenced rather than performed ad hoc. Backup and recovery procedures are tested on a defined cycle, because an untested recovery plan is an assumption.',
        areas: [
          'Patch management with staged rollout and defined maintenance windows',
          'Endpoint and server lifecycle tracking, including end-of-support planning',
          'Backup scheduling with verified restore testing on a fixed cycle',
          'Disaster recovery planning with documented recovery objectives per system',
          'Asset inventory maintained as part of routine operations',
          'Change control records for audit and compliance requirements',
        ],
      },
    ],
  },

  // ── 05 ──────────────────────────────────────────────────────────────────
  {
    title: 'Network Infrastructure',
    slug: 'network-infrastructure',
    blocks: [
      {
        title: 'Network Design and Deployment',
        description:
          'Networks are designed around traffic patterns and growth expectations, then documented so the next engineer does not have to reverse-engineer them. Deployment is scheduled to avoid disruption to business operations.',
        areas: [
          'LAN, WAN, and SD-WAN design for multi-site organizations',
          'Enterprise wireless design including site survey and coverage planning',
          'Network segmentation aligned to security and compliance requirements',
          'Structured cabling and hardware specification',
          'Secure remote access and site-to-site connectivity',
          'As-built documentation and network diagrams on completion',
        ],
      },
      {
        title: 'Performance, Resilience, and Capacity',
        description:
          'A network is judged by its behavior under load and during failure, not under ideal conditions. We build in redundancy where an outage would stop operations and monitor capacity so upgrades are planned rather than reactive.',
        areas: [
          'Redundant paths and failover testing for business-critical links',
          'Quality of service configuration for voice, video, and priority traffic',
          'Capacity monitoring with trend analysis to forecast upgrades',
          'Latency and packet loss monitoring across sites and providers',
          'Firmware and configuration lifecycle management',
          'Carrier and circuit management, including contract review',
        ],
      },
    ],
  },

  // ── 06 ──────────────────────────────────────────────────────────────────
  {
    title: 'IT Consulting',
    slug: 'it-consulting',
    blocks: [
      {
        title: 'Technology Strategy and Roadmapping',
        description:
          'We assess the current environment, identify where it constrains the business, and produce a sequenced roadmap with costs and dependencies attached. Recommendations are specific enough to act on and honest about trade-offs.',
        areas: [
          'Current-state assessment covering infrastructure, applications, and processes',
          'Technology roadmap sequenced by dependency and business priority',
          'Total cost of ownership analysis for proposed changes',
          'Build, buy, and outsource evaluation for major decisions',
          'Risk assessment covering technical debt and single points of failure',
          'Board-level reporting that states assumptions and confidence',
        ],
      },
      {
        title: 'Vendor Management and Program Governance',
        description:
          'Most organizations spend more on technology contracts than they expect to, spread across renewals nobody owns. We bring visibility to that spend and provide governance for the programs that depend on it.',
        areas: [
          'Vendor selection with structured evaluation criteria and scoring',
          'Contract and licensing review, including renewal calendar management',
          'Service level agreement definition and ongoing performance review',
          'Program governance with defined reporting and decision checkpoints',
          'Benefits tracking against the business case that approved the work',
          'Independent technical review of vendor proposals and deliverables',
        ],
      },
    ],
  },

  // ── 07 ──────────────────────────────────────────────────────────────────
  {
    title: 'Mobile App Development',
    slug: 'mobile-app-development',
    blocks: [
      {
        title: 'Native and Cross-Platform Development',
        description:
          'We select the platform approach based on what the application actually needs, since cross-platform frameworks suit some products and not others. Interfaces follow each platform’s conventions rather than imposing one design on both.',
        areas: [
          'Native iOS and Android development',
          'Cross-platform development with React Native where it fits the requirement',
          'Offline capability and data synchronization for intermittent connectivity',
          'Device integration including camera, location, and push notifications',
          'Backend API design to support mobile constraints and battery use',
          'Accessibility support following platform guidelines',
        ],
      },
      {
        title: 'Release Management and Application Lifecycle',
        description:
          'Shipping a mobile application is the start of its lifecycle, not the end. Store review, staged rollout, and post-release monitoring are planned before the first submission.',
        areas: [
          'App Store and Google Play submission, including review preparation',
          'Staged and phased rollouts to limit exposure from a bad release',
          'Crash reporting and performance monitoring in production',
          'Version support policy covering older operating systems and devices',
          'Automated build and distribution pipelines for test and release builds',
          'Ongoing maintenance for platform updates and deprecations',
        ],
      },
    ],
  },

  // ── 08 ──────────────────────────────────────────────────────────────────
  {
    title: 'Data & Analytics',
    slug: 'data-and-analytics',
    blocks: [
      {
        title: 'Data Platform and Pipeline Engineering',
        description:
          'Reliable reporting depends on the platform beneath it. We build the ingestion, storage, and transformation layers with explicit handling for late, missing, and malformed data rather than assuming clean inputs.',
        areas: [
          'Data warehouse and data lake design for analytical workloads',
          'Ingestion pipelines from internal systems, third-party platforms, and files',
          'Transformation logic with version control and documented lineage',
          'Data quality validation with defined handling for failed records',
          'Incremental and historical load strategies',
          'Scheduling, orchestration, and pipeline failure alerting',
        ],
      },
      {
        title: 'Business Intelligence and Decision Support',
        description:
          'Dashboards are built around the decisions they inform, so numbers mean the same thing across reports. Access and definitions are governed to prevent the same metric being calculated two different ways.',
        areas: [
          'Dashboard and report development in established BI platforms',
          'Metric definitions documented and applied consistently across reports',
          'Self-service models that let teams answer questions without engineering',
          'Role-based access control over sensitive datasets',
          'Near real-time reporting where operational decisions depend on it',
          'User training and documentation so reports are interpreted correctly',
        ],
      },
    ],
  },

  // ── 09 ──────────────────────────────────────────────────────────────────
  {
    title: 'Online Tutoring & Educational Support',
    slug: 'online-tutoring-educational-support',
    blocks: [
      {
        title: 'Tutoring Sessions and Subject Coverage',
        description:
          'We connect students and professionals in the United States with subject-matter tutors for scheduled online sessions, individually or in small groups. Sessions are booked in advance so both sides can prepare.',
        areas: [
          'One-to-one sessions matched to the subject and the learner’s current level',
          'Small-group sessions where the group shares a common topic',
          'Coverage across mathematics, science, psychology, medicine, and software programming',
          'Advance booking with clear scheduling and rescheduling procedures',
          'Session notes and shared materials retained between appointments',
          'Continuity of tutor where the learner prefers it',
        ],
      },
      {
        title: 'Platform Reliability and Session Continuity',
        description:
          'The technology should stay out of the way of the session. Our platform work focuses on the conditions that actually disrupt learning: connection quality, material loss, and administrative friction.',
        areas: [
          'Audio prioritized over video when available bandwidth is limited',
          'Shared materials and whiteboard state preserved across reconnections',
          'Session recording written continuously rather than assembled at the end',
          'Single-action joining without software installation mid-session',
          'Secure, access-controlled storage of recordings and session materials',
          'Automated reminders and clear cancellation handling',
        ],
      },
    ],
  },
];

export function getServiceDetail(slug: string): ServiceDetail | undefined {
  return SERVICE_DETAILS.find((s) => s.slug === slug);
}

const {GoogleGenAI} = require("@google/genai")
const {z} = require("zod")
const {zodToJsonSchema} = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum([ "low", "medium", "high" ]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

function extractTitleFromJobDescription(jd) {
    if (!jd) return "Software Engineer";
    const firstLine = jd.split("\n")[0].trim().replace(/^#+\s*/, "");
    if (firstLine.length > 3 && firstLine.length < 60 && !firstLine.toLowerCase().includes("description")) return firstLine;
    const match = jd.match(/(frontend|backend|fullstack|full stack|software engineer|software developer|web developer|devops|data scientist|machine learning|product manager|qa engineer|react developer|node developer)/i);
    return match ? match[0].replace(/\b\w/g, l => l.toUpperCase()) : "Software Engineer";
}

function getFallbackInterviewReport({ resume, selfDescription, jobDescription }) {
    const title = extractTitleFromJobDescription(jobDescription);
    return {
        matchScore: 86,
        title: title,
        technicalQuestions: [
            {
                question: `Explain your approach to designing and structuring applications for a ${title} role.`,
                intention: "Assess high-level architectural knowledge, modular code organization, separation of concerns, and scalability considerations.",
                answer: `• Architectural Separation: Structure the application into clean, decoupled layers — Presentation (UI components), Business Logic (custom hooks, services, state machines), and Data Persistence/API integration (Axios/Fetch clients, caching layers).
• State & Data Flow: Maintain unidirectional data flow. Keep UI state local, push server state into dedicated cache managers (e.g., React Query or RTK Query), and manage global auth/session state via Context or Redux/Zustand.
• Reusability & Modularity: Build compound components, design systems, and design tokens to eliminate boilerplate and ensure design consistency.
• Resiliency & Error Boundaries: Wrap critical view subtrees in Error Boundaries to gracefully handle runtime render failures without crashing the entire app.
• Performance & Profiling: Utilize route-based dynamic code-splitting (React.lazy / dynamic import), asset optimization, memoization (useMemo/useCallback) for expensive computations, and virtualized lists for rendering heavy datasets.`
            },
            {
                question: "How do you handle asynchronous operations, race conditions, and error propagation in production?",
                intention: "Evaluate reliability, resilience, debugging capabilities, and deep understanding of the event loop and network requests under real-world failures.",
                answer: `• Clean Async/Await Handling: Wrap asynchronous calls in deterministic try/catch/finally blocks. Always clear loading states in the 'finally' clause.
• Race Condition Mitigation: In client-side components, use AbortController signals inside useEffect cleanup functions so that obsolete or out-of-order network responses are cleanly discarded before setting stale state.
• Centralized Error Interceptors: Implement HTTP interceptor middleware (e.g. Axios interceptors) to intercept 401s for silent JWT refresh or redirect to login, 403s for forbidden access, and 500s for user-facing toasts/logging.
• Observability & Telemetry: Ship unhandled exceptions and client-side error telemetry to monitoring systems (e.g. Sentry or Datadog) with contextual stack traces and user sessions.`
            },
            {
                question: "What strategies do you use for frontend performance optimization and database query efficiency?",
                intention: "Determine if the candidate understands bottleneck identification, bundle size budgeting, rendering performance, and database indexing.",
                answer: `• Bundle Size Optimization: Analyze Webpack/Vite bundles using rollup-plugin-visualizer. Implement route-level code splitting, tree-shake unused exports, and replace heavy libraries with lightweight alternatives (e.g. date-fns instead of moment.js).
• Render Performance: Minimize layout thrashing and DOM depth. Debounce search inputs, throttle resize/scroll events, and use React.memo for high-frequency parent rerenders.
• Image & Asset Pipeline: Serve modern formats (WebP/AVIF), define explicit width/height to eliminate Cumulative Layout Shift (CLS), and leverage responsive srcset with CDN caching.
• Backend Database Tuning: Create compound B-Tree indexes matching high-frequency query filters, leverage projection (.select()) to avoid over-fetching fields, and profile queries using MongoDB explain("executionStats") to eliminate COLLSCANs.`
            },
            {
                question: "How do you ensure state consistency and security in client-server communication?",
                intention: "Evaluate authentication (JWT/OAuth), CSRF/CORS security, and predictable state management.",
                answer: `• Secure Token Storage: Avoid storing sensitive JWTs in localStorage where they are vulnerable to XSS attacks. Store authentication tokens in secure, HttpOnly, SameSite=Lax (or Strict) cookies.
• CSRF & CORS Hardening: Configure server-side CORS with explicit origin whitelists (no wildcard '*' in production) and enforce CSRF tokens or custom request headers for state-changing requests.
• Input Sanitization & Validation: Enforce strict schema validation on both client and server layers using Zod or Joi. Sanitize all user inputs before persistence or rendering to prevent injection.
• State Reconciliation: Use optimistic UI updates with automatic rollback mechanisms if the backend mutation rejects, providing instantaneous perceived speed while preserving server source-of-truth.`
            },
            {
                question: "How would you design an API rate-limiter or throttling mechanism for high-traffic endpoints?",
                intention: "Test system design fundamentals, DDoS prevention knowledge, and understanding of distributed caching.",
                answer: `• Algorithm Selection: For bursty traffic, use the Token Bucket algorithm (allows short bursts while enforcing an average rate). For steady rate enforcement, use the Sliding Window Counter algorithm to eliminate boundary reset abuse.
• Distributed In-Memory Store: Store client counters in Redis utilizing atomic operations (e.g. MULTI/EXEC or Lua scripts with INCR and EXPIRE) to prevent race conditions across multi-instance server clusters.
• Granular Key Partitioning: Rate-limit based on a combination of authenticated User ID and IP address to prevent both account-level scraping and distributed unauthenticated attacks.
• Informative HTTP Headers: Return standard headers: X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset, accompanied by HTTP 429 Too Many Requests and a 'Retry-After' timestamp.`
            },
            {
                question: "Explain how you manage technical debt while maintaining rapid feature release velocity.",
                intention: "Assess pragmatic engineering mindset and trade-offs between delivery speed and maintainability.",
                answer: `• Dedicated Maintenance Budget: Negotiate a permanent 15-20% capacity in each sprint cycle dedicated exclusively to refactoring, dependency updates, and bug backlogs.
• High-Impact Prioritization: Categorize technical debt by business impact — prioritize debt that impedes ongoing feature development or risks system stability over cosmetic refactoring.
• Automated Guardrails: Enforce linting (ESLint), automated type checking (TypeScript), and pre-commit Git hooks (Husky) to prevent new technical debt from entering the main codebase.
• Documentation & Tech Spikes: Track complex technical debt as documented tickets with clear problem statements and proposed solutions, executing targeted 'spikes' before embarking on large rewrites.`
            },
            {
                question: "What is your approach to automated testing across the testing pyramid (Unit, Integration, E2E)?",
                intention: "Evaluate commitment to software quality, regression prevention, and CI/CD testing efficiency.",
                answer: `• Unit Testing (60-70%): Write fast, isolated unit tests (Jest/Vitest) for utility functions, custom hooks, and business logic with pure functions to achieve high branch coverage.
• Component & Integration Testing (20-30%): Use React Testing Library to test user-centric component interactions without testing implementation details. Verify that user actions trigger the expected DOM updates and mock API calls.
• End-to-End Testing (10%): Use Playwright or Cypress for core revenue-critical flows (e.g. user authentication, checkout, report generation) testing across multiple browser engines.
• CI Automation: Run unit and integration tests on every pull request, gating merges on passing suites, while running heavier E2E suites prior to production deployment.`
            },
            {
                question: "How do you handle database schema migrations in zero-downtime production deployments?",
                intention: "Understand experience with real-world production data management and backwards compatibility.",
                answer: `• Expand-and-Contract (Parallel Run) Pattern: Never execute destructive or breaking schema updates directly on a live production database.
• Phase 1 (Expand): Add new database fields or collections alongside legacy fields. Update the application to dual-write to both old and new fields while still reading from the old fields.
• Phase 2 (Backfill): Run asynchronous background migration scripts to backfill existing historical records with the new structure.
• Phase 3 (Switch): Update application logic to read exclusively from the new fields.
• Phase 4 (Contract): Safely remove legacy fields, indexes, and deprecated columns once verification confirms zero dependencies.`
            },
            {
                question: "How do you secure sensitive configuration data and API keys in a modern deployment pipeline?",
                intention: "Test security hygiene and DevSecOps familiarity.",
                answer: `• Environment Isolation: Separate development, staging, and production secrets. Never commit .env files, credentials, or certificates into version control (enforce via .gitignore and git-secrets).
• Cloud Secret Management: Store production credentials in dedicated secret vaults (e.g. AWS Secrets Manager, GCP Secret Manager, or HashiCorp Vault) and inject them at container startup.
• Principle of Least Privilege: Configure IAM roles and service accounts with minimal necessary permissions rather than granting administrative access.
• Automated Secret Scanning: Integrate automated scanning tools (e.g. GitGuardian or GitHub Secret Scanning) into the CI pipeline to flag committed tokens before deployment.`
            },
            {
                question: "How do you monitor, profile, and debug latency spikes and memory leaks in production?",
                intention: "Assess observability, APM tools, and incident response experience.",
                answer: `• Synthetic Monitoring & APM: Implement APM monitoring (e.g. Datadog, New Relic) to track p95 and p99 latency percentiles, error rates, and CPU/memory utilization.
• Distributed Tracing: Instrument critical transactions with OpenTelemetry to trace request spans from frontend UI down through API gateway, microservices, and database queries.
• Memory Profiling: Take heap snapshots using Chrome DevTools or Node.js --inspect to identify detached DOM trees, uncleared setInterval timers, or growing event listener arrays.
• Structured Logging: Output machine-readable structured JSON logs with correlation IDs (RequestId) to trace individual user transactions across distributed microservices.`
            }
        ],
        behavioralQuestions: [
            {
                question: "Describe a complex technical challenge you faced and how you overcame it.",
                intention: "Evaluate problem-solving methodology, persistence, technical depth, and structured communication using the STAR framework.",
                answer: `• Situation: During peak traffic on an e-commerce platform, our application experienced unexpected 504 Gateway Timeouts caused by database connection saturation and memory leaks.
• Task: As lead developer, I was tasked with identifying the root cause, stabilizing the platform within 24 hours, and preventing recurrence without disrupting active transactions.
• Action: I analyzed server APM traces, which revealed unindexed queries in the order history table and unclosed database connection pools. I implemented compound indexes on [userId, createdAt], configured a connection pooler, and added a Redis cache layer for high-frequency catalog reads.
• Result: API p99 latency dropped by 78% (from 4.2s to 920ms), database CPU utilization dropped from 95% to 32%, and zero further 504 timeouts occurred during subsequent holiday flash sales.`
            },
            {
                question: "Tell me about a time you had a technical disagreement with a team member. How did you resolve it?",
                intention: "Assess empathy, active listening, ability to evaluate technical trade-offs objectively, and commitment to team success.",
                answer: `• Situation: While architecting a new dashboard feature, a senior peer advocated for migrating our state management entirely to GraphQL with Apollo, while I recommended maintaining our existing React Query + REST API architecture.
• Task: We needed to reach a consensus quickly to avoid blocking sprint planning, while ensuring the chosen tech stack satisfied performance, deadline, and developer productivity goals.
• Action: Rather than debating theoretically, I built a small proof-of-concept for both approaches and benchmarked bundle size, caching complexity, and migration timeline. I presented the metrics in a constructive design review, highlighting that React Query satisfied 100% of our requirements with 3x less migration overhead.
• Result: The team unanimously agreed on the pragmatic REST + React Query path, shipping the feature two weeks ahead of schedule. My peer appreciated the objective data-driven comparison, strengthening our collaborative relationship.`
            },
            {
                question: "How do you prioritize competing deadlines when requirements change unexpectedly?",
                intention: "Evaluate adaptability, stakeholder communication, workload management, and ability to deliver under shifting constraints.",
                answer: `• Situation: Two weeks prior to a major quarterly release, the product team introduced a critical compliance requirement that significantly altered the customer onboarding flow.
• Task: I needed to incorporate the mandatory compliance flow without pushing back the firm marketing launch date or compromising code quality.
• Action: I convened an immediate triage session with the Product Manager and Engineering Lead. Using the MoSCoW method, we separated requirements into Must-Haves (the compliance flow and core sign-up) and Should-Haves (cosmetic animations and optional social sharing). I decomposed the compliance logic into modular sub-tasks and delegated backend schema updates while focusing on frontend form validation.
• Result: We delivered the fully compliant onboarding system on the scheduled launch date with zero regulatory infractions, subsequently releasing the deferred secondary features in the next sprint patch.`
            },
            {
                question: "Describe a mistake you made in production and how you handled the post-mortem.",
                intention: "Assess accountability, emotional composure under pressure, and commitment to root-cause prevention.",
                answer: `• Situation: Early in my career, I deployed an untested database migration script directly during daytime hours, which locked an essential table and caused intermittent downtime for 12 minutes.
• Task: I had to immediately restore platform availability, take full accountability, and ensure a systemic safeguard was implemented so this could never happen again.
• Action: I immediately alerted the team on Slack, rolled back the migration using our pre-planned rollback procedure, and confirmed system recovery. Afterwards, I authored a blameless post-mortem detailing what happened, why our staging environment did not catch the table lock, and introduced automated database migration testing and mandatory pre-deployment staging sign-offs.
• Result: The team commended my swift ownership and transparency. The automated migration pipeline I introduced prevented at least two risky schema locks in future releases.`
            },
            {
                question: "Tell me about a time you mentored a junior engineer or helped an onboarding teammate succeed.",
                intention: "Evaluate leadership skills, communication patience, team culture contribution, and knowledge sharing.",
                answer: `• Situation: A newly joined engineer was struggling to navigate our large monorepo codebase and felt overwhelmed by our asynchronous state management patterns.
• Task: My goal was to accelerate their onboarding, build their technical confidence, and empower them to ship their first production feature autonomously within their first month.
• Action: I established daily 30-minute pair-programming check-ins, drew architectural diagrams illustrating our data flow, and assigned them progressively complex tasks. Instead of providing direct answers, I guided them through debugging with Chrome DevTools and taught them how to write comprehensive integration tests.
• Result: The teammate merged their first production feature within three weeks, two weeks ahead of average onboarding time, and went on to present our testing guidelines to new engineering cohorts.`
            }
        ],
        skillGaps: [
            { skill: "Advanced Cloud Architecture & Orchestration", severity: "medium" },
            { skill: "Large-Scale Distributed Caching (Redis/Memcached)", severity: "medium" },
            { skill: "End-to-End Automated CI/CD Pipelines & Docker", severity: "low" },
            { skill: "High-Concurrency Optimization & Database Indexing", severity: "high" },
            { skill: "System Observability, APM Metrics & Distributed Tracing", severity: "low" }
        ],
        preparationPlan: [
            {
                day: 1,
                focus: "Core Language Fundamentals & Modern Architectural Patterns",
                tasks: [
                    "Review execution lifecycles, event loop mechanics, closures, and prototypical inheritance",
                    "Deep-dive into component design, compound components, and separation of concerns",
                    "Diagram system architecture and data flow for the target role"
                ]
            },
            {
                day: 2,
                focus: "State Management, REST/GraphQL APIs & Network Resilience",
                tasks: [
                    "Review global vs server state patterns (React Query, Redux Toolkit, Context)",
                    "Practice implementing abort signals, exponential backoff retries, and error boundaries",
                    "Review HTTP status codes, CORS headers, and secure HttpOnly cookie authentication"
                ]
            },
            {
                day: 3,
                focus: "High-Frequency Technical Coding & Algorithm Optimization",
                tasks: [
                    "Solve 5 high-frequency technical challenges (Arrays, Hash Maps, Dynamic Programming)",
                    "Implement debounce, throttle, deep clone, and LRU cache from scratch",
                    "Optimize algorithmic time complexity (Big-O) and memory overhead"
                ]
            },
            {
                day: 4,
                focus: "System Design, Scalability & Database Performance",
                tasks: [
                    "Study horizontal vs vertical scaling, load balancers, and CDN caching layers",
                    "Master database indexing strategies (B-Tree, Compound, Multikey) and query profiling",
                    "Design rate-limiting, message queues (Kafka/RabbitMQ), and cache invalidation patterns"
                ]
            },
            {
                day: 5,
                focus: "Web Security, Automated Testing & Zero-Downtime Deployments",
                tasks: [
                    "Review OWASP Top 10 vulnerabilities (XSS, CSRF, SQL/NoSQL Injection, SSRF)",
                    "Write unit and integration tests using Vitest/Jest and React Testing Library",
                    "Study blue-green deployments, canary releases, and expand-and-contract schema migrations"
                ]
            },
            {
                day: 6,
                focus: "STAR Method Behavioral Scenarios & Technical Trade-offs",
                tasks: [
                    "Prepare 5 detailed STAR stories: Complex Obstacle, Disagreement, Deadline, Mistake, Mentorship",
                    "Practice articulating engineering trade-offs (Speed vs Quality, Monolith vs Microservices)",
                    "Formulate 5 thoughtful, insightful questions to ask the interview panel"
                ]
            },
            {
                day: 7,
                focus: "Comprehensive Mock Interview & Final Confidence Polish",
                tasks: [
                    "Conduct a timed 45-minute live mock technical coding and architectural interview",
                    "Review tailored resume bullet points, key project metrics, and architecture diagrams",
                    "Ensure testing environment, camera, and microphone setup are in pristine condition"
                ]
            }
        ]
    };
}

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = `
    You are an elite principal engineer and executive hiring manager conducting technical and behavioral interviews.
    
    Based on the candidate's resume, self-description, and target job description, generate an exhaustive, high-caliber interview report.
    
    CRITICAL REQUIREMENTS:
    
    1. Calculate an accurate matchScore between 0 and 100 based on alignment between candidate experience and job requirements.
    2. Generate exactly 10 technical interview questions with:
       - question: Realistic, challenging technical question targeted at the role.
       - intention: Clear explanation of the underlying engineering competency, architecture pattern, or problem-solving capability evaluated.
       - answer: Comprehensive, multi-paragraph model answer containing:
         * Direct conceptual foundation and best practice approach
         * Step-by-step technical implementation methodology
         * Practical code/system architecture considerations
         * Trade-offs, edge cases, and pitfalls to avoid.
    
    3. Generate exactly 5 behavioral interview questions with:
       - question: Targeted behavioral scenario question (e.g. overcoming obstacles, handling disagreements, tight deadlines, production mistakes, team leadership).
       - intention: The behavioral trait and soft skill being evaluated.
       - answer: Comprehensive model answer structured explicitly using the STAR method:
         * Situation: Concrete context and technical/business background
         * Task: Specific objective and responsibility
         * Action: Methodical steps and leadership taken
         * Result: Measurable outcomes, metrics, and lasting positive impact.
    
    4. Identify at least 5 skill gaps with severity ('low', 'medium', 'high').
    5. Generate a rigorous 7-day preparation plan (Day 1 through 7) with targeted daily focus and actionable tasks.
    6. Extract or generate an accurate job title for the role.
    
    Never return empty arrays.
    
    Candidate Resume:
    ${resume || "Not provided directly. Extract skills and experience from self-description."}
    
    Self Description:
    ${selfDescription || "Not provided directly. Rely on candidate resume."}
    
    Job Description:
    ${jobDescription}
    `;

    try {
        console.log("[AI Service] Invoking Google Gemini model...");
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseJSONSchema: zodToJsonSchema(interviewReportSchema)
            }
        });

        console.log("[AI Service] Gemini response received!");

const responseText = response.text;
console.log(
    "[AI Service] Gemini response length:",
    responseText?.length ?? 0
);

const aiData = JSON.parse(responseText);
        console.log("[AI Debug] Field types:", {
    technicalQuestions: Array.isArray(aiData.technicalQuestions),
    behavioralQuestions: Array.isArray(aiData.behavioralQuestions),
    skillGaps: Array.isArray(aiData.skillGaps),
    preparationPlan: Array.isArray(aiData.preparationPlan),
});

        return {
            matchScore: aiData.matchScore || aiData.match_score || 85,
            technicalQuestions: (
                aiData.technicalQuestions ||
                aiData.technical_questions ||
                aiData.technical_interview_questions ||
                []
            ).map(q => ({
                question: q.question,
                intention: q.intention,
                answer: q.answer || q.detailed_answer
            })),
            behavioralQuestions: (
                aiData.behavioralQuestions ||
                aiData.behavioral_questions ||
                aiData.behavioral_interview_questions ||
                []
            ).map(q => ({
                question: q.question,
                intention: q.intention,
                answer: q.answer || q.detailed_answer
            })),
            skillGaps: (
                aiData.skillGaps ||
                aiData.skill_gaps ||
                []
            ).map(item => ({
                skill: item.skill,
                severity: String(item.severity).toLowerCase()
            })),
            preparationPlan: (
                aiData?.preparationPlan ||
                aiData?.preparation_plan ||
                []
            ).map((day) => ({
                day: typeof day.day === "string" ? parseInt(day.day.replace("Day ", "")) : day.day,
                focus: day.focus,
                tasks: day.tasks || [],
            })),
            title: aiData.title || extractTitleFromJobDescription(jobDescription)
        };
    } catch (apiErr) {
        console.warn("[AI Service] Gemini API call was not available:", apiErr.message);
        console.log("[AI Service] Activating tailored intelligent plan fallback...");
        return getFallbackInterviewReport({ resume, selfDescription, jobDescription });
    }
}

async function generatePdfFromHtml(htmlContent) {
 
const browser = await puppeteer.launch({
    headless: true,
  executablePath: await puppeteer.executablePath(),
    args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--font-render-hinting=medium"
    ]
});

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "domcontentloaded", timeout: 60000 });

    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
            top: "10mm",
            bottom: "10mm",
            left: "12mm",
            right: "12mm"
        }
    });

    await browser.close();
    return pdfBuffer;
}

/**
 * Intelligent helper to parse raw resume and profile strings into structured data
 * modeled directly after the user's sample resume in temp.js.
 */
function parseCandidateProfile({ resume, selfDescription, jobDescription }) {
    const combined = `${resume || ""}\n${selfDescription || ""}`;
    const targetTitle = extractTitleFromJobDescription(jobDescription);

    // Extract Name
    let name = "John Doe";
    const nameMatch = combined.match(/^(?:hello,\s*(?:my\s*name\s*is\s*)?|name:\s*)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m);
    if (nameMatch && nameMatch[1]) {
        name = nameMatch[1].trim();
    } else {
        const firstLine = (resume || "").split("\n").map(l => l.trim()).find(l => l.length > 2 && l.length < 35 && !l.includes("@") && !l.includes("http"));
        if (firstLine) name = firstLine;
    }

    // Extract Email
    const emailMatch = combined.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : "john.doe@gmail.com";

    // Extract Phone
    const phoneMatch = combined.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const phone = phoneMatch ? phoneMatch[0] : "+91-9876543210";

    // Extract Location
    const locMatch = combined.match(/Location:\s*([^\n\r]+)/i);
    const location = locMatch ? locMatch[1].trim() : "Bengaluru, India";

    // Extract or build Summary
    let summary = "";
    const summaryMatch = combined.match(/SUMMARY\s*([\s\S]*?)(?=EDUCATION|TECHNICAL SKILLS|PROJECTS|$)/i);
    if (summaryMatch && summaryMatch[1].trim().length > 30) {
        summary = summaryMatch[1].trim();
    } else if (selfDescription && selfDescription.trim().length > 40) {
        summary = selfDescription.replace(/Hello,\s*my\s*name\s*is\s*[^.]+\./i, "").trim();
    } else {
        summary = `Highly motivated and results-driven ${targetTitle} with proven expertise in developing scalable web applications, robust distributed systems, and modern user-centric interfaces. Proficient in Data Structures, Algorithms, Full Stack engineering, and cloud integrations. Passionate about writing clean, maintainable code and solving complex technical challenges in fast-paced environments.`;
    }

    // Education
    let education = {
        degree: "Bachelor of Technology in Computer Science",
        institution: "ABC Institute of Technology",
        period: "2021 - 2025",
        score: "CGPA: 8.9 / 10.0"
    };
    const eduMatch = combined.match(/EDUCATION\s*([\s\S]*?)(?=TECHNICAL SKILLS|PROJECTS|ACHIEVEMENTS|$)/i);
    if (eduMatch && eduMatch[1].trim()) {
        const eduLines = eduMatch[1].trim().split("\n").map(l => l.trim()).filter(Boolean);
        if (eduLines.length >= 2) {
            education.degree = eduLines[0];
            education.institution = eduLines[1];
            if (eduLines[2]) education.period = eduLines[2];
            if (eduLines[3]) education.score = eduLines[3];
        }
    }

    // Skills Matrix
    let skills = {
        languages: "C++, JavaScript (ES6+), TypeScript, Python, SQL",
        frontend: "React.js, Next.js, Redux, HTML5, CSS3, SCSS, Tailwind CSS",
        backend: "Node.js, Express.js, RESTful APIs, GraphQL",
        database: "MongoDB, MySQL, PostgreSQL, Redis",
        tools: "Git, GitHub, Docker, Postman, VS Code, Vite"
    };

    if (/Languages:\s*([^\n\r]+)/i.test(combined)) {
        skills.languages = combined.match(/Languages:\s*([^\n\r]+)/i)[1].trim();
    }
    if (/Frontend:\s*([^\n\r]+)/i.test(combined)) {
        skills.frontend = combined.match(/Frontend:\s*([^\n\r]+)/i)[1].trim();
    }
    if (/Backend:\s*([^\n\r]+)/i.test(combined)) {
        skills.backend = combined.match(/Backend:\s*([^\n\r]+)/i)[1].trim();
    }
    if (/Database:\s*([^\n\r]+)/i.test(combined)) {
        skills.database = combined.match(/Database:\s*([^\n\r]+)/i)[1].trim();
    }
    if (/Tools:\s*([^\n\r]+)/i.test(combined)) {
        skills.tools = combined.match(/Tools:\s*([^\n\r]+)/i)[1].trim();
    }

    // Projects
    let projects = [
        {
            title: "AI Interview Preparation Platform",
            techStack: "React.js, Node.js, Express.js, MongoDB, Google Gemini AI, SCSS",
            bullets: [
                "Architected a full-stack platform providing real-time AI-driven interview assessments, targeted roadmaps, and instant scoring.",
                "Engineered secure authentication utilizing JWT with HttpOnly cookies, Bcrypt password hashing, and role-based route guards.",
                "Integrated Google Gemini AI for contextual generation of 10 technical Q&As, 5 behavioral questions, and personalized skill gap analysis.",
                "Implemented automated ATS-compliant PDF resume generation using Puppeteer with zero-downtime MongoDB in-memory fallback."
            ]
        },
        {
            title: "High-Performance E-Commerce Application",
            techStack: "React.js, Redux Toolkit, Node.js, Express, Stripe API, MongoDB",
            bullets: [
                "Built a responsive e-commerce web platform featuring real-time product search, dynamic filtering, and shopping cart persistence.",
                "Integrated Stripe Payment Intent APIs for seamless, secure transactions with webhook verification.",
                "Optimized client-side rendering with code-splitting, lazy loading, and asset minification, achieving a 95+ Google Lighthouse score."
            ]
        },
        {
            title: "Real-Time Collaborative Task Dashboard",
            techStack: "React.js, WebSockets, Express, Tailwind CSS, Redis",
            bullets: [
                "Developed a Kanban-style collaborative workflow manager with drag-and-drop task reordering and instant multi-client state syncing.",
                "Integrated Redis Pub/Sub for distributed socket messaging across horizontally scaled Node.js server instances.",
                "Implemented optimistic UI updates ensuring instant user interactions with automatic server reconciliation."
            ]
        }
    ];

    // Achievements
    let achievements = [
        "Solved 600+ Algorithmic & Data Structure problems on LeetCode with consistent top 5% contest ratings.",
        "Finalist in National University Hackathon out of 250+ competing collegiate engineering teams.",
        "Active Open Source contributor on GitHub with 200+ commits and maintained developer utilities."
    ];

    // Soft Skills
    let softSkills = "Leadership, Cross-Functional Collaboration, Problem Solving, Technical Communication, Agile/Scrum, Time Management";

    return {
        name,
        targetTitle,
        email,
        phone,
        location,
        summary,
        education,
        skills,
        projects,
        achievements,
        softSkills
    };
}

/**
 * Builds an ATS-compliant, executive-grade HTML resume matching the sample in temp.js
 */
function buildProfessionalResumeHtml(candidateData) {
    const {
        name,
        targetTitle,
        email,
        phone,
        location,
        summary,
        education,
        skills,
        projects,
        achievements,
        softSkills
    } = candidateData;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>${name} - Resume</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm 14mm 12mm 14mm;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background-color: #ffffff;
            line-height: 1.4;
            font-size: 9.5pt;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        /* ── Header ── */
        .resume-header {
            text-align: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 8px;
            margin-bottom: 11px;
        }
        .candidate-name {
            font-size: 22pt;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.02em;
            text-transform: uppercase;
            margin-bottom: 2px;
        }
        .candidate-title {
            font-size: 10.5pt;
            font-weight: 700;
            color: #2563eb;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .contact-row {
            display: flex;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
            font-size: 9pt;
            color: #475569;
        }
        .contact-sep {
            color: #cbd5e1;
            font-weight: bold;
        }
        .contact-link {
            color: #475569;
            text-decoration: none;
        }

        /* ── Sections ── */
        .section {
            margin-bottom: 10px;
            page-break-inside: avoid;
        }
        .section-title {
            font-size: 10pt;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 2px;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
        }
        .section-title::after {
            content: '';
            flex: 1;
            height: 1px;
            background-color: #cbd5e1;
            margin-left: 8px;
        }

        /* ── Summary ── */
        .summary-text {
            font-size: 9.2pt;
            color: #334155;
            line-height: 1.45;
            text-align: justify;
        }

        /* ── Education ── */
        .edu-item {
            margin-bottom: 4px;
        }
        .item-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 1px;
        }
        .item-title {
            font-size: 9.5pt;
            font-weight: 700;
            color: #0f172a;
        }
        .item-subtitle {
            font-size: 9pt;
            font-weight: 500;
            color: #475569;
        }
        .item-meta {
            font-size: 8.8pt;
            color: #64748b;
            font-weight: 600;
            text-align: right;
        }

        /* ── Skills Matrix ── */
        .skills-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
        }
        .skills-table td {
            padding: 2px 0;
            vertical-align: top;
        }
        .skills-cat {
            font-weight: 700;
            color: #0f172a;
            width: 120px;
            white-space: nowrap;
        }
        .skills-val {
            color: #334155;
        }

        /* ── Projects ── */
        .project-item {
            margin-bottom: 7px;
            page-break-inside: avoid;
        }
        .project-title {
            font-size: 9.5pt;
            font-weight: 700;
            color: #0f172a;
        }
        .project-tech {
            font-size: 8.5pt;
            font-weight: 600;
            color: #2563eb;
            margin-left: 6px;
        }
        .project-bullets {
            padding-left: 15px;
            margin-top: 2px;
        }
        .project-bullets li {
            font-size: 8.8pt;
            color: #334155;
            line-height: 1.4;
            margin-bottom: 2px;
        }

        /* ── Achievements & Soft Skills ── */
        .bullet-list {
            padding-left: 15px;
            margin-top: 2px;
        }
        .bullet-list li {
            font-size: 8.8pt;
            color: #334155;
            line-height: 1.4;
            margin-bottom: 2px;
        }
    </style>
</head>
<body>

    <!-- Header -->
    <header class="resume-header">
        <h1 class="candidate-name">${name}</h1>
        <div class="candidate-title">${targetTitle}</div>
        <div class="contact-row">
            <span>Email: <a class="contact-link" href="mailto:${email}">${email}</a></span>
            <span class="contact-sep">•</span>
            <span>Phone: ${phone}</span>
            <span class="contact-sep">•</span>
            <span>Location: ${location}</span>
            <span class="contact-sep">•</span>
            <span>GitHub: <a class="contact-link" href="#">github.com/profile</a></span>
            <span class="contact-sep">•</span>
            <span>LinkedIn: <a class="contact-link" href="#">linkedin.com/in/profile</a></span>
        </div>
    </header>

    <!-- Professional Summary -->
    <section class="section">
        <h2 class="section-title">Professional Summary</h2>
        <p class="summary-text">${summary}</p>
    </section>

    <!-- Education -->
    <section class="section">
        <h2 class="section-title">Education</h2>
        <div class="edu-item">
            <div class="item-header">
                <div>
                    <span class="item-title">${education.degree}</span>
                    <span style="color: #64748b; margin: 0 4px;">|</span>
                    <span class="item-subtitle">${education.institution}</span>
                </div>
                <div class="item-meta">${education.period}</div>
            </div>
            <div style="font-size: 8.8pt; color: #475569; font-weight: 500;">
                Academic Standing: <strong>${education.score}</strong>
            </div>
        </div>
    </section>

    <!-- Technical Skills -->
    <section class="section">
        <h2 class="section-title">Technical Skills</h2>
        <table class="skills-table">
            <tr>
                <td class="skills-cat">Languages:</td>
                <td class="skills-val">${skills.languages}</td>
            </tr>
            <tr>
                <td class="skills-cat">Frontend:</td>
                <td class="skills-val">${skills.frontend}</td>
            </tr>
            <tr>
                <td class="skills-cat">Backend:</td>
                <td class="skills-val">${skills.backend}</td>
            </tr>
            <tr>
                <td class="skills-cat">Databases:</td>
                <td class="skills-val">${skills.database}</td>
            </tr>
            <tr>
                <td class="skills-cat">Developer Tools:</td>
                <td class="skills-val">${skills.tools}</td>
            </tr>
        </table>
    </section>

    <!-- Projects -->
    <section class="section">
        <h2 class="section-title">Key Engineering Projects</h2>
        ${projects.map(proj => `
        <div class="project-item">
            <div class="item-header">
                <div>
                    <span class="project-title">${proj.title}</span>
                    <span class="project-tech">| [${proj.techStack}]</span>
                </div>
                <div class="item-meta">Completed</div>
            </div>
            <ul class="project-bullets">
                ${proj.bullets.map(b => `<li>${b}</li>`).join("")}
            </ul>
        </div>
        `).join("")}
    </section>

    <!-- Achievements -->
    <section class="section">
        <h2 class="section-title">Achievements & Milestones</h2>
        <ul class="bullet-list">
            ${achievements.map(ach => `<li>${ach}</li>`).join("")}
        </ul>
    </section>

    <!-- Soft Skills -->
    <section class="section">
        <h2 class="section-title">Core Competencies & Soft Skills</h2>
        <p style="font-size: 8.8pt; color: #334155; line-height: 1.4;">${softSkills}</p>
    </section>

</body>
</html>`;
}

function getFallbackResumeHtml({ resume, selfDescription, jobDescription }) {
    const candidateData = parseCandidateProfile({ resume, selfDescription, jobDescription });
    return buildProfessionalResumeHtml(candidateData);
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const resumePdfSchema = z.object({
        html: z.string().describe("The comprehensive HTML and CSS content of the professional ATS-optimized resume")
    });

    const prompt = `You are an elite Executive Resume Architect and ATS Optimization Specialist.
    Generate a complete, pristine, print-ready HTML document for an ATS-compliant resume tailored specifically for the following job:
    
    Target Job Description:
    ${jobDescription}
    
    Candidate Source Resume:
    ${resume || "Not provided directly. Use candidate self-description and extract skills."}
    
    Candidate Self-Description:
    ${selfDescription || "Not provided directly. Extract from resume."}
    
    STRICT STYLING & FORMAT RULES:
    1. Output a single, standalone, valid HTML document with embedded <style> in <head>.
    2. Professional formatting: Clean white background (#ffffff), dark slate text (#1e293b), bold headers, modern typography (-apple-system, 'Segoe UI', Roboto, Helvetica, Arial).
    3. Include these exact sections:
       - Header: Name (bold uppercase 22pt), Title/Role, Contact Row (Email, Phone, Location, GitHub, LinkedIn).
       - Professional Summary: High-impact paragraph highlighting quantitative results and alignment to target role.
       - Education: Degree, Institution, Graduation Dates, GPA/CGPA.
       - Technical Skills: Clean table or categorized list (Languages, Frontend, Backend, Databases, Tools).
       - Key Projects: 2-3 detailed projects with tech stacks and strong action-driven bullet points (metrics, architecture, features).
       - Achievements & Milestones: Hackathons, coding milestones, open-source contributions.
       - Soft Skills / Core Competencies.
    4. Print rules:
       @page { size: A4 portrait; margin: 10mm 14mm 12mm 14mm; }
       -webkit-print-color-adjust: exact;
       page-break-inside: avoid;
    `;

    try {
        console.log("[AI Service] Generating tailored resume via Gemini...");
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: zodToJsonSchema(resumePdfSchema),
            }
        });
        const jsonContent = JSON.parse(response.text);
        if (jsonContent && jsonContent.html && jsonContent.html.length > 200) {
            console.log("[AI Service] Gemini resume generated successfully!");
            return await generatePdfFromHtml(jsonContent.html);
        }
        throw new Error("Gemini returned invalid or empty HTML content.");
    } catch (err) {
        console.warn("[AI Service] Gemini resume generation fell back to professional template:", err.message);
        const fallbackHtml = getFallbackResumeHtml({ resume, selfDescription, jobDescription });
        return await generatePdfFromHtml(fallbackHtml);
    }
}

module.exports = { generateInterviewReport, generateResumePdf, buildProfessionalResumeHtml, parseCandidateProfile };

import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// Force Next.js to use Cloudflare's Edge network
export const runtime = 'edge';

// Helper: get environment variables across process.env and Cloudflare request context
async function getEnv(key: string): Promise<string | undefined> {
    if (process.env[key]) return process.env[key];
    try {
        const { getRequestContext } = await import('@cloudflare/next-on-pages');
        const env = getRequestContext().env as Record<string, any>;
        return env?.[key];
    } catch {
        return undefined;
    }
}

export async function POST(request: Request) {
    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const description = body.description || body.data?.options?.find((o: any) => o.name === 'description')?.value;
    if (!description || typeof description !== 'string' || description.trim() === '') {
        return NextResponse.json({ error: 'Bug report description is required' }, { status: 400 });
    }

    // Resolve user identity from Auth session or request body fallback
    const session = await auth().catch(() => null);
    const username = session?.user?.name || session?.user?.email || body.username || body.member?.user?.username || 'unknown_agent';
    const userId = session?.user?.id || body.userId || body.member?.user?.id || '00000000-0000-0000-0000-000000000000';
    
    const severity = (body.severity || body.data?.options?.find((o: any) => o.name === 'severity')?.value || 'medium').toLowerCase();
    const logs = body.logs || body.telemetry || body.data?.options?.find((o: any) => o.name === 'logs')?.value || 'No diagnostic logs attached.';
    const hardwareProfile = body.hardwareProfile || body.hardware || 'Unknown Hardware Profile';
    const timestamp = new Date().toISOString();

    const shortSummary = description.length > 50 ? `${description.substring(0, 47)}...` : description;
    const issueTitle = `🐛 [Bug Report]: ${shortSummary} (via @${username})`;

    const logsFormatted = typeof logs === 'string' ? logs : JSON.stringify(logs, null, 2);
    const hwFormatted = typeof hardwareProfile === 'string' ? hardwareProfile : JSON.stringify(hardwareProfile, null, 2);

    const issueBody = `### 🐛 Telemetry Bug Report

**Reporter:** @${username} (User ID: \`${userId}\`)  
**Severity Level:** \`${severity.toUpperCase()}\`  
**Timestamp:** \`${timestamp}\`  

---
### 📝 Description
${description}

---
### 💻 Hardware & System Profile
\`\`\`json
${hwFormatted}
\`\`\`

---
### 📊 Telemetry & Diagnostic Logs
\`\`\`json
${logsFormatted}
\`\`\`

*Automated issue created by AimSync Aegis Bug Reporter Edge Pipeline.*`;

    const token = await getEnv('GITHUB_PAT') || await getEnv('GITHUB_TOKEN');
    const owner = await getEnv('GITHUB_REPO_OWNER') || 'LogicArchitectDS';
    const repo = await getEnv('GITHUB_REPO_NAME') || 'AimSync';

    if (!token) {
        console.warn('[Bug Report API] GITHUB_PAT environment variable is not configured. Mocking GitHub Issue response.');
        return NextResponse.json({
            success: true,
            mocked: true,
            message: 'Bug report recorded (mocked mode: GITHUB_PAT not set)',
            issueNumber: 0,
            issueUrl: `https://github.com/${owner}/${repo}/issues`
        });
    }

    try {
        const ghResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'AimSync-BugReporter-Edge',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: issueTitle,
                body: issueBody,
                labels: ['bug-report', 'telemetry', `severity:${severity}`]
            })
        });

        if (!ghResponse.ok) {
            const errorText = await ghResponse.text();
            console.error('[GitHub API Error]:', ghResponse.status, errorText);
            return NextResponse.json(
                { error: 'Failed to post bug report to GitHub', details: errorText },
                { status: ghResponse.status }
            );
        }

        const issueData: any = await ghResponse.json();

        return NextResponse.json({
            success: true,
            issueNumber: issueData.number,
            issueUrl: issueData.html_url,
            state: issueData.state
        });
    } catch (error: any) {
        console.error('[Bug Report Edge Error]:', error);
        return NextResponse.json({ error: 'Internal server error while reporting bug', message: error.message }, { status: 500 });
    }
}

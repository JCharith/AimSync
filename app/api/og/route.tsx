import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const username = searchParams.get('username') || searchParams.get('name') || 'Tactical Operative';
        const accuracy = searchParams.get('accuracy') || '94.2%';
        const rank = searchParams.get('rank') || 'GRANDMASTER';
        const score = searchParams.get('score') || '128,500';
        const mode = searchParams.get('mode') || 'Neural Performance Check';
        const stability = searchParams.get('stability') || '96%';

        const formattedAccuracy = accuracy.endsWith('%') ? accuracy : `${accuracy}%`;
        const formattedStability = stability.endsWith('%') ? stability : `${stability}%`;

        // Rank Badge Color Customization
        let rankBg = '#f59e0b';
        let rankText = '#000000';
        let rankBorder = 'rgba(245, 158, 11, 0.4)';

        const upperRank = rank.toUpperCase();
        if (upperRank.includes('GRANDMASTER') || upperRank.includes('APEX') || upperRank.includes('#1')) {
            rankBg = '#f59e0b';
            rankText = '#000000';
            rankBorder = 'rgba(245, 158, 11, 0.6)';
        } else if (upperRank.includes('MASTER')) {
            rankBg = '#c084fc';
            rankText = '#000000';
            rankBorder = 'rgba(192, 132, 252, 0.6)';
        } else if (upperRank.includes('DIAMOND')) {
            rankBg = '#22d3ee';
            rankText = '#000000';
            rankBorder = 'rgba(34, 211, 238, 0.6)';
        } else if (upperRank.includes('PLATINUM')) {
            rankBg = '#34d399';
            rankText = '#000000';
            rankBorder = 'rgba(52, 211, 153, 0.6)';
        }

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        backgroundColor: '#08090d',
                        color: '#ffffff',
                        fontFamily: 'sans-serif',
                        padding: '48px',
                        position: 'relative',
                        boxSizing: 'border-box',
                    }}
                >
                    {/* Background Neon Gradients */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '-100px',
                            right: '-100px',
                            width: '500px',
                            height: '500px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(0,240,255,0.15) 0%, rgba(0,0,0,0) 70%)',
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-100px',
                            left: '-100px',
                            width: '500px',
                            height: '500px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(0,0,0,0) 70%)',
                        }}
                    />

                    {/* TOP TACTICAL HEADER */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            paddingBottom: '20px',
                            zIndex: 10,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                                style={{
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    backgroundColor: '#00f0ff',
                                    boxShadow: '0 0 12px #00f0ff',
                                }}
                            />
                            <span
                                style={{
                                    fontSize: '22px',
                                    fontWeight: 900,
                                    letterSpacing: '0.25em',
                                    color: '#ffffff',
                                }}
                            >
                                AIM<span style={{ color: '#00f0ff' }}>SYNC</span>
                            </span>
                            <span
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    letterSpacing: '0.2em',
                                    color: 'rgba(255,255,255,0.4)',
                                    marginLeft: '8px',
                                }}
                            >
                                // TELEMETRY CARD
                            </span>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 16px',
                                borderRadius: '9999px',
                                backgroundColor: 'rgba(0, 240, 255, 0.08)',
                                border: '1px solid rgba(0, 240, 255, 0.25)',
                            }}
                        >
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34d399' }} />
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#00f0ff', letterSpacing: '0.15em' }}>
                                D1 VERIFIED RUN
                            </span>
                        </div>
                    </div>

                    {/* CENTER PLAYER PROFILE & STATS */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0', zIndex: 10 }}>
                        {/* LEFT COLUMN: OPERATIVE & RANK */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '480px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span
                                    style={{
                                        fontSize: '12px',
                                        fontWeight: 800,
                                        letterSpacing: '0.3em',
                                        color: '#8b5cf6',
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    EVALUATION DRILL: {mode}
                                </span>
                            </div>

                            <h1
                                style={{
                                    fontSize: '48px',
                                    fontWeight: 900,
                                    color: '#ffffff',
                                    margin: 0,
                                    lineHeight: 1.1,
                                    letterSpacing: '0.02em',
                                }}
                            >
                                {username}
                            </h1>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                <div
                                    style={{
                                        padding: '8px 20px',
                                        borderRadius: '12px',
                                        backgroundColor: rankBg,
                                        color: rankText,
                                        fontSize: '16px',
                                        fontWeight: 900,
                                        letterSpacing: '0.2em',
                                        boxShadow: `0 0 20px ${rankBorder}`,
                                    }}
                                >
                                    {upperRank}
                                </div>
                                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                                    Global Competitor
                                </span>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: 3 STAT TILES */}
                        <div style={{ display: 'flex', gap: '16px' }}>
                            {/* TILE 1: ACCURACY */}
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    padding: '24px',
                                    borderRadius: '24px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    width: '180px',
                                }}
                            >
                                <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em' }}>
                                    ACCURACY
                                </span>
                                <span style={{ fontSize: '38px', fontWeight: 900, color: '#34d399', letterSpacing: '-0.02em' }}>
                                    {formattedAccuracy}
                                </span>
                                <span style={{ fontSize: '11px', color: 'rgba(52, 211, 153, 0.8)', fontWeight: 700 }}>
                                    High Precision
                                </span>
                            </div>

                            {/* TILE 2: STABILITY */}
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    padding: '24px',
                                    borderRadius: '24px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    width: '180px',
                                }}
                            >
                                <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em' }}>
                                    NEURAL SCORE
                                </span>
                                <span style={{ fontSize: '38px', fontWeight: 900, color: '#c084fc', letterSpacing: '-0.02em' }}>
                                    {formattedStability}
                                </span>
                                <span style={{ fontSize: '11px', color: 'rgba(192, 132, 252, 0.8)', fontWeight: 700 }}>
                                    Low Degradation
                                </span>
                            </div>

                            {/* TILE 3: SCORE */}
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    padding: '24px',
                                    borderRadius: '24px',
                                    backgroundColor: 'rgba(0, 240, 255, 0.05)',
                                    border: '1px solid rgba(0, 240, 255, 0.2)',
                                    width: '200px',
                                }}
                            >
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#00f0ff', letterSpacing: '0.2em' }}>
                                    OVERALL SCORE
                                </span>
                                <span style={{ fontSize: '38px', fontWeight: 900, color: '#00f0ff', letterSpacing: '-0.02em' }}>
                                    {score}
                                </span>
                                <span style={{ fontSize: '11px', color: 'rgba(0, 240, 255, 0.8)', fontWeight: 700 }}>
                                    Global Rank Points
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* BOTTOM TACTICAL FOOTER */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            paddingTop: '20px',
                            zIndex: 10,
                        }}
                    >
                        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.1em' }}>
                            Aim Training &amp; Kinematic Telemetry Engine
                        </span>
                        <span style={{ fontSize: '14px', color: '#00f0ff', fontWeight: 800, letterSpacing: '0.2em' }}>
                            AIMSINC.DEV
                        </span>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
            }
        );
    } catch (e) {
        console.error('OG Image Generation Error:', e);
        return new Response('Failed to generate OpenGraph image', { status: 500 });
    }
}

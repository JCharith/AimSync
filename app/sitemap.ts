import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aimsync.pages.dev';
    const currentDate = new Date();

    const staticRoutes: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: currentDate,
            changeFrequency: 'daily',
            priority: 1.0,
        },
        {
            url: `${baseUrl}/dashboard`,
            lastModified: currentDate,
            changeFrequency: 'hourly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/leaderboard`,
            lastModified: currentDate,
            changeFrequency: 'always',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/game`,
            lastModified: currentDate,
            changeFrequency: 'daily',
            priority: 0.95,
        },
    ];

    // High-converting aim training & tactical gaming drill modes SEO canonical entry points
    const drillModes = [
        'static-flick',
        'tracking-mode',
        'consistency-check',
        'reaction-test',
        'target-switch',
        'micro-adjust',
        'echolocation',
        'recoil-evasion',
        'jiggle-peek',
        'flick-benchmark',
        'cognitive-overdrive',
        'burst-reaction'
    ];

    const drillRoutes: MetadataRoute.Sitemap = drillModes.map((mode) => ({
        url: `${baseUrl}/game?mode=${mode}`,
        lastModified: currentDate,
        changeFrequency: 'weekly',
        priority: 0.85,
    }));

    const infoRoutes: MetadataRoute.Sitemap = [
        {
            url: `${baseUrl}/privacy`,
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.3,
        },
        {
            url: `${baseUrl}/terms`,
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.3,
        },
    ];

    return [...staticRoutes, ...drillRoutes, ...infoRoutes];
}

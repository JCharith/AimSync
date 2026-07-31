import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aimsync.dev';

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/api/auth/',
                    '/auth/setup-username',
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}

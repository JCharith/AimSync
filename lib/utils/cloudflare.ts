/**
 * Utility functions for accessing Cloudflare context bindings (D1 Database & Environment Variables).
 * Standardized on the @opennextjs/cloudflare runtime adapter.
 */

export async function getCloudflareDb(): Promise<any> {
    try {
        const db = (process.env as any).DB;
        if (db) return db;
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const { env } = await getCloudflareContext<CloudflareEnv>();
        return env.DB;
    } catch {
        return null;
    }
}

export async function getCloudflareEnv(): Promise<Partial<CloudflareEnv>> {
    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const { env } = await getCloudflareContext<CloudflareEnv>();
        return env;
    } catch {
        return process.env as unknown as CloudflareEnv;
    }
}

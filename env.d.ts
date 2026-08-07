declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_APP_URL?: string;
      N8N_SCORE_FLAG_WEBHOOK_URL?: string;
      N8N_BUG_REPORT_WEBHOOK_URL?: string;
      N8N_SECURITY_WEBHOOK_URL?: string;
      DISCORD_ADMIN_WEBHOOK_URL?: string;
      COMMUNITY_BOSS_FIGHT_SECRET?: string;
    }
  }
  interface CloudflareEnv {
    DB: any;
    NEXT_PUBLIC_APP_URL?: string;
    N8N_SCORE_FLAG_WEBHOOK_URL?: string;
    N8N_BUG_REPORT_WEBHOOK_URL?: string;
    N8N_SECURITY_WEBHOOK_URL?: string;
    DISCORD_ADMIN_WEBHOOK_URL?: string;
  }
}
export {};

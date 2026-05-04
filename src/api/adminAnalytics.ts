import adminClient from './adminClient';

export type LandingVisitsTotals = {
  visits_today: number;
  visitors_today: number;
  visits_7d: number;
  visitors_7d: number;
  visits_30d: number;
  visitors_30d: number;
};

export type LandingVisitsDailyItem = {
  day: string;
  visits: number;
  visitors: number;
};

export type LandingVisitsPathItem = {
  landing_path: string;
  visits: number;
  visitors: number;
};

export type LandingVisitsSummary = {
  ok: boolean;
  range: {
    from: string;
    to: string;
    days: number;
  };
  totals: LandingVisitsTotals;
  daily: LandingVisitsDailyItem[];
  paths: LandingVisitsPathItem[];
};

export async function getLandingVisitsSummary(days = 30) {
  const { data } = await adminClient.get('/admin/analytics/landing-visits', {
    params: { days },
  });
  return data as LandingVisitsSummary;
}

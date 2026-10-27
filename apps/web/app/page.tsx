import { ExperienceEntryClient } from "../components/experience-entry-client";

interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const requestedQuery = Array.isArray(params?.query) ? params?.query[0] : params?.query;
  return <ExperienceEntryClient initialQuery={requestedQuery ?? ""} />;
}

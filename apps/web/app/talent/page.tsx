import TalentClient, { type TalentTab } from "./talent-client";

type TalentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function initialTalentTab(value: string | string[] | undefined): TalentTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "market") return "MARKET";
  if (raw === "offers") return "OFFERS";
  if (raw === "contracts") return "CONTRACTS";
  return "ROSTER";
}

export default async function TalentPage({ searchParams }: TalentPageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const tab = initialTalentTab(params.view);
  return <TalentClient key={tab} initialTab={tab} />;
}

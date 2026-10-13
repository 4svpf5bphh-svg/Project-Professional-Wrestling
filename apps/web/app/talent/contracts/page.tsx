import TalentClient from "../talent-client";

type ContractsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ContractsPage({ searchParams }: ContractsPageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const personId = Array.isArray(params.personId) ? params.personId[0] ?? "" : params.personId ?? "";
  return <TalentClient initialTab="CONTRACTS" focusPersonId={personId} />;
}

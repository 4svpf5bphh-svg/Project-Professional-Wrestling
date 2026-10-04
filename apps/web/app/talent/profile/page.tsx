import WrestlerProfileClient from "./wrestler-profile-client";

type WrestlerProfilePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WrestlerProfilePage({ searchParams }: WrestlerProfilePageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const rawPersonId = params.personId;
  const personId = Array.isArray(rawPersonId) ? rawPersonId[0] ?? "" : rawPersonId ?? "";
  return <WrestlerProfileClient personId={personId} />;
}

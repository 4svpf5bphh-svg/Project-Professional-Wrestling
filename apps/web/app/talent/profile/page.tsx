import WrestlerProfileClient, { type WrestlerProfileOrigin } from "./wrestler-profile-client";

type WrestlerProfilePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function profileOrigin(value: string | string[] | undefined): WrestlerProfileOrigin {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "industry" || raw === "directory" || raw === "talent" || raw === "contracts") return raw;
  return "directory";
}

export default async function WrestlerProfilePage({ searchParams }: WrestlerProfilePageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const rawPersonId = params.personId;
  const personId = Array.isArray(rawPersonId) ? rawPersonId[0] ?? "" : rawPersonId ?? "";
  return <WrestlerProfileClient personId={personId} origin={profileOrigin(params.from)} />;
}

import CardClient from "./card-client";
import ProgrammePanel from "./programme-panel";

export default function CardPage(): React.JSX.Element {
  return (
    <>
      <ProgrammePanel />
      <CardClient />
    </>
  );
}

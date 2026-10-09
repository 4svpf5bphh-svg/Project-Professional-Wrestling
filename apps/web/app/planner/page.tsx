import { Suspense } from "react";
import PlannerClient from "./planner-client";

export default function PlannerPage(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <PlannerClient />
    </Suspense>
  );
}

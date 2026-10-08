import AlphaHome from "./alpha-home";
import AlphaTestControls from "./alpha-test-controls";

export default function Page(): React.JSX.Element {
  const manualAdvanceEnabled = process.env.PPW_ENABLE_MANUAL_WEEK_ADVANCE === "1";

  return (
    <>
      <AlphaHome />
      {manualAdvanceEnabled ? <AlphaTestControls /> : null}
    </>
  );
}

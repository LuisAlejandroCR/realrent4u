// _layout.tsx: stack for the Changes tab (list -> scenario detail).
import { TabStack } from "../../../src/components/StackHeader";
import { usePrefs } from "../../../src/prefs";

// A detail opened from another tab (Home quick wins, scenario chips) keeps the list beneath it, so back works.
export const unstable_settings = { initialRouteName: "index" };

export default function ChangesStack() {
  const { ms } = usePrefs();
  return <TabStack backTitle={ms.back} root="/changes" />;
}

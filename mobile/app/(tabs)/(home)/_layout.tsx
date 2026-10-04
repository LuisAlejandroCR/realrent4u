// _layout.tsx: Home tab stack: home -> search -> address -> rule. Search has no tab of its own (it starts on Home).
import { TabStack } from "../../../src/components/StackHeader";
import { usePrefs } from "../../../src/prefs";

// A detail opened from another tab (scenario chips, Method) keeps Home beneath it, so back works.
export const unstable_settings = { initialRouteName: "index" };

export default function HomeStack() {
  const { ms } = usePrefs();
  return <TabStack backTitle={ms.back} root="/" />;
}

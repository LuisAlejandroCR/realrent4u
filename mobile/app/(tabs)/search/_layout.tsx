// _layout.tsx: stack for the Search tab (search -> address -> rule).
import { TabStack } from "../../../src/components/StackHeader";
import { usePrefs } from "../../../src/prefs";

export default function SearchStack() {
  const { ms } = usePrefs();
  return <TabStack backTitle={ms.back} root="/search" />;
}

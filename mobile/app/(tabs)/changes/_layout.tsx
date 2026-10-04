// _layout.tsx: stack for the Changes tab (list -> scenario detail).
import { TabStack } from "../../../src/components/StackHeader";
import { usePrefs } from "../../../src/prefs";

export default function ChangesStack() {
  const { ms } = usePrefs();
  return <TabStack backTitle={ms.back} root="/changes" />;
}

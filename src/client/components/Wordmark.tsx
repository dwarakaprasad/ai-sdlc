import { text } from "../text";
import { TutorMark } from "./TutorMark";

/** The app's name and mark, as on the profile picker and the top bar. */
export function Wordmark({ size = 36 }: { size?: number }) {
  return (
    <div className="wordmark">
      <TutorMark size={size} /> {text.appName}
    </div>
  );
}

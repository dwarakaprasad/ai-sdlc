import { api } from "../api";
import { text } from "../text";
import { Curricula } from "./Curricula";
import { Learners } from "./Learners";
import { LimitSettingsForm, LlmSettingsForm, TeachingSettingsForm } from "./Settings";
import { Usage } from "./Usage";

export function ParentArea({ onLogout }: { onLogout: () => void }) {
  return (
    <section>
      <h1>{text.parentArea.heading}</h1>
      <Learners />
      <Curricula />
      <LlmSettingsForm />
      <TeachingSettingsForm />
      <LimitSettingsForm />
      <Usage />
      <button type="button" onClick={() => api.logoutParent().then(onLogout)}>
        {text.parentArea.logout}
      </button>
    </section>
  );
}

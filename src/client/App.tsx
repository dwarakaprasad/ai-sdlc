import { useEffect, useState } from "react";
import type { LoggedInLearner, ParentStatus } from "../shared/api";
import { api } from "./api";
import { AvatarPick } from "./learner/AvatarPick";
import { LearnerHome } from "./learner/LearnerHome";
import { LearnerLogin } from "./learner/LearnerLogin";
import { LoginForm } from "./parent/LoginForm";
import { ParentArea } from "./parent/ParentArea";
import { SetupForm } from "./parent/SetupForm";
import { text } from "./text";

type AppState = { learner: LoggedInLearner } | { learner: undefined; parent: ParentStatus };

export function App() {
  const [state, setState] = useState<AppState>();
  const [parentLogin, setParentLogin] = useState(false);
  const [error, setError] = useState<string>();

  // A logged-in Learner can't reach any Parent endpoint, so ask who they are first.
  const refresh = async () => {
    try {
      const learner = await api.learnerMe();
      setState(learner ? { learner } : { learner: undefined, parent: await api.parentStatus() });
      setParentLogin(false);
    } catch {
      setError(text.genericError);
    }
  };
  useEffect(() => void refresh(), []);

  if (error) return <main className="page text-warm">{error}</main>;
  if (!state) return <main className="page muted">{text.loading}</main>;
  // A Learner picks their Avatar at their first login, before their first Today.
  if (state.learner?.avatar === null) return <AvatarPick learner={state.learner} onDone={(learner) => setState({ learner })} onSwitchProfile={refresh} />;
  if (state.learner) return <LearnerHome learner={state.learner} onLogout={refresh} />;
  if (!state.parent.passwordSet) return <SetupForm onDone={refresh} />;
  if (state.parent.loggedIn) return <ParentArea onLogout={refresh} />;
  if (parentLogin) return <LoginForm onDone={refresh} onBack={() => setParentLogin(false)} />;
  return <LearnerLogin onDone={refresh} onParent={() => setParentLogin(true)} />;
}

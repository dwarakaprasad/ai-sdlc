import { useEffect, useState } from "react";
import type { LoggedInLearner, ParentStatus } from "../shared/api";
import { api } from "./api";
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

  let content;
  if (error) content = <p className="error">{error}</p>;
  else if (!state) content = <p>{text.loading}</p>;
  else if (state.learner) content = <LearnerHome learner={state.learner} onLogout={refresh} />;
  else if (!state.parent.passwordSet) content = <SetupForm onDone={refresh} />;
  else if (state.parent.loggedIn) content = <ParentArea onLogout={refresh} />;
  else if (parentLogin) content = <LoginForm onDone={refresh} onBack={() => setParentLogin(false)} />;
  else content = <LearnerLogin onDone={refresh} onParent={() => setParentLogin(true)} />;

  return <main>{content}</main>;
}

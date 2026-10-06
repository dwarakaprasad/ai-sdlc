import { useState } from "react";
import { api } from "../api";
import { TopBar } from "../components/TopBar";
import { Button, Tag } from "../components/ui";
import { text } from "../text";
import { Curricula } from "./Curricula";
import { Learners } from "./Learners";
import { LimitSettingsForm, LlmSettingsForm, TeachingSettingsForm } from "./Settings";
import { Usage } from "./Usage";

type ParentScreen = keyof typeof text.parentArea.nav;

/** The logged-in Parent's area, in the Studio's denser variant: the Learners and their Goals, the Curricula, the settings and usage. */
export function ParentArea({ onLogout }: { onLogout: () => void }) {
  const [screen, setScreen] = useState<ParentScreen>("learners");
  const screens = Object.keys(text.parentArea.nav) as ParentScreen[];
  return (
    <div className="parent-app dense">
      <TopBar
        label={<Tag>{text.parentArea.heading}</Tag>}
        nav={screens.map((s) => ({ label: text.parentArea.nav[s], current: s === screen, onSelect: () => setScreen(s) }))}
        end={
          <Button kind="quiet" onClick={() => api.logoutParent().then(onLogout)}>
            {text.parentArea.logout}
          </Button>
        }
      />
      {screen === "learners" ? (
        <Learners />
      ) : (
        <main className="parent-page screen-enter" key={screen}>
          {screen === "curricula" && <Curricula />}
          {screen === "settings" && (
            <>
              <h1 className="h2">{text.parentArea.nav.settings}</h1>
              <div className="settings-grid">
                <LlmSettingsForm />
                <TeachingSettingsForm />
                <LimitSettingsForm />
              </div>
            </>
          )}
          {screen === "usage" && <Usage />}
        </main>
      )}
    </div>
  );
}

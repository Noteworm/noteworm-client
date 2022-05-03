import { Serializable, JsonProperty } from "typescript-json-serializer";

@Serializable()
export class UserPrefs {
    @JsonProperty()
    codeStyle = "atom-one-dark";

    @JsonProperty()
    accentColor = "#FF7A27";

    @JsonProperty()
    defaultMaximized = false;

    @JsonProperty()
    tabSize = 4;

    @JsonProperty()
    sidebarWidth = 275;

    @JsonProperty()
    sidebarTogglePos = 0; // 0: top, 1: bottom, 2: middle

    @JsonProperty()
    lastUseVersion = "0.0.0";

    @JsonProperty()
    showSideBar = true;
}
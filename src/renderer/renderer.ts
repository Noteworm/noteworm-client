import { MainAPI } from "../main/preload";
import * as feather from "feather-icons";
import validatorEscape from "validator/es/lib/escape";
import { Save } from "../common/Save";
import { NotebookItem } from "../common/NotebookItem";
import { UserPrefs } from "../common/UserPrefs";
import { deserialize } from "typescript-json-serializer";

import "./styles";

// JQuery $("") wrapper to output an error if it doesn't find an element
function query(text: string): JQuery<HTMLElement> {
	const result = $(text);

	if (result.length === 0) {
		console.error(`JQuery search for '${text}' did not find an element.`);
	}

	return result;
}

// #region Expose the variables/functions sent through the preload.ts

type BridgedWindow = Window &
	typeof globalThis & {
		mainAPI: any;
	};

export const api: MainAPI = (window as BridgedWindow).mainAPI.api;

// const defaultSaveLocation = api.defaultSaveLocation();

// These prevent ctrl or middle-clicking on <a>'s causing
// a new window to pop up
window.addEventListener("auxclick", (event) => {
	if (event.button === 1) {
		event.preventDefault();
	}
});
window.addEventListener("click", (event) => {
	if (event.ctrlKey) {
		event.preventDefault();
	}
});

let prefs: UserPrefs = deserialize<UserPrefs>(api.getPrefs(), UserPrefs);

let save: Save = deserialize<Save>(api.getSave(), Save);

let currentPage: NotebookItem;

console.log(prefs);
console.log(save);

// Feather icons
feather.replace();

if (api.showFirstUseModal) {
	setTimeout(() => {
		query("#firstUseModal").modal("show");
	}, 500);

	if (api.showWhatsNewModal) {
		query("#firstUseModal").on("hidden.bs.modal", () => {
			query("#whatsNewModal").modal("show");
		});
	}
} else {
	if (api.showWhatsNewModal) {
		query("#whatsNewModal").modal("show");
	}
}

export function toggleSidebar(forceState?: boolean): void {
	if (typeof forceState == "boolean") {
		if (forceState) {
			document.getElementById("sidebar").classList.add("hidden");
			query("#sidebar-toggle").html(feather.icons["arrow-right"].toSvg());
		} else {
			document.getElementById("sidebar").classList.remove("hidden");
			query("#sidebar-toggle").html(feather.icons["arrow-left"].toSvg());
		}
	}

	if (document.getElementById("sidebar").classList.contains("hidden")) {
		document.getElementById("sidebar").classList.remove("hidden");
		// document.getElementById("sidebar-toggle").dataset.feather = "arrow-left";
		query("#sidebar-toggle").html(feather.icons["arrow-left"].toSvg());
	} else {
		document.getElementById("sidebar").classList.add("hidden");
		query("#sidebar-toggle").html(feather.icons["arrow-right"].toSvg());
	}
}

export function errorPopup(message: string, detail: string) {
	api.ipcSend("errorPopup", message, detail);
}

// for builtin screens (home, about, editor, etc)
export function showScreen(screenName: string): void {
	document.querySelectorAll(".sidebar-link").forEach((elt) => elt.classList.remove("active"));

	document.querySelectorAll(`[data-links-to="${screenName}"]`).forEach((elt) => elt.classList.add("active"));

	query(".screen").hide();
	const screenElt = query(`#${screenName}.screen`);
	if (screenElt.length) screenElt.show();
	else {
		errorPopup(
			"Failed to find screen " + screenName,
			"hmtl elt with id #" +
				screenName +
				" and class .screen was not found by jquery selection and therefore could not be displayed"
		);
		showScreen("Home");
	}

	query("#content").scrollTop(0);
}

showScreen("Home");

export function showPage(pageID: string) {
	// TODO: save current page;

	try {
		currentPage = deserialize<NotebookItem>(api.loadPageData(`${pageID}.json`), NotebookItem);
	} catch (e) {
		return errorPopup(`Notes file ${pageID} could not be parsed`, e.toString());
	}

	// TODO: populate editor screen with data from page content
	query("#Editor").text(`Editor for ${validatorEscape(currentPage.skeleton.name)}`);
	console.log(currentPage);

	showScreen("Editor");
	document.querySelectorAll(".sidebar-link").forEach((elt) => elt.classList.remove("active"));
	document.querySelectorAll(`[data-links-to="${pageID}"]`).forEach((elt) => elt.classList.add("active"));
}

// #region IPC HANDLERS

api.ipcHandle("updateAvailable", (event: any, newVersion: string) => {
	setTimeout(() => {
		document.getElementById("updateBlockText").textContent = `Update available (${newVersion})`;
		query("#updateSidebarNotice").fadeIn();
	}, 1000);
});

api.ipcHandle("console.log", (event: any, text: string) => {
	console.log(text);
});

api.ipcHandle("console.error", (event: any, text: string) => {
	console.error(text);
});

api.ipcHandle("prefsShowMenuBar", (event: any, value: boolean) => {
	prefs.showMenuBar = value;
});

api.ipcHandle("newNotebook", () => {
	query("#newPageModal").modal("show");
});

api.ipcHandle("whatsNew", () => {
	query("#whatsNewModal").modal("show");
});

api.ipcHandle("onClose", () => {
	prefs.defaultMaximized = api.ipcSendSync("isWindowMaximized");
	api.savePrefs(prefs);
	// Save all
	api.saveData(save);
	api.ipcSend("exit");
});

// #endregion
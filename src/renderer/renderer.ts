import { MainAPI } from "../main/preload";
import validatorEscape from "validator/es/lib/escape"; // jquery text() func does this for you
import * as feather from "feather-icons";
import { v4 as GenerateUUID } from "uuid";
import { Save } from "../common/Save";
import {
	NotebookItem,
	NotebookItemSection,
	NotebookItemSectionType,
	NotebookItemSkeleton
} from "../common/NotebookItem";
import { UserPrefs } from "../common/UserPrefs";
// import { deserialize } from "typescript-json-serializer";

import "./styles";

// TODO: remove bootstrap requirement
// need to make a modal thingy bob https://www.w3schools.com/howto/howto_css_modals.asp

// JQuery $("") wrapper to output an error if it doesn't find an element
function query(text: string): JQuery<HTMLElement> {
	const result = $(text);
	if (!result.length) {
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

const defaultSaveLocation = api.defaultSaveLocation();

// TODO: re-enabled update checks
// api.ipcSend("checkForUpdates");

const prefs: UserPrefs = api.getPrefs();
const save: Save = api.getSave();

let currentPage: NotebookItem;

// load prefs

if (prefs.defaultMaximized) {
	api.ipcSend("maximize");
}

resizeSidebar(prefs.sidebarWidth);

// load custom user styles
(document.getElementById("customStylesheetLink") as HTMLLinkElement).href =
	"file:///" + defaultSaveLocation + "/userStyles.css";

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
			query("#sidebar-toggle").html(feather.icons["chevrons-right"].toSvg());
		} else {
			document.getElementById("sidebar").classList.remove("hidden");
			query("#sidebar-toggle").html(feather.icons["chevrons-left"].toSvg());
		}
	}

	if (document.getElementById("sidebar").classList.contains("hidden")) {
		document.getElementById("sidebar").classList.remove("hidden");
		query("#sidebar-toggle").html(feather.icons["chevrons-left"].toSvg());
	} else {
		document.getElementById("sidebar").classList.add("hidden");
		query("#sidebar-toggle").html(feather.icons["chevrons-right"].toSvg());
	}
}

export function resizeSidebar(width: number): void {
	if (width >= 200 && width <= 600) {
		prefs.sidebarWidth = width;

		if (document.documentElement.style.getPropertyValue("--sidebar-width") != "0px") {
			document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
		}
	}
}

function handleSidebarResizerDrag(event: MouseEvent): void {
	resizeSidebar(event.clientX);
}

const sidebarResizer = document.getElementById("sidebarResizer");
sidebarResizer.addEventListener("mousedown", () => {
	window.addEventListener("mousemove", handleSidebarResizerDrag, false);
	window.addEventListener(
		"mouseup",
		() => {
			window.removeEventListener("mousemove", handleSidebarResizerDrag, false);
		},
		false
	);
});

export function getSelection() : Selection {
	return window.getSelection();
}

export function getSelectionText() : string {
	return window.getSelection().toString();
}

export function setSelectionText(text : string) : void {
	const sel = window.getSelection();
	const range = sel.getRangeAt(0);
	range.deleteContents();
	range.insertNode(document.createTextNode(text));
}

export function setSelectionHtml(htmlString : string) : void {
	const sel = window.getSelection();
	const range = sel.getRangeAt(0);
	range.deleteContents();
	const frag = range.createContextualFragment(htmlString);
	range.insertNode(frag);
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

export function createNotification(title: string, body: string, timeout: number) {
	// TODO: timeout bar across bottom
	// TODO: pause timer on hover
	// TODO: instant close when cross clicked
	// TODO: Custom action when notification body/title pressed

	const id = GenerateUUID();
	const template = `
		<div class="notification-header">
			<div class="notification-title">${validatorEscape(title)}</div>
			<div class="notification-exit">&times;</div>
		</div>
		<div class="notification-body">
			${validatorEscape(body)}
		</div>`;
	const notification = $(`<div class="notification" id="${id}"></div>`);
	notification.html(template);
	notification.hide();
	query("#notificationContainer").append(notification);
	notification.fadeIn("fast");
	setTimeout(() => {
		notification.fadeOut(() => {
			notification.detach();
		});
	}, timeout * 1000);
}

export function refreshPageList() {
	query("#sidebar-page-items").empty();

	save.pages.children.forEach((pageSkeleton) => {
		const sidebarItem = $(
			`<li class="sidebar-item sidebar-link" onclick="renderer.showPage('${pageSkeleton.id}')" data-links-to="${pageSkeleton.id}"></li>`
		).text(pageSkeleton.name);
		query("#sidebar-page-items").append(sidebarItem);
		sidebarItem.on("contextmenu", (e) => {
			console.log(`Context menu on ${pageSkeleton.name}#${pageSkeleton.id}`);
			e.preventDefault();
			// TODO: open correct context menu
		});
		// This only does top level
		// TODO: Some recursive child looping thingy to list all the pages and each of their children and so on
	});
}

refreshPageList();

export function saveCurrentPage() {
	if (currentPage) {
		api.savePage(currentPage);
	}
}

export function showPage(pageID: string) {
	saveCurrentPage();

	try {
		currentPage = api.loadPageData(`${pageID}.json`);
	} catch (e) {
		return errorPopup(`Notes file ${pageID} could not be parsed`, e.toString());
	}

	query("#pageContent").empty();

	for (const section of currentPage.content) {
		// if(section.type == NotebookItemSectionType.TEXT) {
		// 	//
		// }
		const contentSrc = $(`<div id="${section.id} class="page-section type-${section.type}"></div>`);
		contentSrc.text(section.source);
		contentSrc.attr("contenteditable", "true");
		contentSrc.on("input", (e) => {
			console.log("contents edited");
			// console.log(e);
		});
		contentSrc.on("paste", (event) => {
			// TODO: custom pasting (paste raw text or new image etc)
			// use "clipboard" made available through API
		});

		query("#pageContent").append(contentSrc);
	}
	query("#pageTitle").text(`Editor for ${currentPage.skeleton.name}`); // TODO: change this to page path (parentOfParent > parentOfPage > pageName)
	// TODO: split pageTitle into two parts, path and title (path is less the prominent "parentOfParent > parentOfPage >" and title is slightly larger and is only the pageName)
	console.log(currentPage);

	showScreen("Editor");
	document.querySelectorAll(".sidebar-link").forEach((elt) => elt.classList.remove("active"));
	document.querySelectorAll(`[data-links-to="${pageID}"]`).forEach((elt) => elt.classList.add("active"));
	query("#pageContentContainer").scrollTop(0);
}

export function checkForUpdates() {
	if (query(".updateCheck").hasClass("disabled")) {
		return;
	}
	createNotification("Updates", "Checking for updates, please wait...", 10);
	query(".updateCheck").addClass("disabled");
	api.ipcSend("checkForUpdates");
	setTimeout(() => query(".updateCheck").removeClass("disabled"), 10 * 1000);
}

// #region IPC HANDLERS

api.ipcHandle("updateChecked", (event, version) => {
	setTimeout(() => {
		if (version) {
			query("#updateBlockText").text(`Update available (${version})`);
			query("#updateIconContainer").css({ color: "yellow" }).html(feather.icons["download"].toSvg());
			query("#updateSidebarNotice").fadeIn();
		} else {
			query("#updateBlockText").text("Up to Date");
			query("#updateIconContainer").css({ color: "#269700" }).html(feather.icons["check"].toSvg());
			query("#updateSidebarNotice").fadeIn();
			setTimeout(() => {
				query("#updateSidebarNotice").fadeOut();
			}, 10 * 1000);
		}
	}, 1000);
});

api.ipcHandle("console.log", (event: any, text: string) => {
	console.log(text);
});

api.ipcHandle("console.error", (event: any, text: string) => {
	console.error(text);
});

api.ipcHandle("prefsShowSideBar", (event: any, value: boolean) => {
	prefs.showSideBar = value;
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

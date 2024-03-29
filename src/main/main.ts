import {
	app,
	BrowserWindow,
	dialog,
	net,
	MessageBoxOptions,
	ipcMain,
	nativeTheme,
	Menu,
	MenuItem,
	shell
} from "electron";
import * as path from "path";
import validator from "validator";
import * as semver from "semver";
import * as remote from "@electron/remote/main";
import * as contextMenu from "electron-context-menu";

const currentVersion = "1.0.0"; // VERSION CHANGE NOTICE
let mainWindow: BrowserWindow = null;
const gotTheLock = app.requestSingleInstanceLock();
let iconPath = "";

//FORCE SINGLE INSTANCE
if (!gotTheLock) {
	app.quit();
} else {
	app.on("second-instance", () => {
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore();
			mainWindow.focus();
		}
	});

	app.on("ready", createWindow);

	app.on("window-all-closed", function () {
		// On OS X it is common for applications and their menu bar
		// to stay active until the user quits explicitly with Cmd + Q
		if (process.platform !== "darwin") {
			app.quit();
		}
	});

	app.on("activate", function () {
		// On OS X it"s common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
}

// Disable navigation
// https://www.electronjs.org/docs/latest/tutorial/security#13-disable-or-limit-navigation
app.on("web-contents-created", (event, contents) => {
	contents.on("will-navigate", (event) => {
		event.preventDefault();
	});
});

function createWindow() {
	let useFrame = true;

	if (process.platform === "win32") {
		useFrame = false;
		iconPath = "../../assets/icons/icon.ico";
	} else if (process.platform === "linux") {
		iconPath = "../../assets/icons/64x64.png";
	} else if (process.platform === "darwin") {
		iconPath = "../../assets/icons/icon.icns";
	}

	mainWindow = new BrowserWindow({
		width: 1280,
		height: 720,
		frame: useFrame,
		minWidth: 920,
		minHeight: 500,
		webPreferences: {
			preload: __dirname + "/preload.js"
		},
		icon: path.join(__dirname, iconPath),
		show: false,
		title: "Noteworm"
	});

	// Enable @electron/remote in preload so we can
	// use the custom titlebar
	remote.enable(mainWindow.webContents);
	remote.initialize();

	mainWindow.loadFile("html/index.html");

	contextMenu({
		showSearchWithGoogle: false,
		showLookUpSelection: false
	});

	Menu.setApplicationMenu(normalMenu);

	mainWindow.webContents.once("dom-ready", () => {
		mainWindow.show();
		// checkForUpdates(); // can also be forced in settings screen
	});

	mainWindow.on("close", (e) => {
		e.preventDefault();
		mainWindow.webContents.send("onClose");
	});

	// register keyboard shortcuts

	// electron.globalShortcut.register("CommandOrControl+R", function() {
	// 	console.log("Refreshed Page");
	// 	mainWindow.reload();
	// });

	// Open the DevTools.
	//mainWindow.webContents.openDevTools();
}

// TODO: look into auto-updating
// https://www.npmjs.com/package/electron-auto-Update
// https://www.electronjs.org/docs/latest/api/auto-updater
function checkForUpdates(): void {
	// This makes sure we get a non-cached verison of the "latestversion.txt" file for the update check
	app.commandLine.appendSwitch("disable-http-cache");

	try {
		const request = net.request("https://Noteworm.github.io/internal/latestversion.txt");
		request.on("response", (response) => {
			response.on("data", (chunk) => {
				const onlineVersion = validator.escape(chunk.toString());
				if (semver.valid(onlineVersion)) {
					mainWindow.webContents.send(
						"console.log",
						`Checking for updates\nCurrent version: ${currentVersion}\nLatest version: ${onlineVersion}`
					);
					// Check if online version # is greater than current version
					if (semver.compare(currentVersion, onlineVersion) == -1) {
						mainWindow.webContents.send("updateChecked", onlineVersion);
					} else {
						mainWindow.webContents.send("updateChecked");
					}
				} else {
					errorPopup("Failed to check for updates", "Response body was not a valid version number.");
				}
			});
			response.on("aborted", () => {
				errorPopup("Net request aborted while trying to check for updates", "");
			});
			response.on("error", (error: Error) => {
				errorPopup("Failed to check for updates", error.toString());
			});
		});

		request.on("redirect", () => {
			request.abort();
		});

		request.end();

		request.on("error", (err) => {
			errorPopup("Failed to check for updates", err.toString());
		});
	} catch (err) {
		errorPopup("Failed to check for updates", err.toString());
	} finally {
		app.commandLine.removeSwitch("disable-http-cache");
	}
}

function errorPopup(mes: string, det: string) {
	const options: MessageBoxOptions = {
		type: "error",
		buttons: ["Ok"],
		defaultId: 0,
		cancelId: 0,
		detail: det,
		title: "Error",
		message: mes
	};
	dialog.showMessageBox(mainWindow, options);

	mainWindow.webContents.send("console.error", `${mes}\n${det}`);
}

function executeJavascriptInRenderer(js: string): void {
	mainWindow.webContents.executeJavaScript(js + ";0").catch((reason) => {
		errorPopup("Error executing javascript in renderer process", reason.toString());
	});
}

function openAboutWindow(): void {
	const about = new BrowserWindow({
		width: 680,
		height: 450,
		resizable: false,
		webPreferences: {
			preload: __dirname + "/about_preload.js"
		},
		icon: path.join(__dirname, iconPath),
		title: "About Noteworm",
		parent: mainWindow,
		modal: process.platform === "darwin" ? false : true,
		show: false
	});
	about.webContents.once("dom-ready", () => {
		about.show();
	});
	about.setMenu(null);
	about.loadFile("html/about.html");
}

const normalMenu = new Menu();
normalMenu.append(
	new MenuItem({
		label: "File",
		submenu: [
			{
				label: "New Notebook",
				accelerator: "CmdOrCtrl+N",
				click: () => mainWindow.webContents.send("newNotebook")
			},
			{
				type: "separator"
			},
			{
				label: "Exit",
				click: () => app.exit()
			}
		]
	})
);

normalMenu.append(
	new MenuItem({
		label: "View",
		submenu: [
			{
				label: "Toggle Sidebar",
				accelerator: "CmdOrCtrl+D",
				click: () => executeJavascriptInRenderer("renderer.toggleSidebar(null)")
			},
			{
				label: "Reset Sidebar Width",
				click: () => executeJavascriptInRenderer("renderer.resizeSidebar(275)")
			},
			{
				type: "separator"
			},
			{
				label: "Refresh Page",
				accelerator: "CmdOrCtrl+R",
				click: () => mainWindow.reload()
			},
			{
				label: "Toggle Developer Tools",
				accelerator: "CmdOrCtrl+Shift+I",
				click: () => mainWindow.webContents.toggleDevTools()
			}
		]
	})
);

normalMenu.append(
	new MenuItem({
		label: "Help",
		submenu: [
			{
				label: "Help",
				accelerator: "F1",
				click: () => shell.openExternal("https://Noteworm.github.io/docs/")
			},
			{
				label: "Website",
				click: () => shell.openExternal("https://Noteworm.github.io/")
			},
			{
				label: "What's New",
				click: () => mainWindow.webContents.send("whatsNew")
			},
			{
				label: "All Changelogs",
				click: () => shell.openExternal("https://Noteworm.github.io/updates/")
			},
			{
				label: "Give Feedback (Google Forms)",
				click: () => shell.openExternal("https://forms.gle/spa9b6EPwBfVs46YA")
			},
			{
				type: "separator"
			},
			{
				label: "About",
				click: () => openAboutWindow()
			}
		]
	})
);

const editingMenu = new Menu();
editingMenu.append(
	new MenuItem({
		label: "File",
		submenu: [
			{
				label: "New Notebook",
				accelerator: "CmdOrCtrl+N",
				click: () => executeJavascriptInRenderer("$('#newNotebookModal').modal('show')")
			},
			{
				label: "Save Page",
				accelerator: "CmdOrCtrl+S",
				click: () => executeJavascriptInRenderer("renderer.saveOpenedPage(true)")
			},
			{
				type: "separator"
			},
			{
				label: "Export page to PDF...",
				accelerator: "CmdOrCtrl+P",
				click: () => executeJavascriptInRenderer("renderer.printCurrentPage()")
			},
			{
				label: "Export page to Markdown...",
				click: () => executeJavascriptInRenderer("renderer.exportCurrentPageToMarkdown()")
			},
			{
				type: "separator"
			},
			{
				label: "Exit",
				click: () => app.exit()
			}
		]
	})
);

editingMenu.append(
	new MenuItem({
		label: "Edit",
		submenu: [
			{
				label: "Cut",
				accelerator: "CmdOrCtrl+X"
				////click: () => document.execCommand("cut")
			},
			{
				label: "Copy",
				accelerator: "CmdOrCtrl+C"
				////click: () => document.execCommand("copy")
			},
			{
				label: "Paste",
				accelerator: "CmdOrCtrl+V"
				////click: () => document.execCommand("paste")
			}
		]
	})
);

editingMenu.append(
	new MenuItem({
		label: "View",
		submenu: [
			{
				label: "Zoom In",
				accelerator: "CmdOrCtrl+=",
				click: () => executeJavascriptInRenderer("renderer.zoomIn()")
			},
			{
				label: "Zoom Out",
				accelerator: "CmdOrCtrl+-",
				click: () => executeJavascriptInRenderer("renderer.zoomOut()")
			},
			{
				label: "Restore Default Zoom",
				accelerator: "CmdOrCtrl+R",
				click: () => executeJavascriptInRenderer("renderer.defaultZoom()")
			},
			{
				type: "separator"
			},
			{
				label: "Toggle Sidebar",
				accelerator: "CmdOrCtrl+D",
				click: () => executeJavascriptInRenderer("renderer.toggleSidebar(null)")
			},
			{
				label: "Reset Sidebar Width",
				click: () => executeJavascriptInRenderer("renderer.resizeSidebar(275)")
			},
			{
				label: "Toggle Editor Toolbar",
				accelerator: "CmdOrCtrl+T",
				click: () => executeJavascriptInRenderer("renderer.toggleEditorRibbon()")
			},
			{
				type: "separator"
			},
			{
				label: "Toggle Developer Tools",
				accelerator: "CmdOrCtrl+Shift+I",
				click: () => mainWindow.webContents.toggleDevTools()
			}
		]
	})
);

editingMenu.append(
	new MenuItem({
		label: "Help",
		submenu: [
			{
				label: "Help",
				accelerator: "F1",
				click: () => shell.openExternal("https://Noteworm.github.io/docs/")
			},
			{
				label: "Website",
				click: () => shell.openExternal("https://Noteworm.github.io/")
			},
			{
				label: "What's New",
				click: () => mainWindow.webContents.send("whatsNew")
			},
			{
				label: "All Changelogs",
				click: () => shell.openExternal("https://Noteworm.github.io/updates/")
			},
			{
				label: "Give Feedback (Google Forms)",
				click: () => shell.openExternal("https://forms.gle/spa9b6EPwBfVs46YA")
			},
			{
				type: "separator"
			},
			{
				label: "About",
				click: () => openAboutWindow()
			}
		]
	})
);

// Add the "Toggle Menu Bar" option for linux users
if (process.platform === "linux") {
	normalMenu.items[1].submenu.append(
		new MenuItem({
			label: "Toggle Side Bar",
			click: () => {
				const current = mainWindow.isMenuBarVisible();
				mainWindow.setMenuBarVisibility(!current);
				mainWindow.webContents.send("prefsShowSideBar", !current);
			},
			accelerator: "Ctrl+M"
		})
	);
	editingMenu.items[2].submenu.append(
		new MenuItem({
			label: "Toggle Side Bar",
			click: () => {
				const current = mainWindow.isMenuBarVisible();
				mainWindow.setMenuBarVisibility(!current);
				mainWindow.webContents.send("prefsShowSideBar", !current);
			},
			accelerator: "Ctrl+M"
		})
	);
}

/*
    IPC Events
*/

ipcMain.on("errorPopup", (event, args: string[]) => {
	errorPopup(args[0], args[1]);
});

ipcMain.on("setNativeThemeSource", (event, value: string) => {
	if (value == "system") nativeTheme.themeSource = "system";
	else if (value == "light") nativeTheme.themeSource = "light";
	else if (value == "dark") nativeTheme.themeSource = "dark";
});

ipcMain.on("maximize", () => {
	mainWindow.maximize();
});

ipcMain.on("setMenuBarVisibility", (event, value: boolean) => {
	mainWindow.setMenuBarVisibility(value);
});

ipcMain.on("restart", () => {
	app.relaunch();
	mainWindow.webContents.send("onClose");
});

ipcMain.on("exit", () => {
	app.exit();
});

ipcMain.on("normalMenu", () => {
	Menu.setApplicationMenu(normalMenu);
	mainWindow.webContents.send("updateMenubar");
});

ipcMain.on("editingMenu", () => {
	Menu.setApplicationMenu(editingMenu);
	mainWindow.webContents.send("updateMenubar");
});

ipcMain.on("defaultDataDir", (event) => {
	event.returnValue = app.getPath("userData");
});

ipcMain.on("isWindowMaximized", (event) => {
	event.returnValue = mainWindow.isMaximized();
});

ipcMain.on("nativeThemeShouldUseDarkColors", (event) => {
	event.returnValue = nativeTheme.shouldUseDarkColors;
});

ipcMain.on("openAboutWindow", () => {
	openAboutWindow();
});

ipcMain.on("checkForUpdates", () => {
	checkForUpdates();
});

ipcMain.on("errorLoadingData", (e, text: string) => {
	mainWindow.destroy();

	const options: MessageBoxOptions = {
		type: "error",
		buttons: ["Ok"],
		defaultId: 0,
		cancelId: 0,
		detail: text.toString(),
		title: "Error",
		message: "Error while loading prefs/save data"
	};
	dialog.showMessageBoxSync(mainWindow, options);

	app.exit();
});

ipcMain.on("changeSaveLocation", (e) => {
	const filepaths = dialog.showOpenDialogSync(mainWindow, {
		properties: ["openDirectory"]
	});

	if (filepaths !== undefined) {
		e.returnValue = filepaths[0];
	} else {
		e.returnValue = "";
	}
});

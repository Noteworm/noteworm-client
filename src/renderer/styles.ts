import "../../css/style.scss";
import "../../css/codeoverlay.scss";

import * as feather from "feather-icons";

// Feather icons
feather.replace();

// hide context menu when a context menu is not clicked
$(document).on("click", function (event) {
	if (!$(event.target).closest(".context-menu").length) {
		$(".context-menu").hide();
	}
});

type ScrollPos = { top: number; left: number };
interface scrollListenerCallback {
	(lastKnownScrollPosition: ScrollPos): void;
}

// Custom Scroll listener that ensures the function isn't called loads of times
function listenToScroll(element: HTMLElement, action: scrollListenerCallback) {
	const lastKnownScrollPosition: ScrollPos = { top: 0, left: 0 };
	let ticking = false;

	element.addEventListener("scroll", function () {
		lastKnownScrollPosition.top = element.scrollTop;
		lastKnownScrollPosition.left = element.scrollLeft;

		if (!ticking) {
			window.requestAnimationFrame(function () {
				action(lastKnownScrollPosition);
				ticking = false;
			});

			ticking = true;
		}
	});
}

// Change editor title when scrolled
listenToScroll(document.getElementById("pageContentContainer"), (pos) => {
	if (pos.top > 0) {
		document.getElementById("pageTitle").classList.add("scrolled");
	} else {
		document.getElementById("pageTitle").classList.remove("scrolled");
	}
});

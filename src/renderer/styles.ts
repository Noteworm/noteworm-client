import "../../css/style.scss";
import "../../css/codeoverlay.scss";

import * as feather from "feather-icons";

// Feather icons
feather.replace();

// Toggle stuck class for position sticky elements when intersecting
// !! Will NOT work when a change in position or size occurs when style is applied or removed !!
const elts = document.querySelectorAll(".sticky");
elts.forEach((el) => {
	console.log(el.getAttribute("style"));
	el.setAttribute("style", "top:-1px; position:sticky;");
	const observer = new IntersectionObserver(([e]) => e.target.classList.toggle("is-stuck", e.intersectionRatio < 1), {
		threshold: [1]
	});
	observer.observe(el);
});

type ScrollPos = {top: number, left: number}
interface scrollListenerCallback {
	(lastKnownScrollPosition: ScrollPos): void;
}

function listenToScroll(element: HTMLElement, action: scrollListenerCallback) {
	const lastKnownScrollPosition : ScrollPos = {top: 0, left: 0};
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

// Editor actions
listenToScroll(document.getElementById("pageContentContainer"), (pos) => {
    console.log(pos)
    if(pos.top > 0) {
        document.getElementById("pageTitle").classList.add("scrolled");
    } else {
        document.getElementById("pageTitle").classList.remove("scrolled");
    }
});

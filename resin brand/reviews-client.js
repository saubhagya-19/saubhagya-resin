/* =========================================================
   SAUBHAGYA RESIN STUDIO
   CUSTOMER REVIEWS CLIENT  (works with reviews.js on server)
   ========================================================= */

(function () {
    "use strict";

    const API = "/api/reviews";
    const TOKEN_KEY = "sr_review_tokens";   // browser remembers which reviews this customer wrote

    let selectedRating = 5;
    let updateStarsFn = null;

    const $ = (id) => document.getElementById(id);

    /* -----------------------------------------------------
       OWNER TOKENS (so a customer can delete ONLY own review)
       ----------------------------------------------------- */

    function getTokens() {
        try {
            return JSON.parse(localStorage.getItem(TOKEN_KEY) || "{}") || {};
        } catch (e) {
            return {};
        }
    }

    function saveToken(id, token) {
        try {
            const t = getTokens();
            t[id] = token;
            localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
        } catch (e) {}
    }

    function removeToken(id) {
        try {
            const t = getTokens();
            delete t[id];
            localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
        } catch (e) {}
    }

    /* -----------------------------------------------------
       OPEN / CLOSE REVIEW PANEL
       ----------------------------------------------------- */

    function openReviews() {
        const panel = $("revPanel");
        if (panel) {
            panel.classList.add("open");
            loadReviews();
        }
    }

    function closeReviews() {
        const panel = $("revPanel");
        if (panel) {
            panel.classList.remove("open");
        }
    }

    window.srOpenReviews = openReviews;

    /* -----------------------------------------------------
       STAR SELECTION
       ----------------------------------------------------- */

    function setupStars() {
        const starPick = $("starPick");
        if (!starPick) return;

        const stars = starPick.querySelectorAll("span");

        function updateStars(value) {
            selectedRating = value;

            stars.forEach(function (star) {
                const number = Number(star.dataset.v);

                if (number <= value) {
                    star.classList.add("active");
                    star.style.color = "#d4af37";
                } else {
                    star.classList.remove("active");
                    star.style.color = "#ccc";
                }
            });
        }

        updateStarsFn = updateStars;

        stars.forEach(function (star) {
            star.addEventListener("click", function () {
                updateStars(Number(star.dataset.v));
            });

            star.addEventListener("mouseenter", function () {
                const value = Number(star.dataset.v);

                stars.forEach(function (s) {
                    const n = Number(s.dataset.v);
                    s.style.color = n <= value ? "#d4af37" : "#ccc";
                });
            });
        });

        starPick.addEventListener("mouseleave", function () {
            updateStars(selectedRating);
        });

        updateStars(5);
    }

    /* -----------------------------------------------------
       FILE NAME DISPLAY
       ----------------------------------------------------- */

    function setupFileNames() {
        const imageInput = $("revImage");
        const videoInput = $("revVideo");

        if (imageInput) {
            imageInput.addEventListener("change", function () {
                const name = $("revImageName");
                if (name) {
                    name.textContent = imageInput.files.length
                        ? imageInput.files[0].name
                        : "No photo chosen";
                }
            });
        }

        if (videoInput) {
            videoInput.addEventListener("change", function () {
                const name = $("revVideoName");
                if (name) {
                    name.textContent = videoInput.files.length
                        ? videoInput.files[0].name
                        : "No video chosen";
                }
            });
        }
    }

    /* -----------------------------------------------------
       HELPERS
       ----------------------------------------------------- */

    function starsHTML(rating) {
        rating = Number(rating) || 0;
        let html = "";
        for (let i = 1; i <= 5; i++) {
            html += i <= rating ? "★" : "☆";
        }
        return html;
    }

    function escapeHTML(value) {
        return String(value === undefined || value === null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(value) {
        if (!value) return "";
        // SQLite gives "YYYY-MM-DD HH:MM:SS" in UTC
        const date = new Date(String(value).replace(" ", "T") + "Z");
        if (isNaN(date.getTime())) return "";
        return date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    /* Server sends short keys: n, r, t, i, v. Old long names also supported. */
    function normalize(review) {
        return {
            id: review.id,
            name: review.n || review.name || "Customer",
            rating: review.r || review.rating || 5,
            text: review.t || review.text || "",
            image: review.i || review.image || "",
            video: review.v || review.video || "",
            date: review.created_at || ""
        };
    }

    function mediaHTML(review) {
        let html = "";

        if (review.image) {
            html += `
                <div class="review-media">
                    <img
                        src="${escapeHTML(review.image)}"
                        alt="Customer review photo"
                        loading="lazy"
                        onerror="this.style.display='none'"
                    >
                </div>
            `;
        }

        if (review.video) {
            html += `
                <div class="review-media">
                    <video controls playsinline preload="metadata">
                        <source src="${escapeHTML(review.video)}">
                        Your browser does not support video.
                    </video>
                </div>
            `;
        }

        return html;
    }

    /* -----------------------------------------------------
       LOAD REVIEWS
       ----------------------------------------------------- */

    async function loadReviews() {
        try {
            const response = await fetch(API, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });

            if (!response.ok) {
                throw new Error("Could not load reviews.");
            }

            const data = await response.json();
            const raw = Array.isArray(data) ? data : data.reviews || [];
            const reviews = raw.map(normalize);

            renderReviews(reviews);
            renderPreview(reviews);

        } catch (error) {
            console.error("Reviews loading error:", error);

            const list = $("reviewList");
            if (list) {
                list.innerHTML =
                    '<p style="padding:15px;text-align:center;">Unable to load reviews right now.</p>';
            }
        }
    }

    /* -----------------------------------------------------
       DELETE REVIEW (only own review: needs owner token)
       ----------------------------------------------------- */

    async function deleteReview(id) {
        if (!id) return;

        const token = getTokens()[id];
        if (!token) {
            alert("You can only delete your own review.");
            return;
        }

        if (!confirm("Are you sure you want to delete your review?")) return;

        try {
            const response = await fetch(API + "/" + encodeURIComponent(id), {
                method: "DELETE",
                headers: {
                    "Accept": "application/json",
                    "x-owner-token": token
                }
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                if (response.status === 404) removeToken(id);
                throw new Error(data.message || data.error || "Could not delete review.");
            }

            removeToken(id);
            alert("Review deleted successfully.");
            loadReviews();

        } catch (error) {
            console.error("Delete review error:", error);
            alert(error.message || "Unable to delete review.");
        }
    }

    /* -----------------------------------------------------
       RENDER ALL REVIEWS
       ----------------------------------------------------- */

    function renderReviews(reviews) {
        const list = $("reviewList");
        if (!list) return;

        if (!reviews.length) {
            list.innerHTML = `
                <div style="padding:20px;text-align:center;">
                    <h4>No reviews yet</h4>
                    <p>Be the first customer to share your experience! ❤️</p>
                </div>
            `;
            return;
        }

        const tokens = getTokens();

        list.innerHTML = reviews.map(function (review) {
            const mine = !!tokens[review.id];

            return `
                <article class="customer-review-card" data-review-id="${escapeHTML(review.id)}">

                    <div class="customer-review-top">
                        <div>
                            <strong>${escapeHTML(review.name)}</strong>
                            <div class="customer-review-stars">${starsHTML(review.rating)}</div>
                        </div>
                        ${review.date ? `<small>${escapeHTML(formatDate(review.date))}</small>` : ""}
                    </div>

                    ${review.text ? `<p class="customer-review-text">${escapeHTML(review.text)}</p>` : ""}

                    ${mediaHTML(review)}

                    ${mine ? `
                        <button
                            type="button"
                            class="review-delete-btn"
                            data-delete-review="${escapeHTML(review.id)}"
                        >
                            Delete my review
                        </button>
                    ` : ""}

                </article>
            `;
        }).join("");

        list.querySelectorAll("[data-delete-review]").forEach(function (button) {
            button.addEventListener("click", function () {
                deleteReview(button.dataset.deleteReview);
            });
        });
    }

    /* -----------------------------------------------------
       HOME PAGE REVIEW PREVIEW
       ----------------------------------------------------- */

    function renderPreview(reviews) {
        const preview = $("reviewPreview");
        if (!preview) return;

        const latest = reviews.slice(0, 4);

        if (!latest.length) {
            preview.innerHTML = `
                <div style="text-align:center;padding:20px;">
                    <p>No customer reviews yet.</p>
                </div>
            `;
            return;
        }

        preview.innerHTML = latest.map(function (review) {
            return `
                <div class="rv-card">
                    <div class="rv-stars">${starsHTML(review.rating)}</div>
                    <h4>${escapeHTML(review.name)}</h4>
                    <p>${escapeHTML(review.text)}</p>
                </div>
            `;
        }).join("");
    }

    /* -----------------------------------------------------
       SUBMIT REVIEW
       ----------------------------------------------------- */

    async function submitReview() {
        const nameInput = $("revName");
        const textInput = $("revText");
        const imageInput = $("revImage");
        const videoInput = $("revVideo");
        const submitButton = $("revSubmit");

        if (!nameInput || !textInput || !submitButton) return;

        const name = nameInput.value.trim();
        const text = textInput.value.trim();

        if (!name) {
            alert("Please enter your name.");
            nameInput.focus();
            return;
        }

        if (!text) {
            alert("Please write your review.");
            textInput.focus();
            return;
        }

        if (!selectedRating) {
            alert("Please select a rating.");
            return;
        }

        const image = imageInput && imageInput.files.length ? imageInput.files[0] : null;
        const video = videoInput && videoInput.files.length ? videoInput.files[0] : null;

        if (image && image.size > 10 * 1024 * 1024) {
            alert("Photo must be smaller than 10 MB.");
            return;
        }

        if (video && video.size > 50 * 1024 * 1024) {
            alert("Video must be smaller than 50 MB.");
            return;
        }

        const formData = new FormData();
        formData.append("name", name);
        formData.append("text", text);
        formData.append("rating", selectedRating);
        if (image) formData.append("image", image);
        if (video) formData.append("video", video);

        const oldText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";

        try {
            const response = await fetch(API, {
                method: "POST",
                body: formData
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || data.error || "Could not submit review.");
            }

            /* Remember ownership so this customer can delete this review later */
            if (data.review && data.review.id && data.ownerToken) {
                saveToken(data.review.id, data.ownerToken);
            }

            alert("Thank you! Your review has been submitted. ❤️");

            nameInput.value = "";
            textInput.value = "";
            if (imageInput) imageInput.value = "";
            if (videoInput) videoInput.value = "";
            if ($("revImageName")) $("revImageName").textContent = "No photo chosen";
            if ($("revVideoName")) $("revVideoName").textContent = "No video chosen";

            if (updateStarsFn) updateStarsFn(5);

            await loadReviews();

        } catch (error) {
            console.error("Submit review error:", error);
            alert(error.message || "Unable to submit your review.");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = oldText;
        }
    }

    /* -----------------------------------------------------
       EVENT LISTENERS
       ----------------------------------------------------- */

    function setupEvents() {
        const tab = $("revTab");
        const close = $("revClose");
        const openButton = $("revOpenBtn");
        const submitButton = $("revSubmit");

        if (tab) tab.addEventListener("click", openReviews);
        if (close) close.addEventListener("click", closeReviews);
        if (openButton) openButton.addEventListener("click", openReviews);
        if (submitButton) submitButton.addEventListener("click", submitReview);

        /* Close when clicking outside panel */
        document.addEventListener("click", function (event) {
            const panel = $("revPanel");
            if (!panel || !panel.classList.contains("open")) return;

            const clickedInside = panel.contains(event.target);
            const clickedTab = tab && tab.contains(event.target);
            const clickedOpen = openButton && openButton.contains(event.target);

            /* ignore clicks on elements removed from page (e.g. after delete) */
            if (!document.body.contains(event.target)) return;

            if (!clickedInside && !clickedTab && !clickedOpen) {
                closeReviews();
            }
        });

        /* ESC closes panel */
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") closeReviews();
        });
    }

    /* -----------------------------------------------------
       INITIALIZE
       ----------------------------------------------------- */

    function initReviews() {
        setupEvents();
        setupStars();
        setupFileNames();
        loadReviews();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initReviews);
    } else {
        initReviews();
    }

})();
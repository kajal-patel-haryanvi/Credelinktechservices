const form = document.querySelector(".contact-form");
const note = document.querySelector(".form-note");
const submitButton = form?.querySelector('button[type="submit"]');
const couponGrid = document.querySelector("#coupon-grid");
const couponSearch = document.querySelector("#coupon-search");
const couponFilters = document.querySelector("#coupon-filters");
const couponResults = document.querySelector("#coupon-results");
const revealTargets = document.querySelectorAll(
  ".hero-copy, .hero-panel, .stats, .app-section, .brands, .how-it-works, .contact, .page-hero, .policy-layout"
);

revealTargets.forEach((element) => element.classList.add("reveal"));

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.18 }
);

revealTargets.forEach((element) => observer.observe(element));

function setFormMessage(message, isError = false) {
  if (!note) {
    return;
  }

  note.textContent = message;
  note.classList.toggle("form-note-error", isError);
  note.classList.toggle("form-note-success", !isError && message.length > 0);
}

function validateFormPayload(payload) {
  const companyName = payload.companyName.trim();
  const email = payload.email.trim();
  const brief = payload.brief.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (companyName.length < 2 || companyName.length > 120) {
    return "Company name must be between 2 and 120 characters.";
  }

  if (!emailPattern.test(email) || email.length > 254) {
    return "Enter a valid email address.";
  }

  if (brief.length < 20 || brief.length > 2000) {
    return "Campaign details must be between 20 and 2000 characters.";
  }

  return "";
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const payload = {
    companyName: (formData.get("companyName") || "").toString(),
    email: (formData.get("email") || "").toString(),
    brief: (formData.get("brief") || "").toString(),
  };
  const validationMessage = validateFormPayload(payload);

  if (validationMessage) {
    setFormMessage(validationMessage, true);
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
  }

  setFormMessage("");

  try {
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        typeof result.error === "string"
          ? result.error
          : "We could not submit your inquiry. Please try again.";
      setFormMessage(errorMessage, true);
      return;
    }

    setFormMessage(
      `Thanks, ${payload.companyName.trim()}. Your partnership inquiry was sent successfully.`
    );
    form.reset();
  } catch (error) {
    setFormMessage(
      "The server could not be reached. Start the backend locally and try again.",
      true
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Send inquiry";
    }
  }
});

const couponData = [
  {
    brand: "Zomato",
    category: "Food Delivery",
    title: "Flat 40% Off on orders",
    description: "Best for food delivery promotions, repeat customers, and weekend ordering.",
    code: "FOOD40",
    status: "Ends Sunday",
  },
  {
    brand: "Amazon",
    category: "Shopping",
    title: "Up to 25% Off on essentials",
    description: "Useful for household, electronics, and everyday shopping campaigns.",
    code: "AMAZON25",
    status: "Limited stock",
  },
  {
    brand: "Goibibo",
    category: "Travel",
    title: "Rs 1200 Off on hotel bookings",
    description: "Travel-focused offers designed for app-first booking flows and seasonal demand.",
    code: "TRIP1200",
    status: "Weekend special",
  },
  {
    brand: "Zepto",
    category: "Quick Commerce",
    title: "Free delivery plus basket savings",
    description: "High-frequency quick-commerce offers that work well for daily essentials.",
    code: "ZSAVE",
    status: "Today only",
  },
  {
    brand: "Blinkit",
    category: "Quick Commerce",
    title: "Rs 150 Off on first 3 orders",
    description: "Convenience-led discounts for rapid delivery campaigns in major cities.",
    code: "BLINK150",
    status: "New users",
  },
  {
    brand: "Agoda",
    category: "Travel",
    title: "Up to 18% Off on stays",
    description: "Ideal for hotel deals, city breaks, and international destination promos.",
    code: "STAY18",
    status: "App bookings",
  },
  {
    brand: "Myntra",
    category: "Fashion",
    title: "Extra 20% Off on fashion",
    description: "Style-led offers on apparel, footwear, and accessories from top brands.",
    code: "STYLE20",
    status: "Today only",
  },
  {
    brand: "Flipkart",
    category: "Shopping",
    title: "Up to Rs 800 Off on electronics",
    description: "Special promo deals for gadgets, appliances, and seasonal sale events.",
    code: "FKSAVE800",
    status: "Limited offer",
  },
  {
    brand: "Swiggy",
    category: "Food Delivery",
    title: "Free delivery plus meal discounts",
    description: "Combo savings for food ordering campaigns and repeat purchase promotions.",
    code: "MEALFREE",
    status: "Selected cities",
  },
  {
    brand: "MakeMyTrip",
    category: "Travel",
    title: "Flat 15% Off on flight bookings",
    description: "Travel conversion offers built for domestic and holiday booking demand.",
    code: "FLY15",
    status: "Weekend bookings",
  },
  {
    brand: "BigBasket",
    category: "Groceries",
    title: "Rs 250 Off on grocery carts",
    description: "Value-focused grocery savings designed for frequent household ordering.",
    code: "GROCERY250",
    status: "First orders",
  },
  {
    brand: "Ajio",
    category: "Fashion",
    title: "Buy 2 Get 1 on fashion picks",
    description: "Promotional fashion offers built for catalog discovery and seasonal pushes.",
    code: "AJIOB2G1",
    status: "Festival sale",
  },
  {
    brand: "Nykaa",
    category: "Beauty",
    title: "Up to 30% Off on beauty favourites",
    description: "High-conversion offers across skincare, makeup, and wellness launches.",
    code: "GLOW30",
    status: "Weekend glow sale",
  },
  {
    brand: "Uber",
    category: "Mobility",
    title: "Flat Rs 100 Off on rides",
    description: "Useful for commuter campaigns, airport travel, and first-trip activation.",
    code: "RIDE100",
    status: "Metro cities",
  },
  {
    brand: "Domino's",
    category: "Food Delivery",
    title: "Buy 1 Get 1 on pizza combos",
    description: "Family meal deals and app-driven ordering campaigns for peak dining hours.",
    code: "PIZZA1PLUS1",
    status: "Tonight only",
  },
  {
    brand: "Cleartrip",
    category: "Travel",
    title: "Extra 12% Off on domestic flights",
    description: "Ideal for flash-sale flight pushes and app-first booking incentives.",
    code: "CLEAR12",
    status: "48-hour sale",
  },
  {
    brand: "Pepperfry",
    category: "Home",
    title: "Up to 35% Off on furniture",
    description: "Home improvement savings for living room, storage, and decor categories.",
    code: "HOME35",
    status: "New collection",
  },
  {
    brand: "PharmEasy",
    category: "Healthcare",
    title: "Rs 400 Off on medicine orders",
    description: "Discount campaigns for wellness essentials, subscriptions, and repeat orders.",
    code: "CARE400",
    status: "Prescription orders",
  },
  {
    brand: "JioMart",
    category: "Groceries",
    title: "Free delivery on grocery baskets",
    description: "Basket-building offers for pantry staples and monthly household shopping.",
    code: "SMARTCART",
    status: "Min order applies",
  },
  {
    brand: "Tata CLiQ",
    category: "Shopping",
    title: "Extra 15% Off premium labels",
    description: "Fashion and lifestyle promotions for premium shoppers and festive launches.",
    code: "CLIQ15",
    status: "Premium edit",
  },
];

function createCouponCard(coupon) {
  return `
    <article class="offer-card detailed-offer">
      <span class="offer-type">${coupon.brand}</span>
      <p class="offer-category">${coupon.category}</p>
      <h3>${coupon.title}</h3>
      <p>${coupon.description}</p>
      <div class="coupon-footer">
        <code>${coupon.code}</code>
        <span>${coupon.status}</span>
      </div>
    </article>
  `;
}

function renderCouponFilters(categories, activeCategory) {
  if (!couponFilters) {
    return;
  }

  couponFilters.innerHTML = categories
    .map(
      (category) => `
        <button
          class="filter-chip${category === activeCategory ? " is-active" : ""}"
          type="button"
          data-category="${category}"
        >
          ${category}
        </button>
      `
    )
    .join("");
}

function renderCoupons() {
  if (!couponGrid) {
    return;
  }

  const searchValue = couponSearch?.value.trim().toLowerCase() || "";
  const activeFilter =
    couponFilters?.querySelector(".filter-chip.is-active")?.dataset.category || "All";
  const filteredCoupons = couponData.filter((coupon) => {
    const matchesFilter = activeFilter === "All" || coupon.category === activeFilter;
    const searchableText = `${coupon.brand} ${coupon.category} ${coupon.title} ${coupon.description}`.toLowerCase();
    const matchesSearch = searchableText.includes(searchValue);
    return matchesFilter && matchesSearch;
  });

  couponGrid.innerHTML = filteredCoupons.map(createCouponCard).join("");

  if (couponResults) {
    couponResults.textContent = `${filteredCoupons.length} offers available`;
  }
}

function initializeCouponsPage() {
  if (!couponGrid || !couponFilters || !couponSearch) {
    return;
  }

  const categories = ["All", ...new Set(couponData.map((coupon) => coupon.category))];
  renderCouponFilters(categories, "All");
  renderCoupons();

  couponSearch.addEventListener("input", renderCoupons);
  couponFilters.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLButtonElement) || !target.dataset.category) {
      return;
    }

    couponFilters
      .querySelectorAll(".filter-chip")
      .forEach((chip) => chip.classList.remove("is-active"));
    target.classList.add("is-active");
    renderCoupons();
  });
}

initializeCouponsPage();

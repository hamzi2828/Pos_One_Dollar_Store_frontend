// Modern Concise Website JavaScript - All Sections
// ES6+ with modern patterns and utilities

class WebsiteManager {
  constructor() {
    this.carousels = new Map();
    this.init();
  }

  init() {
    document.addEventListener("DOMContentLoaded", () => {
      this.initMobileMenu();
      this.initNavigation();
      this.initHeroCarousel();
      this.initCarousels();
      this.initUtilityButtons();
      this.initSection6Carousel(); // Initialize section 6 carousel
    });
  }

  // Mobile Menu
  initMobileMenu() {
    const toggle = document.getElementById("mobile-menu-toggle");
    const menu = document.getElementById("mobile-menu");
    if (!toggle || !menu) return;

    toggle.addEventListener("click", () => {
      const isOpen = menu.classList.toggle("active");
      const icon = toggle.querySelector("i");

      if (icon) {
        icon.className = isOpen ? "fas fa-times" : "fas fa-bars";
      }
      toggle.setAttribute("aria-expanded", isOpen);
    });
  }

  // Navigation
  initNavigation() {
    // Active link handling
    document.querySelectorAll(".nav-link, .mobile-nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        document
          .querySelectorAll(".nav-link, .mobile-nav-link")
          .forEach((l) => l.classList.remove("active"));
        e.target.classList.add("active");

        // Close mobile menu if open
        const mobileMenu = document.getElementById("mobile-menu");
        if (mobileMenu?.classList.contains("active")) {
          mobileMenu.classList.remove("active");
          const toggle = document.getElementById("mobile-menu-toggle");
          const icon = toggle?.querySelector("i");
          if (icon) icon.className = "fas fa-bars";
          toggle?.setAttribute("aria-expanded", "false");
        }
      });
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelector(anchor.getAttribute("href"))?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
  }

  // Hero Carousel
  initHeroCarousel() {
    const slides = document.querySelectorAll(".hero-slide");
    const indicators = document.querySelectorAll(".hero-indicator");
    const prevBtn = document.querySelector(".hero-prev-btn");
    const nextBtn = document.querySelector(".hero-next-btn");

    if (!slides.length) return;

    let currentSlide = 0;

    const showSlide = (index) => {
      slides.forEach((slide) => slide.classList.remove("active"));
      indicators.forEach((indicator) => indicator.classList.remove("active"));

      slides[index]?.classList.add("active");
      indicators[index]?.classList.add("active");
      currentSlide = index;
    };

    const nextSlide = () => showSlide((currentSlide + 1) % slides.length);
    const prevSlide = () =>
      showSlide((currentSlide - 1 + slides.length) % slides.length);

    prevBtn?.addEventListener("click", prevSlide);
    nextBtn?.addEventListener("click", nextSlide);

    indicators.forEach((indicator, index) => {
      indicator.addEventListener("click", () => showSlide(index));
    });

    // Auto-play
    setInterval(nextSlide, 5000);

    // CTA buttons
    document.querySelectorAll(".hero-cta-button").forEach((button) => {
      button.addEventListener("click", (e) => {
        const buttonText =
          e.target.closest(".hero-cta-button").querySelector(".hero-cta-text")
            ?.textContent || "Hero CTA";
        console.log(`${buttonText} clicked`);
      });
    });
  }

  // Universal Carousel Class
  initCarousels() {
    const carouselConfigs = [
      {
        id: "section2",
        container: "section2-cardsContainer",
        prev: "section2-prevBtn",
        next: "section2-nextBtn",
      },
      {
        id: "section4",
        container: "section4-cardsContainer",
        prev: "section4-prevBtn",
        next: "section4-nextBtn",
      },
      {
        id: "section5",
        container: "carousel",
        prev: ".section5-nav-btn:first-of-type",
        next: ".section5-nav-btn:last-of-type",
      },
    ];

    carouselConfigs.forEach((config) => {
      const carousel = new UniversalCarousel(config);
      if (carousel.isValid) {
        this.carousels.set(config.id, carousel);
      }
    });

    // Section-specific functionality
    this.initSection2Events();
    this.initSection4Events();
    this.initSection5Events();
  }

  initSection2Events() {
    document.querySelectorAll(".section2-card-link").forEach((card) => {
      card.addEventListener("click", (e) => {
        const category = e.currentTarget.href.split("#")[1] || "unknown";
        console.log(`Section2 Category clicked: ${category}`);
      });
    });
  }

  initSection4Events() {
    // Wishlist buttons
    document.querySelectorAll(".section4-wishlist-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const icon = btn.querySelector("i");
        const isWishlisted = icon.classList.toggle("fas");
        icon.classList.toggle("far");
        icon.style.color = isWishlisted ? "#ef4444" : "#6b7280";

        console.log(
          isWishlisted ? "Added to wishlist" : "Removed from wishlist"
        );
      });
    });

    // Add to cart buttons
    document.querySelectorAll(".section4-add-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const productName = btn
          .closest(".section4-product-card")
          .querySelector("h3").textContent;
        console.log(`Added to cart: ${productName}`);

        // Visual feedback
        btn.style.transform = "scale(1.2)";
        setTimeout(() => (btn.style.transform = ""), 200);
      });
    });
  }

  initSection5Events() {
    document.querySelectorAll(".section5-plus-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();

        const className = btn
          .closest("article")
          .querySelector(".section5-class-name").textContent;
        console.log(`${className} class info requested`);

        // Visual feedback
        btn.style.transform = "scale(1.2)";
        setTimeout(() => (btn.style.transform = ""), 200);
      });
    });
  }

  // Section 6 Carousel - Dedicated Implementation
  initSection6Carousel() {
    const carousel = document.getElementById("carousel6");
    const dots = document.querySelectorAll(".section6-dot");

    if (!carousel || !dots.length) return;

    let currentSlide = 0;

    // Scroll carousel function for section 6
    const scrollCarousel6 = (direction) => {
      const cardWidth = carousel.children[0].offsetWidth + 16; // card width + gap
      carousel.scrollLeft += direction * cardWidth;
      updateDots();
    };

    // Scroll to specific slide
    const scrollToSlide = (index) => {
      const cardWidth = carousel.children[0].offsetWidth + 16;
      carousel.scrollLeft = index * cardWidth;
      currentSlide = index;
      updateDots();
    };

    // Update dots based on current position
    const updateDots = () => {
      const scrollLeft = carousel.scrollLeft;
      const cardWidth = carousel.children[0].offsetWidth + 16;
      currentSlide = Math.round(scrollLeft / cardWidth);

      dots.forEach((dot, index) => {
        dot.classList.toggle("active", index === currentSlide);
      });
    };

    // Heart toggle functionality
    document.querySelectorAll(".section6-heart-icon").forEach((heart) => {
      heart.addEventListener("click", function () {
        const icon = this.querySelector("i");
        icon.classList.toggle("far");
        icon.classList.toggle("fas");
        icon.classList.toggle("text-red-500");
      });
    });

    // Update dots on scroll
    carousel.addEventListener("scroll", updateDots);

    // Expose functions globally for onclick handlers
    window.scrollCarousel6 = scrollCarousel6;
    window.scrollToSlide6 = scrollToSlide;
  }

  initUtilityButtons() {
    const buttonHandlers = {
      'button[aria-label="Shopping Cart"]': () => console.log("Cart opened"),
      'button[aria-label="Wishlist"]': () => console.log("Wishlist opened"),
      ".cta-button": () => console.log("Sign In/Sign Up clicked"),
    };

    Object.entries(buttonHandlers).forEach(([selector, handler]) => {
      document.querySelectorAll(selector).forEach((btn) => {
        btn.addEventListener("click", handler);
      });
    });
  }
}

// Universal Carousel Class
class UniversalCarousel {
  constructor({ id, container, prev, next }) {
    this.id = id;
    this.container =
      document.getElementById(container) || document.querySelector(container);
    this.prevBtn =
      document.getElementById(prev) || document.querySelector(prev);
    this.nextBtn =
      document.getElementById(next) || document.querySelector(next);

    this.isValid = !!(this.container && this.prevBtn && this.nextBtn);
    if (!this.isValid) return;

    this.currentIndex = 0;
    this.totalCards = this.container.children.length;

    this.init();
  }

  init() {
    this.calculateDimensions();
    this.bindEvents();
    this.updateButtons();
    this.initTouchSupport();

    window.addEventListener(
      "resize",
      this.debounce(() => {
        this.calculateDimensions();
        this.updateButtons();
        this.updateNavVisibility();
      }, 250)
    );

    this.updateNavVisibility();
  }

  calculateDimensions() {
    if (!this.container.children.length) return;

    const firstCard = this.container.children[0];
    this.cardWidth = firstCard.offsetWidth + 24; // card width + gap

    // Responsive breakpoints
    const width = window.innerWidth;
    this.visibleCards =
      width < 640 ? 1 : width < 768 ? 2 : width < 1024 ? 3 : 4;
  }

  bindEvents() {
    this.prevBtn.addEventListener("click", () => this.previous());
    this.nextBtn.addEventListener("click", () => this.next());
  }

  previous() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateCarousel();
    }
  }

  next() {
    const maxIndex = Math.max(0, this.totalCards - this.visibleCards);
    if (this.currentIndex < maxIndex) {
      this.currentIndex++;
      this.updateCarousel();
    }
  }

  updateCarousel() {
    const scrollToX = this.currentIndex * this.cardWidth;
    this.container.scrollTo({ left: scrollToX, behavior: "smooth" });
    this.updateButtons();
  }

  updateButtons() {
    const maxIndex = Math.max(0, this.totalCards - this.visibleCards);

    this.prevBtn.disabled = this.currentIndex === 0;
    this.nextBtn.disabled = this.currentIndex >= maxIndex;

    this.prevBtn.style.opacity = this.prevBtn.disabled ? "0.5" : "1";
    this.nextBtn.style.opacity = this.nextBtn.disabled ? "0.5" : "1";
  }

  initTouchSupport() {
    let startX = 0,
      scrollLeft = 0;

    const touchEvents = {
      touchstart: (e) => {
        startX = e.touches[0].pageX - this.container.offsetLeft;
        scrollLeft = this.container.scrollLeft;
      },
      touchmove: (e) => {
        if (!startX) return;
        const x = e.touches[0].pageX - this.container.offsetLeft;
        const walk = (x - startX) * 2;
        this.container.scrollLeft = scrollLeft - walk;
      },
      touchend: () => (startX = 0),
    };

    Object.entries(touchEvents).forEach(([event, handler]) => {
      this.container.addEventListener(event, handler);
    });
  }

  updateNavVisibility() {
    if (this.id === "section5") {
      const display = window.innerWidth < 768 ? "none" : "flex";
      [this.prevBtn, this.nextBtn].forEach(
        (btn) => (btn.style.display = display)
      );
    }
  }

  // Utility method
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Global fallback for Section 5 (backward compatibility)
window.scrollCarousel = (direction) => {
  const carousel = document.getElementById("carousel");
  if (!carousel) return;

  const cardWidth = 312; // 288 + 24
  const scrollAmount = cardWidth * 2;

  carousel.scrollLeft += direction === "left" ? -scrollAmount : scrollAmount;
};

// Initialize everything
new WebsiteManager();

// Category filtering functionality
document.addEventListener("DOMContentLoaded", function () {
  const categoryButtons = document.querySelectorAll("[data-category]");
  const contentSections = document.querySelectorAll(".category-content");

  // Handle category filtering
  categoryButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const selectedCategory = this.getAttribute("data-category");

      // Remove active class from all category buttons
      categoryButtons.forEach((btn) => {
        const textElement = btn.querySelector(".tab-menu-text");
        textElement.classList.remove("tab-active-menu");
        textElement.classList.add("tab-inactive-menu");
      });

      // Add active class to clicked category
      const textElement = this.querySelector(".tab-menu-text");
      textElement.classList.remove("tab-inactive-menu");
      textElement.classList.add("tab-active-menu");

      // Hide all content sections
      contentSections.forEach((section) => {
        section.classList.add("hidden");
      });

      // Show selected content section
      const selectedContent = document.getElementById(
        `content-${selectedCategory}`
      );
      if (selectedContent) {
        selectedContent.classList.remove("hidden");
      }
    });
  });

  // Product Detail Functionality
  let selectedColor = "navy-blue";
  let selectedSize = "S";
  let quantity = 1;
  let isWishlisted = false;

  // Color selection
  const colorOptions = document.querySelectorAll(".color-option");
  const mainImage = document.getElementById("mainProductImage");
  const selectedColorName = document.getElementById("selectedColorName");

  colorOptions.forEach((option) => {
    option.addEventListener("click", function () {
      // Remove active class from all colors
      colorOptions.forEach((opt) => {
        opt.classList.remove("border-black", "active-color");
        opt.classList.add("border-transparent");
      });

      // Add active class to selected color
      this.classList.remove("border-transparent");
      this.classList.add("border-black", "active-color");

      // Update main image and color name
      const newImage = this.getAttribute("data-image");
      const colorName = this.getAttribute("data-name");
      selectedColor = this.getAttribute("data-color");

      mainImage.src = newImage;
      selectedColorName.textContent = colorName;

      // Add smooth transition effect
      mainImage.style.opacity = "0.7";
      setTimeout(() => {
        mainImage.style.opacity = "1";
      }, 150);
    });
  });

  // Size selection
  const sizeButtons = document.querySelectorAll(".size-option-btn");
  const selectedSizeDisplay = document.getElementById("selectedSize");

  sizeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      // Remove selected class from all sizes
      sizeButtons.forEach((btn) => {
        btn.classList.remove("selected", "bg-black", "text-white");
        btn.classList.add("bg-gray-200", "text-black");
      });

      // Add selected class to clicked size
      this.classList.remove("bg-gray-200", "text-black");
      this.classList.add("selected", "bg-black", "text-white");

      selectedSize = this.getAttribute("data-size");
      selectedSizeDisplay.textContent = selectedSize;

      // Update price based on size (example pricing)
      const prices = { S: "21,600.00", M: "22,400.00", L: "23,200.00" };
      document.getElementById("productPrice").textContent =
        prices[selectedSize];

      // Update VIP points
      const points = { S: "291", M: "302", L: "313" };
      document.getElementById("vipPoints").textContent = points[selectedSize];
    });
  });

  // Quantity controls
  const decreaseBtn = document.getElementById("decreaseQty");
  const increaseBtn = document.getElementById("increaseQty");
  const quantityDisplay = document.getElementById("quantityDisplay");

  decreaseBtn.addEventListener("click", function () {
    if (quantity > 1) {
      quantity--;
      quantityDisplay.textContent = quantity;
      updateButtonAnimation(this);
    }
  });

  increaseBtn.addEventListener("click", function () {
    if (quantity < 10) {
      // Max quantity limit
      quantity++;
      quantityDisplay.textContent = quantity;
      updateButtonAnimation(this);
    }
  });

  // Wishlist functionality
  const wishlistBtn = document.getElementById("wishlistBtn");
  wishlistBtn.addEventListener("click", function () {
    isWishlisted = !isWishlisted;
    const icon = this.querySelector("i");

    if (isWishlisted) {
      icon.classList.remove("far");
      icon.classList.add("fas", "text-red-500");
      this.classList.add("bg-red-50");
    } else {
      icon.classList.remove("fas", "text-red-500");
      icon.classList.add("far");
      this.classList.remove("bg-red-50");
    }

    updateButtonAnimation(this);
  });

  // Download functionality
  const downloadBtn = document.getElementById("downloadBtn");
  downloadBtn.addEventListener("click", function () {
    // Simulate download
    updateButtonAnimation(this);

    // Show temporary feedback
    const originalIcon = this.innerHTML;
    this.innerHTML = '<i class="fas fa-check text-green-500 text-lg"></i>';
    setTimeout(() => {
      this.innerHTML = originalIcon;
    }, 1000);
  });

  // Add to Cart functionality
  const addToCartBtn = document.getElementById("addToCartBtn");
  const successMessage = document.getElementById("successMessage");

  addToCartBtn.addEventListener("click", function () {
    const btnText = this.querySelector(".btn-text");
    const btnLoading = this.querySelector(".btn-loading");

    // Show loading state
    btnText.classList.add("hidden");
    btnLoading.classList.remove("hidden");
    this.disabled = true;

    // Simulate API call
    setTimeout(() => {
      // Hide loading state
      btnText.classList.remove("hidden");
      btnLoading.classList.add("hidden");
      this.disabled = false;

      // Show success message
      successMessage.classList.remove("hidden");
      successMessage.style.opacity = "0";
      successMessage.style.transform = "translateY(10px)";

      // Animate success message
      setTimeout(() => {
        successMessage.style.transition = "all 0.3s ease";
        successMessage.style.opacity = "1";
        successMessage.style.transform = "translateY(0)";
      }, 10);

      // Hide success message after 3 seconds
      setTimeout(() => {
        successMessage.style.opacity = "0";
        successMessage.style.transform = "translateY(-10px)";
        setTimeout(() => {
          successMessage.classList.add("hidden");
        }, 300);
      }, 3000);

      // Update cart count in navigation (if exists)
      const cartCount = document
        .querySelector(".fa-shopping-cart")
        .parentElement.querySelector("span");
      if (cartCount) {
        const currentCount = parseInt(cartCount.textContent);
        cartCount.textContent = currentCount + quantity;
      }

      console.log("Added to cart:", {
        color: selectedColor,
        size: selectedSize,
        quantity: quantity,
      });
    }, 1500);
  });

  // Helper function for button animations
  function updateButtonAnimation(button) {
    button.style.transform = "scale(0.95)";
    setTimeout(() => {
      button.style.transform = "scale(1)";
    }, 100);
  }

  // Initialize default selections
  document.querySelector('.color-option[data-color="navy-blue"]').click();
});

// Product Highlight Section JavaScript

/**
 * Toggle accordion sections in the product highlight component
 * @param {string} section - The section identifier (purpose, features, materials, reviews)
 */
window.toggleAccordion = function(section) {
  const content = document.getElementById(`${section}-content`);
  const icon = document.getElementById(`${section}-icon`);

  // Close all other accordions
  const allContents = document.querySelectorAll(
    ".product-highlight__accordion-content"
  );
  const allIcons = document.querySelectorAll(
    ".product-highlight__accordion-icon"
  );

  allContents.forEach((item) => {
    if (item.id !== `${section}-content`) {
      item.classList.remove("active");
    }
  });

  allIcons.forEach((item) => {
    if (item.id !== `${section}-icon`) {
      item.classList.remove("rotated");
    }
  });

  // Toggle current accordion
  content.classList.toggle("active");
  icon.classList.toggle("rotated");
}

/**
 * Initialize product highlight section functionality
 */
function initProductHighlight() {
  // Add interactive feedback for accordion buttons
  const buttons = document.querySelectorAll(
    ".product-highlight__accordion-button"
  );

  buttons.forEach((button) => {
    button.addEventListener("mouseenter", function () {
      this.style.backgroundColor = "#f9fafb";
    });

    button.addEventListener("mouseleave", function () {
      this.style.backgroundColor = "transparent";
    });
  });

  // Add keyboard accessibility
  buttons.forEach((button) => {
    button.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.click();
      }
    });
  });
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Check if product highlight section exists
  if (document.querySelector(".product-highlight")) {
    initProductHighlight();
  }
});

// Optional: Auto-close accordions when clicking outside
document.addEventListener("click", function (e) {
  const productHighlight = document.querySelector(".product-highlight");
  if (productHighlight && !productHighlight.contains(e.target)) {
    const allContents = document.querySelectorAll(
      ".product-highlight__accordion-content"
    );
    const allIcons = document.querySelectorAll(
      ".product-highlight__accordion-icon"
    );

    allContents.forEach((content) => content.classList.remove("active"));
    allIcons.forEach((icon) => icon.classList.remove("rotated"));
  }
});

// Add to Cart Section JavaScript

// Global state for add to cart
let addToCartState = {
  selectedSize: "S",
  isLoading: false,
  basePrice: 4700.0,
};

/**
 * Select a size option in the add to cart section
 * @param {string} size - The size to select (S, M, L)
 */
window.selectSize = function(size) {
  if (addToCartState.isLoading) return;

  // Remove selected class from all options
  document.querySelectorAll(".add-to-cart__size-option").forEach((option) => {
    option.classList.remove("selected");
  });

  // Add selected class to clicked option
  const selectedOption = document.querySelector(`[data-size="${size}"]`);
  if (selectedOption) {
    selectedOption.classList.add("selected");

    // Update global state
    addToCartState.selectedSize = size;

    // Update product title with new size
    updateCartProductTitle();

    // Visual feedback
    selectedOption.style.transform = "scale(1.05)";
    setTimeout(() => {
      selectedOption.style.transform = "";
    }, 150);

    console.log(`Size selected: ${size}`);
  }
}

/**
 * Update product title with selected size in cart section
 */
function updateCartProductTitle() {
  const titleElement = document.getElementById("cartProductTitle");
  if (titleElement) {
    const baseTitle = "WORDMARK CREW SOCKS 3 PACK / PEARL WHITE";
    const formattedPrice = addToCartState.basePrice.toLocaleString("en-PK");
    titleElement.textContent = `${baseTitle} / SIZE ${addToCartState.selectedSize} / Rs ${formattedPrice}`;
  }
}

/**
 * Add item to cart with loading states
 */
window.addToCart = async function() {
  if (addToCartState.isLoading) return;

  const button = document.getElementById("addToCartBtn");
  const buttonText = document.getElementById("buttonText");
  const buttonIcon = document.getElementById("buttonIcon");

  if (!button || !buttonText || !buttonIcon) {
    console.error("Add to cart elements not found");
    return;
  }

  // Set loading state
  addToCartState.isLoading = true;
  button.classList.add("loading");
  button.disabled = true;
  buttonText.textContent = "ADDING...";
  buttonIcon.className = "fas fa-spinner add-to-cart__spinner";

  try {
    // Simulate API call - replace with actual cart logic
    await simulateAddToCart();

    // Success state
    button.classList.remove("loading");
    button.classList.add("success");
    buttonText.textContent = "ADDED!";
    buttonIcon.className = "fas fa-check add-to-cart__button-icon";

    // Show success message
    showCartSuccessMessage();

    // Trigger any cart update events
    dispatchCartUpdateEvent();

    // Reset button after 2 seconds
    setTimeout(() => {
      resetAddToCartButton();
    }, 2000);
  } catch (error) {
    console.error("Error adding to cart:", error);

    // Error state
    button.classList.remove("loading");
    button.classList.add("error");
    buttonText.textContent = "TRY AGAIN";
    buttonIcon.className =
      "fas fa-exclamation-triangle add-to-cart__button-icon";

    // Reset button after 3 seconds
    setTimeout(() => {
      resetAddToCartButton();
    }, 3000);
  }
}

/**
 * Simulate adding item to cart (replace with actual implementation)
 */
async function simulateAddToCart() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate random success/failure for demo
      const success = Math.random() > 0.1; // 90% success rate

      if (success) {
        // Add item to cart logic here
        const cartItem = {
          id: "wordmark-crew-socks",
          name: "WORDMARK CREW SOCKS 3 PACK",
          color: "PEARL WHITE",
          size: addToCartState.selectedSize,
          price: addToCartState.basePrice,
          quantity: 1,
          timestamp: new Date().toISOString(),
        };

        console.log("Item added to cart:", cartItem);
        resolve(cartItem);
      } else {
        reject(new Error("Failed to add item to cart"));
      }
    }, 1500);
  });
}

/**
 * Reset add to cart button to initial state
 */
function resetAddToCartButton() {
  const button = document.getElementById("addToCartBtn");
  const buttonText = document.getElementById("buttonText");
  const buttonIcon = document.getElementById("buttonIcon");

  if (button && buttonText && buttonIcon) {
    addToCartState.isLoading = false;
    button.disabled = false;
    button.classList.remove("loading", "success", "error");
    buttonText.textContent = "ADD TO CART";
    buttonIcon.className = "fas fa-shopping-cart add-to-cart__button-icon";
  }
}

/**
 * Show success notification for cart
 */
function showCartSuccessMessage() {
  const message = document.getElementById("successMessage");
  if (message) {
    message.classList.add("show");

    // Hide after 3 seconds
    setTimeout(() => {
      message.classList.remove("show");
    }, 3000);
  }
}

/**
 * Dispatch custom event when cart is updated
 */
function dispatchCartUpdateEvent() {
  const event = new CustomEvent("cartUpdated", {
    detail: {
      action: "add",
      item: {
        name: "WORDMARK CREW SOCKS 3 PACK",
        size: addToCartState.selectedSize,
        price: addToCartState.basePrice,
      },
    },
  });
  document.dispatchEvent(event);
}

/**
 * Initialize the add to cart section functionality
 */
function initAddToCart() {
  // Check if add to cart section exists
  const addToCartSection = document.querySelector(".add-to-cart");
  if (!addToCartSection) return;

  // Add keyboard support for size selection
  document.querySelectorAll(".add-to-cart__size-option").forEach((option) => {
    option.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.click();
      }
    });

    // Add focus styles
    option.addEventListener("focus", function () {
      this.style.outline = "2px solid #EF4444";
    });

    option.addEventListener("blur", function () {
      this.style.outline = "";
    });
  });

  // Add keyboard support for add to cart button
  const addToCartBtn = document.getElementById("addToCartBtn");
  if (addToCartBtn) {
    addToCartBtn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!addToCartState.isLoading) {
          this.click();
        }
      }
    });
  }

  // Initialize with default values
  updateCartProductTitle();

  // Listen for cart update events
  document.addEventListener("cartUpdated", function (e) {
    console.log("Cart updated:", e.detail);
    // Update cart count, total, etc.
  });

  console.log("Add to Cart section initialized");
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  initAddToCart();
});

// Simple Cart Functionality
let cartQuantity = 1;
let itemPrice = 21600.0;

// Initialize cart when page loads
document.addEventListener("DOMContentLoaded", function () {
  if (document.querySelector(".gym-cart-section")) {
    updateCartDisplay();
    bindCartEvents();
  }
});

function bindCartEvents() {
  // Increase quantity
  document.addEventListener("click", function (e) {
    if (e.target.closest(".increase-btn")) {
      cartQuantity++;
      updateCartDisplay();
    }

    // Decrease quantity
    if (e.target.closest(".decrease-btn") && cartQuantity > 1) {
      cartQuantity--;
      updateCartDisplay();
    }

    // Remove item
    if (e.target.closest(".gym-cart-remove-btn")) {
      cartQuantity = 0;
      updateCartDisplay();
    }
  });
}

function updateCartDisplay() {
  // Update quantity and count
  const quantityEl = document.querySelector(".item-quantity");
  const countEl = document.getElementById("cart-count");
  if (quantityEl) quantityEl.textContent = cartQuantity;
  if (countEl) countEl.textContent = cartQuantity;

  // Update price
  const totalPrice = itemPrice * cartQuantity;
  const priceEl = document.querySelector(".item-price");
  if (priceEl)
    priceEl.textContent = totalPrice.toLocaleString("en-US", {
      minimumFractionDigits: 2,
    });

  // Update cart totals (simplified USD conversion)
  const totalUSD = Math.round(totalPrice / 100);
  const totalEl = document.getElementById("cart-total");
  const finalEl = document.getElementById("final-amount");
  if (totalEl) totalEl.textContent = totalUSD;
  if (finalEl) finalEl.textContent = totalUSD;

  // Update shipping progress
  const progress = Math.min((totalPrice / 20881) * 100, 100);
  const progressEl = document.getElementById("shipping-progress");
  if (progressEl) progressEl.style.width = progress + "%";

  // Update remaining amount
  const remaining = Math.max(0, 20881 - totalPrice);
  const remainingEl = document.getElementById("remaining-amount");
  if (remainingEl) remainingEl.textContent = remaining;

  // Disable decrease button if quantity is 1
  const decreaseBtn = document.querySelector(".decrease-btn");
  if (decreaseBtn) decreaseBtn.disabled = cartQuantity <= 1;

  // Show empty cart if quantity is 0
  if (cartQuantity === 0) {
    const cartItems = document.getElementById("cart-items");
    if (cartItems) {
      cartItems.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-shopping-cart text-gray-400 text-4xl mb-4"></i>
                    <p class="text-gray-600">Your cart is empty</p>
                </div>
            `;
    }
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // Handle payment method selection
  const paymentRadios = document.querySelectorAll(
    'input[name="payment_method"]'
  );
  const cardDetails = document.getElementById("card-details");

  paymentRadios.forEach((radio) => {
    radio.addEventListener("change", function () {
      if (this.value === "card") {
        cardDetails.style.display = "block";
      } else {
        cardDetails.style.display = "none";
      }
    });
  });

  // Handle discount code
  const discountInput = document.getElementById("discount-input");
  const applyButton = document.getElementById("apply-discount");

  applyButton.addEventListener("click", function () {
    const discountCode = discountInput.value.trim();
    if (discountCode) {
      // Show success message
      showMessage("Discount code applied successfully!", "success");
      discountInput.value = "";
    } else {
      showMessage("Please enter a discount code", "error");
    }
  });

  // Handle Enter key on discount input
  discountInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      applyButton.click();
    }
  });

  // Show message function
  function showMessage(message, type) {
    // Remove existing messages
    const existingMessage = document.querySelector(".checkout-message");
    if (existingMessage) {
      existingMessage.remove();
    }

    // Create new message
    const messageDiv = document.createElement("div");
    messageDiv.className = `checkout-message fixed top-4 right-4 px-4 py-2 rounded-lg text-white z-50 transition-all duration-300 ${
      type === "success" ? "bg-green-500" : "bg-red-500"
    }`;
    messageDiv.textContent = message;

    document.body.appendChild(messageDiv);

    // Remove message after 3 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.style.opacity = "0";
        setTimeout(() => messageDiv.remove(), 300);
      }
    }, 3000);
  }

  // Form validation
  const form = document.querySelector("form");
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // Basic validation
    const requiredFields = form.querySelectorAll(
      "input[required], select[required]"
    );
    let isValid = true;

    requiredFields.forEach((field) => {
      if (!field.value.trim()) {
        isValid = false;
        field.classList.add("border-red-500");
      } else {
        field.classList.remove("border-red-500");
      }
    });

    if (isValid) {
      showMessage("Order placed successfully!", "success");
    } else {
      showMessage("Please fill in all required fields", "error");
    }
  });

  // Add interactive hover effects
  const interactiveElements = document.querySelectorAll(
    'input, select, button, label[class*="cursor-pointer"]'
  );
  interactiveElements.forEach((element) => {
    element.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-1px)";
    });

    element.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0)";
    });
  });
});

// Privacy FAQ Section JavaScript
// File: privacy-faq.js

// Auto-activate tab based on current page
function initPageTab() {
  const currentPage = window.location.pathname.toLowerCase();
  let activeTab = "faqs"; // default

  if (currentPage.includes("privacy-policy.html")) {
    activeTab = "privacy";
  } else if (currentPage.includes("contact-us.html")) {
    activeTab = "contact";
  } else if (currentPage.includes("faqs.html")) {
    activeTab = "faqs";
  }

  switchTab(activeTab);
}

// Tab switching function
function switchTab(targetTab) {
  // Update nav buttons
  document.querySelectorAll(".privacy-faq-nav-tab").forEach((t) => {
    t.classList.remove("privacy-faq-nav-active");
    t.classList.add("privacy-faq-nav-inactive");
  });

  const activeTabElement = document.querySelector(`[data-tab="${targetTab}"]`);
  if (activeTabElement) {
    activeTabElement.classList.add("privacy-faq-nav-active");
    activeTabElement.classList.remove("privacy-faq-nav-inactive");
  }

  // Show/hide content
  document.querySelectorAll(".privacy-faq-tab-content").forEach((content) => {
    content.classList.add("hidden");
  });

  const targetContent = document.getElementById(targetTab);
  if (targetContent) {
    targetContent.classList.remove("hidden");
  }
}

// Initialize all event listeners
function initPrivacyFaqEvents() {
  // Tab click handlers
  document.querySelectorAll(".privacy-faq-nav-tab").forEach((tab) => {
    tab.addEventListener("click", function () {
      switchTab(this.dataset.tab);
    });
  });

  // Accordion functionality
  document.querySelectorAll(".privacy-faq-accordion-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const targetId = this.dataset.target;
      const targetContent = document.getElementById(targetId);

      if (!targetContent) return;

      const isHidden = targetContent.classList.contains("hidden");

      // Close all other accordions
      document
        .querySelectorAll(".privacy-faq-accordion-btn")
        .forEach((otherBtn) => {
          if (otherBtn !== this) {
            const otherId = otherBtn.dataset.target;
            const otherContent = document.getElementById(otherId);
            if (otherContent) {
              otherContent.classList.add("hidden");
            }
            otherBtn.classList.remove("privacy-faq-accordion-active");
          }
        });

      // Toggle current accordion
      if (isHidden) {
        targetContent.classList.remove("hidden");
        this.classList.add("privacy-faq-accordion-active");
      } else {
        targetContent.classList.add("hidden");
        this.classList.remove("privacy-faq-accordion-active");
      }
    });
  });

  // Form submission handler
  const contactForm = document.querySelector("#contact form");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();

      // Get form data
      const formData = new FormData(this);
      const name = formData.get("fullName");
      const email = formData.get("emailAddress");

      // Basic validation
      if (!name || !email) {
        alert("Please fill in all required fields.");
        return;
      }

      // Success message
      alert(
        "Thank you for your message! We will get back to you within 24-48 hours."
      );

      // Optional: Reset form
      this.reset();
    });
  }
}

// Initialize everything when DOM is loaded
function initPrivacyFaq() {
  initPrivacyFaqEvents();
  initPageTab();
}

// Auto-initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initPrivacyFaq);

// Export functions for manual initialization if needed
window.PrivacyFaq = {
  init: initPrivacyFaq,
  switchTab: switchTab,
  initEvents: initPrivacyFaqEvents,
  initPageTab: initPageTab,
};

document.addEventListener("DOMContentLoaded", function () {
  const container = document.getElementById("carouselContainer");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const leftArrowBtn = document.getElementById("leftArrowBtn");
  const rightArrowBtn = document.getElementById("rightArrowBtn");

  const cardWidth = 302; // Card width + gap
  const gap = 24;
  const scrollAmount = cardWidth + gap;

  function scrollPrevious() {
    container.scrollBy({
      left: -scrollAmount,
      behavior: "smooth",
    });
  }

  function scrollNext() {
    container.scrollBy({
      left: scrollAmount,
      behavior: "smooth",
    });
  }

  // Mobile navigation buttons
  if (prevBtn) {
    prevBtn.addEventListener("click", scrollPrevious);
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", scrollNext);
  }

  // Desktop navigation arrows
  if (leftArrowBtn) {
    leftArrowBtn.addEventListener("click", scrollPrevious);
  }

  if (rightArrowBtn) {
    rightArrowBtn.addEventListener("click", scrollNext);
  }

  // Optional: Auto-scroll functionality
  let autoScrollInterval;

  function startAutoScroll() {
    autoScrollInterval = setInterval(() => {
      const maxScroll = container.scrollWidth - container.clientWidth;
      if (container.scrollLeft >= maxScroll) {
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        container.scrollBy({ left: scrollAmount, behavior: "smooth" });
      }
    }, 4000);
  }

  function stopAutoScroll() {
    clearInterval(autoScrollInterval);
  }

  // Start auto-scroll
  startAutoScroll();

  // Pause auto-scroll on hover
  container.addEventListener("mouseenter", stopAutoScroll);
  container.addEventListener("mouseleave", startAutoScroll);

  // Pause auto-scroll when buttons are clicked
  function pauseAndResumeAutoScroll() {
    stopAutoScroll();
    setTimeout(startAutoScroll, 3000); // Resume after 3 seconds
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", pauseAndResumeAutoScroll);
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", pauseAndResumeAutoScroll);
  }

  if (leftArrowBtn) {
    leftArrowBtn.addEventListener("click", pauseAndResumeAutoScroll);
  }

  if (rightArrowBtn) {
    rightArrowBtn.addEventListener("click", pauseAndResumeAutoScroll);
  }
});

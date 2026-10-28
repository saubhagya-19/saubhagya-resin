
// 1. FUNCTION TO ADD ITEMS (Used in index.html)
function addToCart(id, name, price, image) {
  let cart = JSON.parse(localStorage.getItem('resinCart')) || [];

  let existingProduct = cart.find(item => item.id === id);

  if (existingProduct) {
    existingProduct.quantity += 1;
  } else {
    cart.push({ id: id, name: name, price: price, image: image, quantity: 1 });
  }

  localStorage.setItem('resinCart', JSON.stringify(cart));
  alert(name + " added to cart!");
  updateCartBadge();
}

// 2. FUNCTION TO UPDATE BADGE COUNT (Used in Header)
function updateCartBadge() {
  let cart = JSON.parse(localStorage.getItem('resinCart')) || [];
  let totalCount = cart.reduce((total, item) => total + item.quantity, 0);
  
  let badge = document.getElementById('cart-count');
  if (badge) {
    badge.textContent = totalCount;
  }
}

// 3. FUNCTION TO DISPLAY ITEMS ON CART PAGE (Runs inside cart.html)
function displayCart() {
  let cartContainer = document.getElementById('cart-container');
  if (!cartContainer) return; // Stop if not on cart.html page

  let cart = JSON.parse(localStorage.getItem('resinCart')) || [];
  cartContainer.innerHTML = "";
  let total = 0;

  if (cart.length === 0) {
    cartContainer.innerHTML = "<p>Your cart is empty.</p>";
    document.getElementById('total-price').textContent = "Total: ₹0";
    return;
  }

  cart.forEach(item => {
    let itemTotal = item.price * item.quantity;
    total += itemTotal;

    cartContainer.innerHTML += `
      <div style="border-bottom: 1px solid #ccc; padding: 10px 0; display: flex; align-items: center; gap: 15px;">
        <img src="${item.image}" width="60" height="60" style="object-fit:cover;">
        <div>
          <h3>${item.name}</h3>
          <p>Price: ₹${item.price} x ${item.quantity}</p>
        </div>
        <div style="margin-left: auto;">
          <strong>₹${itemTotal}</strong>
        </div>
      </div>
    `;
  });

  document.getElementById('total-price').textContent = "Total: ₹" + total;
}

// Run automatic checks when page loads
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  displayCart();
});
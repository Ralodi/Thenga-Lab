# Product Variants & Wholesaler-Specific Products Implementation Guide

## Overview

This document outlines the implementation of two major features:
1. **Product Variants** - Support for multiple sizes/options with different prices per product
2. **Wholesaler-Specific Products** - Products are now associated with specific wholesalers

## Feature 1: Product Variants (Sizes with Different Prices)

### What Changed

Each product can now have multiple variants (sizes), each with its own price.

**Example:**
```
Product: Castle Lager
├─ 330ml Dumpy – R18
├─ 500ml Can – R22
└─ 750ml Quart – R30
```

### How It Works

#### 1. **Product Card Component** (`src/components/ProductCard.tsx`)
- Displays size selection buttons with prices
- Each size shows its specific price
- When customer selects a size, they see the price for that specific variant
- Enhanced to pass `variantId` and `variantPrice` to cart

**Visual Example:**
```
Castle Lager
[330ml - R18] [500ml - R22] [750ml - R30]  ← Price shown per size
         ↓ User selects a size
R 22.00  ← Price updates based on selection
[Add to Cart]
```

#### 2. **Cart System** (`src/store/useCartStore.ts`)
- Tracks variant ID and variant price separately from product
- Cart items now include:
  - `variantId` - Identifies which variant was selected
  - `variantPrice` - The actual price paid for that variant

**Cart Calculation:**
```typescript
// Before: Always used product.price
total = 18 * 2 = R36

// After: Uses variant-specific price
variant: 500ml Can @ R22
total = 22 * 2 = R44
```

#### 3. **Cart Display** (`src/components/Cart.tsx`)
- Shows variant prices instead of base product price
- Each cart item displays its actual price
- Example:
```
Castle Lager (500ml Can) x 2
R 22.00 each
Total: R 44.00
```

#### 4. **Checkout & Invoice** (`src/components/CheckoutForm.tsx`, `src/pages/InvoicePreview.tsx`)
- Correctly calculates totals using variant prices
- Invoice shows variant prices and correct totals
- Example order:
```
Product                  Qty  Unit Price  Total
Castle Lager (500ml)     x 2  R 22.00    R 44.00
Heineken (330ml)         x 1  R 18.50    R 18.50
                              Subtotal: R 62.50
```

#### 5. **Admin Dashboard** (`src/pages/AdminDashboard.tsx`)
- NEW: Variant management section in product form
- Admin can add multiple variants with different sizes and prices
- Example UI:
```
✨ NEW: Product Variants (Different Prices for Same Product)

[330ml Dumpy] – [Price: 18.00]
[500ml Can]   – [Price: 22.00]
[750ml Quart] – [Price: 30.00]

[+ Add Size] [+ Add Variant] buttons
```

### Data Flow

```
ProductCard (displays variants)
    ↓
User selects size (e.g., "500ml Can")
    ↓
Gets variant price (e.g., R22)
    ↓
addToCart(product, quantity, size, variantId, variantPrice)
    ↓
Cart stores { variantId, variantPrice }
    ↓
Cart calculates total using variantPrice
    ↓
Checkout displays variant-specific prices
    ↓
Invoice printed with correct numbers
```

---

## Feature 2: Wholesaler-Specific Products

### What Changed

Products are now associated with specific wholesalers. When a tavern/customer selects a wholesaler, they see only that wholesaler's products.

**Example:**
```
Wholesaler A (Johannesburg)
├─ Castle Lager
├─ Heineken
└─ Guinness

Wholesaler B (Pretoria)
├─ Windhoek Lager
├─ Black Label
└─ Tusker
```

### How It Works

#### 1. **Product Type** (`src/types/product.ts`)
- Product now includes `wholesalerId` field
- Associates each product with a specific wholesaler

```typescript
interface Product {
  id: string;
  name: string;
  wholesalerId?: string;  // NEW: Which wholesaler owns this product
  variants?: ProductVariant[];  // NEW: Multiple sizes/prices
  // ... other fields
}
```

#### 2. **Admin Product Creation** (`src/pages/AdminDashboard.tsx`)
- When creating a product, admin selects the wholesaler
- Product form includes wholesaler dropdown:
```
Select Wholesaler:
[ Wholesaler A (Johannesburg) ▼ ]
                      ↓
                   Choose
```

#### 3. **Frontend Wholesaler Selection** (`src/pages/Index.tsx`)
- Already implemented!
- Shows area and wholesaler dropdown
- UI flow:
```
1. Select Area: [Johannesburg ▼]
2. Select Wholesaler: [Wholesaler A ▼]
3. Products filtered to show only Wholesaler A's products
```

#### 4. **Product Fetching** (`src/services/productService.ts`)
- Function `fetchProductsByWholesaler(wholesalerId)` filters products
- Only returns products for selected wholesaler
- Example:
```typescript
// Customer selects "Wholesaler A"
const products = await fetchProductsByWholesaler('wholesaler-a-id');
// Returns only products with wholesaler_id = 'wholesaler-a-id'
```

### Data Flow - Product Discovery

```
App loads
    ↓
Fetch available wholesalers
    ↓
Display area dropdown + wholesaler dropdown
    ↓
User selects area (e.g., "Johannesburg")
    ↓
Display wholesalers in that area
    ↓
User selects wholesaler (e.g., "Wholesaler A")
    ↓
fetchProductsByWholesaler('wholesaler-a-id')
    ↓
Display only Wholesaler A's products
    ↓
User adds to cart + checks out
```

---

## BONUS: Same Product, Different Prices Per Wholesaler

The system automatically supports this! Each wholesaler can have the same product (e.g., "Castle Lager") with different pricing.

**Example:**
```
Wholesaler A (Downtown)
├─ Castle Lager - R18 per can

Wholesaler B (Suburbs)
├─ Castle Lager - R17.50 per can

Wholesaler C (Airport)
├─ Castle Lager - R22 per can
```

When customer selects a wholesaler, they see that wholesaler's price for the product. This is handled automatically through the `wholesalerId` association.

---

## Directory Reference

### Modified Files

| File | Changes |
|------|---------|
| `src/types/product.ts` | **NEW** - ProductVariant interface, updated Product with wholesalerId & variants |
| `src/data/products.ts` | Updated Product type reference |
| `src/types/cart.ts` | Added variantId and variantPrice to CartItem |
| `src/store/useCartStore.ts` | Enhanced to track and calculate with variant prices |
| `src/components/ProductCard.tsx` | Display variant prices, pass variantId/Price to cart |
| `src/components/Cart.tsx` | Show variant prices in cart summary |
| `src/components/CheckoutForm.tsx` | Calculate totals with variant prices |
| `src/pages/InvoicePreview.tsx` | Display variant prices on invoice |
| `src/pages/AdminDashboard.tsx` | Add product variant management UI |

### Existing Files (No Changes Needed)

- `src/pages/Index.tsx` - Already supports wholesaler filtering ✓
- `src/services/productService.ts` - Already has `fetchProductsByWholesaler()` ✓
- `src/services/wholesalerService.ts` - Unchanged ✓

---

## User Workflows

### Customer Workflow: Ordering with Variants

```
1. App opens
2. Select Area → Select Wholesaler
3. Browse products
4. Click product with multiple sizes
   → See all sizes with prices displayed
   → Select preferred size (price updates)
   → Add to cart
5. Cart shows selected variant with correct price
6. Proceed to checkout
   → Invoice shows variant prices
7. Order confirmed
```

### Admin Workflow: Creating Product with Variants

```
1. Go to Admin Dashboard
2. Click "Add Product"
3. Fill basic info (name, description, image)
4. Select wholesaler
5. ✨ NEW: Scroll to "Product Variants" section
   → Enter Size: "330ml Dumpy"
   → Enter Price: "18.00"
   → Click "+ Add Variant"
   → Enter Size: "500ml Can"
   → Enter Price: "22.00"
   → Click "+ Add Variant"
   → Enter Size: "750ml Quart"
   → Enter Price: "30.00"
   → Click "+ Add Variant"
6. Click "Create Product"
7. Product saved with all variants
```

### Admin Workflow: Same Product, Different Wholesalers

```
1. Create Product A for Wholesaler 1 @ R18
2. Create Product A for Wholesaler 2 @ R17.50
   (Same product name, different prices)
3. Both appear correctly filtered when customer
   selects each wholesaler
```

---

## Backward Compatibility ✓

All changes are **backward compatible**:
- Products without variants still work (use single price)
- All prices calculated correctly for both cases
- Existing orders not affected
- Database migrations not required

---

## Testing Checklist

- [ ] Create product with multiple variants
- [ ] Verify each variant displays correct price in ProductCard
- [ ] Add variant items to cart
- [ ] Verify cart shows variant prices (not base price)
- [ ] Checkout calculation uses variant prices
- [ ] Invoice prints correct variant prices
- [ ] Product filtering by wholesaler works
- [ ] Same product name appears under multiple wholesalers with correct prices
- [ ] Existing products without variants still work

---

## Technical Implementation Notes

### Variant Price Priority

```typescript
// When adding to cart:
const price = variantPrice ?? product.price;

// Fallback chain:
1. Use variantPrice (if provided)
2. Fall back to product.price
3. Always have a valid number
```

### Cart Item Key

```typescript
// Unique identification of cart item:
const key = `${productId}-${size}-${variantId}`;

// Important: Two sizes of same product = separate cart items
// Castle Lager 330ml x2 and Castle Lager 500ml x2 = 2 separate line items
```

### Database Considerations

Current implementation works with existing database:
- Products table has `wholesaler_id` (used for filtering)
- Variants stored as product metadata
- Future enhancement: Dedicated product_variants table with relationship

---

## Future Enhancements

1. **Stock Management per Variant**
   - Track stock separately for each size
   - Example: 330ml (50 available) vs 500ml (20 available)

2. **Variant Images**
   - Different images for each size
   - Example: Show label design for each bottle size

3. **Bulk Pricing**
   - Support discounts for bulk variant orders
   - Example: Buy 6x 330ml = R15 each (vs R18)

4. **Variant Availability**
   - Show "Out of Stock" per variant
   - Example: 750ml Quart not available this week

5. **Variant Search**
   - Filter by size when searching products
   - Example: "Find all 500ml beers under R25"

---

## Support & Troubleshooting

### Issue: Wrong price in cart
**Solution:** Ensure ProductCard passes variantPrice to addToCart

### Issue: Cart total wrong
**Solution:** Check that cart store's getTotal() uses variantPrice

### Issue: Products not filtering by wholesaler
**Solution:** Verify selectedWholesalerId is being used in fetchProductsByWholesaler()

### Issue: Variant not showing in ProductCard
**Solution:** Check that product.variants array is populated from product service


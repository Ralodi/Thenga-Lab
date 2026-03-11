# Code Examples: Product Variants & Wholesaler Features

## Adding Variant Support to Your Code

### 1. Creating a Product with Variants

**In Admin Dashboard:**
```typescript
// Admin Form State
const [formVariants, setFormVariants] = useState<VariantFormRow[]>([]);
const [formVariantInput, setFormVariantInput] = useState({ size: '', price: '' });

// Add variant handler
const addVariantToForm = () => {
  const newVariant = {
    tempId: `temp-${Date.now()}`,
    size: formVariantInput.size,
    price: Number(formVariantInput.price),
  };
  setFormVariants([...formVariants, newVariant]);
  setFormVariantInput({ size: '', price: '' });
};

// Remove variant handler
const removeVariantFromForm = (tempId: string) => {
  setFormVariants(formVariants.filter(v => v.tempId !== tempId));
};
```

**UI Component:**
```tsx
<div className="border rounded p-3 bg-blue-50 space-y-2">
  <p className="text-sm font-medium">✨ Product Variants</p>
  
  {/* Display added variants */}
  {formVariants.map((variant) => (
    <div key={variant.tempId} className="flex justify-between">
      <span>{variant.size} – R {variant.price.toFixed(2)}</span>
      <button onClick={() => removeVariantFromForm(variant.tempId)}>Remove</button>
    </div>
  ))}
  
  {/* Add new variant form */}
  <input
    placeholder="Size (e.g., 500ml)"
    value={formVariantInput.size}
    onChange={(e) => setFormVariantInput(prev => ({ ...prev, size: e.target.value }))}
  />
  <input
    type="number"
    placeholder="Price (R)"
    value={formVariantInput.price}
    onChange={(e) => setFormVariantInput(prev => ({ ...prev, price: e.target.value }))}
  />
  <Button onClick={addVariantToForm}>+ Add Variant</Button>
</div>
```

---

### 2. Displaying Variants in ProductCard

**Getting variant price:**
```typescript
// ProductCard.tsx
const selectedVariantData = useMemo(() => {
  if (product.variants && product.variants.length > 0) {
    const matched = product.variants.find(
      (v) => normalizeSize(v.size) === normalizeSize(selectedSize)
    );
    if (matched) {
      return {
        variantId: matched.id,
        variantPrice: matched.price,
        variantSize: matched.size,
      };
    }
  }
  return null;
}, [product.variants, selectedSize]);

// Display price
const displayPrice = selectedVariantData?.variantPrice ?? selectedVariant.price;
```

**Size buttons with prices:**
```tsx
{sizeOptions.map((size) => {
  const variant = product.variants?.find(
    v => normalizeSize(v.size) === normalizeSize(size)
  );
  const price = variant?.price ?? selectedVariant.price;
  
  return (
    <button
      key={size}
      onClick={() => setSelectedSize(size)}
      className={`px-2 py-1 text-xs rounded border`}
      title={`${size} - R ${price.toFixed(2)}`}
    >
      <span>{size}</span>
      <span className="text-xs opacity-75">R {price.toFixed(2)}</span>
    </button>
  );
})}
```

**Adding to cart with variant:**
```typescript
const handleAddToCart = () => {
  const finalPrice = selectedVariantData?.variantPrice ?? selectedVariant.price;
  const finalVariantId = selectedVariantData?.variantId ?? undefined;
  
  addToCart(
    selectedVariant,
    quantity,
    selectedSize,
    finalVariantId,
    finalPrice
  );
};
```

---

### 3. Cart Calculations with Variants

**Store implementation:**
```typescript
// src/store/useCartStore.ts

interface CartStore {
  items: CartItem[];
  addToCart: (
    product: Product,
    quantity: number,
    selectedSize?: string,
    variantId?: string,
    variantPrice?: number
  ) => void;
  getTotal: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  
  addToCart: (product, quantity, selectedSize, variantId, variantPrice) => {
    set((state) => {
      const existingItemIndex = state.items.findIndex(
        (item) =>
          item.product.id === product.id &&
          normalizeSize(item.selectedSize) === normalizeSize(selectedSize) &&
          normalizeVariantId(item.variantId) === normalizeVariantId(variantId)
      );

      if (existingItemIndex !== -1) {
        const updatedItems = [...state.items];
        updatedItems[existingItemIndex].quantity += quantity;
        return { items: updatedItems };
      } else {
        return {
          items: [
            ...state.items,
            {
              product,
              quantity,
              selectedSize: selectedSize?.trim() || undefined,
              variantId: variantId?.trim() || undefined,
              variantPrice: typeof variantPrice === 'number' ? variantPrice : undefined,
            },
          ],
        };
      }
    });
  },

  getTotal: () => {
    return get().items.reduce((total, item) => {
      // Use variant price if available, otherwise use product price
      const itemPrice = typeof item.variantPrice === 'number'
        ? item.variantPrice
        : item.product.price;
      return total + itemPrice * item.quantity;
    }, 0);
  },
}));
```

---

### 4. Displaying Variant Prices in Cart

**Cart item rendering:**
```tsx
// Cart.tsx
{items.map((item) => {
  // Use variant price if available, else product price
  const itemPrice = typeof item.variantPrice === 'number'
    ? item.variantPrice
    : item.product.price;
  
  // Unique key for variant items
  const itemKey = `${item.product.id}-${item.selectedSize ?? ''}-${item.variantId ?? ''}`;
  
  return (
    <div key={itemKey} className="mb-4">
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <h3 className="font-medium">{item.product.name}</h3>
          {item.selectedSize && (
            <p className="text-xs text-gray-500">Size: {item.selectedSize}</p>
          )}
          <p className="text-sm text-gray-500">
            R {itemPrice.toFixed(2)} each
          </p>
        </div>

        <div className="flex items-center">
          {/* Quantity controls */}
          <button
            onClick={() => updateQuantity(
              item.product.id,
              item.quantity - 1,
              item.selectedSize,
              item.variantId
            )}
          >
            <Minus size={16} />
          </button>
          <span className="px-2 py-1">{item.quantity}</span>
          <button
            onClick={() => updateQuantity(
              item.product.id,
              item.quantity + 1,
              item.selectedSize,
              item.variantId
            )}
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="ml-4 flex items-center">
          <span className="font-medium mr-2">
            R {(itemPrice * item.quantity).toFixed(2)}
          </span>
          <button
            onClick={() => removeItem(
              item.product.id,
              item.selectedSize,
              item.variantId
            )}
          >
            <XCircle size={20} />
          </button>
        </div>
      </div>
    </div>
  );
})}
```

---

### 5. Checkout with Variant Prices

**Showing items in checkout:**
```tsx
{items.map((item) => {
  const itemPrice = typeof item.variantPrice === 'number'
    ? item.variantPrice
    : item.product.price;
  const itemKey = `${item.product.id}-${item.selectedSize ?? ''}-${item.variantId ?? ''}`;
  
  return (
    <li key={itemKey} className="flex justify-between">
      <span>
        {item.product.name}
        {item.selectedSize && ` (${item.selectedSize})`} x {item.quantity}
        <span className="text-xs text-gray-600 ml-1">
          @ R {itemPrice.toFixed(2)}
        </span>
      </span>
      <span>R {(itemPrice * item.quantity).toFixed(2)}</span>
    </li>
  );
})}
```

---

### 6. Invoice with Variant Prices

**Invoice item rendering:**
```tsx
// InvoicePreview.tsx
{orderData.items.map((item, idx) => {
  // Use variant price if available
  const unitPrice = typeof item.variantPrice === 'number'
    ? item.variantPrice
    : item.product.price;
  const total = unitPrice * item.quantity;
  
  return (
    <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
      <td style={cell(40)}>
        {item.product.name}
        {item.selectedSize && ` (${item.selectedSize})`}
        {item.product.description && ` - ${item.product.description}`}
      </td>
      <td style={cell(10, 'center')}>{item.quantity}</td>
      <td style={cell(20, 'right')}>R{unitPrice.toFixed(2)}</td>
      <td style={cell(20, 'right')}>R{total.toFixed(2)}</td>
    </tr>
  );
})}
```

---

### 7. Filtering by Wholesaler

**In Index page:**
```typescript
// Already implemented!
useEffect(() => {
  if (!selectedWholesalerId) {
    setProducts([]);
    return;
  }

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      // Fetch products for selected wholesaler
      const data = await fetchProductsByWholesaler(selectedWholesalerId);
      setProducts(data);
    } finally {
      setLoadingProducts(false);
    }
  };

  loadProducts();
}, [selectedWholesalerId]);
```

**Service function:**
```typescript
// productService.ts - Already implemented
export const fetchProductsByWholesaler = 
  async (wholesalerId: string): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('vw_catalog_products_phase1')
    .select('...')
    .eq('product_is_active', true)
    .eq('wholesaler_id', wholesalerId)  // ← Filters by wholesaler
    .order('product_name', { ascending: true });
  
  // ... error handling and data transformation
  return mappedProducts;
};
```

---

### 8. Type Definitions

**Product with variants:**
```typescript
// src/types/product.ts
export interface ProductVariant {
  id: string;
  productId: string;
  size: string;        // e.g., "330ml Dumpy"
  price: number;
  sku?: string;
  stock?: number;
}

export interface EnhancedProduct {
  id: string;
  name: string;
  type: string;
  image: string;
  description: string;
  price: number;                          // Default/first variant price
  stock: number;
  unit: string;
  wholesalerId?: string;                  // NEW: Wholesaler association
  variants?: ProductVariant[];             // NEW: Multiple sizes/prices
  // ... other fields
}

// For backward compatibility
export type Product = EnhancedProduct;
```

**Cart item with variant:**
```typescript
// src/types/cart.ts
export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize?: string;
  variantId?: string;                     // NEW: Variant identifier
  variantPrice?: number;                  // NEW: Variant-specific price
}
```

---

## Usage Patterns

### Pattern 1: Products Without Variants (Backward Compatible)

```typescript
// Old behavior still works
const product = {
  id: 'beer-1',
  name: 'Regular Beer',
  price: 20,
  // No variants array
};

// Treated as single-variant product
cart.addToCart(product, 1);
// Uses price: 20
```

### Pattern 2: Products With Variants

```typescript
// New functionality
const product = {
  id: 'beer-1',
  name: 'Castle Lager',
  price: 18,  // Default/first variant price
  variants: [
    { id: 'v1', size: '330ml', price: 18 },
    { id: 'v2', size: '500ml', price: 22 },
    { id: 'v3', size: '750ml', price: 30 },
  ],
};

// User selects 500ml variant
cart.addToCart(product, 2, '500ml', 'v2', 22);
// Correctly uses price: 22 per unit
// Total: 22 * 2 = 44
```

### Pattern 3: Same Product, Different Wholesalers

```typescript
// Product A from Wholesaler 1
const productA1 = {
  id: 'product-abc-w1',
  name: 'Castle Lager',
  price: 18,
  wholesalerId: 'wholesaler-1',
};

// Product A from Wholesaler 2 (different price)
const productA2 = {
  id: 'product-abc-w2',
  name: 'Castle Lager',
  price: 17.50,
  wholesalerId: 'wholesaler-2',
};

// Customer filters by wholesaler
products = await fetchProductsByWholesaler('wholesaler-1');
// Returns productA1 @ R18

products = await fetchProductsByWholesaler('wholesaler-2');
// Returns productA2 @ R17.50
```

---

## Common Calculations

### Total Price Calculation

```typescript
// Before (single price)
total = product.price * quantity;

// After (with variants)
const unitPrice = item.variantPrice ?? item.product.price;
total = unitPrice * quantity;

// Example:
item = {
  product: { price: 18 },
  quantity: 2,
  variantPrice: 22  // User selected 500ml @ R22
};
total = 22 * 2 = 44  // Correct!
```

### Cart Total

```typescript
// Single variant per product
const cartTotal = items.reduce((sum, item) => {
  const price = item.variantPrice ?? item.product.price;
  return sum + (price * item.quantity);
}, 0);
```

### Displaying Prices

```typescript
// Always use fallback pattern
const displayPrice = (item: CartItem) => {
  if (typeof item.variantPrice === 'number') {
    return item.variantPrice;
  }
  return item.product.price;
};
```

---

## Error Handling

```typescript
// Validate variant exists
if (variantId && !product.variants?.find(v => v.id === variantId)) {
  throw new Error(`Variant ${variantId} not found`);
}

// Validate price is positive
if (variantPrice !== undefined && variantPrice <= 0) {
  throw new Error('Variant price must be greater than 0');
}

// Fallback gracefully
const finalPrice = typeof variantPrice === 'number'
  ? Math.max(0, variantPrice)
  : (product.price || 0);
```


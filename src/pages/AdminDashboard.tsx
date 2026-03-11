import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getUser } from '@/services/authService';
import {
  assignOrderDriver,
  fetchDeliveredOrderDetails,
  fetchAdminAnalytics,
  fetchAdminOrders,
  fetchAdminDriverProfiles,
  fetchThengaIncomeSummary,
  fetchWholesalerAmountsOwed,
  fetchWholesalerSettlementDetails,
  createWholesaler,
  fetchAdminProducts,
  fetchAdminWholesalers,
  fetchProductTypes,
  fetchSalesSummary,
  fileToDataUrl,
  type AdminProduct,
  type AdminProductType,
  type AdminOrder,
  type AdminDriverProfile,
  type AdminWholesaler,
  type AdminAnalytics,
  type DeliveredOrderDetails,
  type DriverProfileUpsertInput,
  type ProductUpsertInput,
  type SalesSummary,
  type ThengaIncomeSummary,
  type WholesalerOwedRow,
  type WholesalerSettlementDetail,
  upsertDriverProfile,
  upsertProduct,
  updateProductPrice,
  updateWholesaler,
  uploadProductImage,
} from '@/services/adminService';
import { useToast } from '@/components/ui/use-toast';
import {
  fetchAllOffers,
  offerFileToDataUrl,
  type Offer,
  type OfferUpsertInput,
  upsertOffer,
  uploadOfferImage,
} from '@/services/offersService';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const TEST_ADMIN_MODE = import.meta.env.VITE_ENABLE_TEST_ADMIN_MODE === 'true';

const emptyWholesalerForm = {
  name: '',
  area: '',
  city: '',
  is_active: true,
};

const emptyProductForm: ProductUpsertInput = {
  name: '',
  family_name: '',
  brand_name: '',
  available_sizes: [],
  variant_name: '',
  volume_ml: null,
  description: '',
  image: '',
  price: 0,
  stock: 0,
  unit: 'case',
  isactive: true,
  wholesaler_id: null,
  product_type_id: null,
  base_cost: 0,
  margin_type: 'fixed',
  margin_value: 0,
};

const emptyDriverForm: DriverProfileUpsertInput = {
  user_id: null,
  full_name: '',
  contact_number: '',
  car_model: '',
  reg_number: '',
  area: '',
  city: '',
  is_active: true,
};

const emptyOfferForm: OfferUpsertInput = {
  title: '',
  subtitle: '',
  image_url: '',
  bg_color: '#0f3b74',
  text_color: '#ffffff',
  cta_text: '',
  cta_link: '',
  bonus_points: 0,
  min_order_total: null,
  campaign_priority: 100,
  is_stackable: false,
  area: null,
  wholesaler_id: null,
  is_active: true,
  start_at: null,
  end_at: null,
};

const COMMON_SIZE_OPTIONS = ['330ml', '440ml', '500ml', '750ml', '1L', '2L'];

const normalizeSizeLabel = (value?: string | null): string => String(value ?? '').trim();

const normalizeSizeList = (sizes?: string[] | null): string[] => {
  const seen = new Set<string>();
  const list: string[] = [];

  for (const raw of sizes ?? []) {
    const label = normalizeSizeLabel(raw);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(label);
  }

  return list;
};

const AdminDashboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminName, setAdminName] = useState('Admin');

  const [wholesalers, setWholesalers] = useState<AdminWholesaler[]>([]);
  const [drivers, setDrivers] = useState<AdminDriverProfile[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [productTypes, setProductTypes] = useState<AdminProductType[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [sales, setSales] = useState<SalesSummary>({
    totalSales: 0,
    totalOrders: 0,
    completedOrders: 0,
    topProducts: [],
  });
  const [analytics, setAnalytics] = useState<AdminAnalytics>({
    salesTrend: [],
    statusFunnel: [],
    topProductRevenue: [],
    wholesalerRevenue: [],
    areaRevenue: [],
  });
  const [wholesalerOwed, setWholesalerOwed] = useState<WholesalerOwedRow[]>([]);
  const [wholesalerSettlementDetails, setWholesalerSettlementDetails] = useState<WholesalerSettlementDetail[]>([]);
  const [thengaIncome, setThengaIncome] = useState<ThengaIncomeSummary>({
    margin_income: 0,
    delivery_share_income: 0,
    total_income: 0,
    drivers_total_owed: 0,
    drivers_owed_breakdown: [],
  });

  const [wholesalerEditId, setWholesalerEditId] = useState<string | null>(null);
  const [wholesalerForm, setWholesalerForm] = useState(emptyWholesalerForm);

  const [productEditId, setProductEditId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductUpsertInput>(emptyProductForm);
  const [productPricingMode, setProductPricingMode] = useState<'margin' | 'variant'>('margin'); // NEW: Mode toggle
  const [isManageSizesOpen, setIsManageSizesOpen] = useState(false);
  const [manageSizesFamilyKey, setManageSizesFamilyKey] = useState('');
  const [manageSizesFamilyLabel, setManageSizesFamilyLabel] = useState('');
  const [manageSizesWholesalerId, setManageSizesWholesalerId] = useState<string | null>(null);
  const [manageFamilySizes, setManageFamilySizes] = useState<string[]>([]);
  const [manageCustomSizeInput, setManageCustomSizeInput] = useState('');
  const [sizeRows, setSizeRows] = useState<ProductUpsertInput[]>([]);
  const [savingSizeIndex, setSavingSizeIndex] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  
  // NEW: Variant management for multi-size products
  interface VariantFormRow {
    tempId: string;      // Temporary ID for new variants being edited
    id?: string;         // Supabase ID for existing variants
    size: string;
    price: number;
  }
  const [formVariants, setFormVariants] = useState<VariantFormRow[]>([]);
  const [formVariantInput, setFormVariantInput] = useState({ size: '', price: '' });
  const [orderDriverDrafts, setOrderDriverDrafts] = useState<Record<string, string>>({});
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [isOrderAssignmentCollapsed, setIsOrderAssignmentCollapsed] = useState(false);
  const [isQuickProductEditCollapsed, setIsQuickProductEditCollapsed] = useState(false);
  const [selectedDeliveredOrderId, setSelectedDeliveredOrderId] = useState<string | null>(null);
  const [deliveredOrderDetails, setDeliveredOrderDetails] = useState<DeliveredOrderDetails | null>(null);
  const [loadingDeliveredDetails, setLoadingDeliveredDetails] = useState(false);
  const [driverEditId, setDriverEditId] = useState<string | null>(null);
  const [driverForm, setDriverForm] = useState<DriverProfileUpsertInput>(emptyDriverForm);
  const [offerEditId, setOfferEditId] = useState<string | null>(null);
  const [offerForm, setOfferForm] = useState<OfferUpsertInput>(emptyOfferForm);
  const [uploadingOfferImage, setUploadingOfferImage] = useState(false);

  const wholesalerNameById = useMemo(() => {
    const map = new Map<string, string>();
    wholesalers.forEach((w) => map.set(w.id, w.name));
    return map;
  }, [wholesalers]);

  const assignableDrivers = useMemo(
    () => drivers.filter((d) => d.is_active && Boolean(d.user_id)),
    [drivers]
  );

  const driverNameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    assignableDrivers.forEach((d) => {
      if (d.user_id) {
        map.set(d.user_id, d.full_name);
      }
    });
    return map;
  }, [assignableDrivers]);

  const familySizeMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const product of products) {
      const familyKey = String(product.family_name || product.name || '').trim().toLowerCase();
      if (!familyKey) continue;
      const list = map.get(familyKey) ?? [];
      const configured = normalizeSizeList(product.available_sizes);
      const labels = configured.length > 0
        ? configured
        : [
            product.volume_ml && Number(product.volume_ml) > 0
              ? `${Number(product.volume_ml)}ml`
              : String(product.variant_name || product.unit || 'Standard'),
          ];
      for (const label of labels) {
        if (!list.some((item) => item.toLowerCase() === label.toLowerCase())) {
          list.push(label);
        }
      }
      map.set(familyKey, list);
    }
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => {
        const aNum = Number(a.replace(/[^0-9]/g, ''));
        const bNum = Number(b.replace(/[^0-9]/g, ''));
        if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) return bNum - aNum;
        return a.localeCompare(b);
      });
      map.set(key, list);
    }
    return map;
  }, [products]);

  const buildSizeRowsForFamily = (
    familyKeyRaw: string,
    wholesalerId: string | null,
    source: AdminProduct[] = products
  ): ProductUpsertInput[] => {
    const familyKey = familyKeyRaw.trim().toLowerCase();
    const variants = source
      .filter((p) => {
        const pKey = String(p.family_name || p.name || '').trim().toLowerCase();
        if (pKey !== familyKey) return false;
        if (wholesalerId && p.wholesaler_id !== wholesalerId) return false;
        return true;
      })
      .sort((a, b) => {
        const aVol = Number(a.volume_ml ?? 0);
        const bVol = Number(b.volume_ml ?? 0);
        if (aVol !== bVol) return bVol - aVol;
        return a.name.localeCompare(b.name);
      });

    return variants.map((p) => ({
      id: p.id,
      name: p.name,
      family_name: p.family_name ?? p.name,
      brand_name: p.brand_name ?? '',
      available_sizes: normalizeSizeList(p.available_sizes),
      variant_name: p.variant_name ?? '',
      volume_ml: p.volume_ml ?? null,
      description: p.description,
      image: p.image,
      price: p.price,
      stock: p.stock,
      unit: p.unit,
      isactive: p.isactive,
      wholesaler_id: p.wholesaler_id,
      product_type_id: p.product_type_id,
      base_cost: Number(p.base_cost ?? p.price ?? 0),
      margin_type: p.margin_type ?? 'fixed',
      margin_value: Number(p.margin_value ?? 0),
    }));
  };

  const computeSellingPrice = (
    baseCost: number,
    marginType: ProductUpsertInput['margin_type'],
    marginValue: number
  ) => {
    const safeBase = Math.max(0, Number(baseCost || 0));
    const safeMargin = Math.max(0, Number(marginValue || 0));
    if (marginType === 'percent') {
      return Number((safeBase * (1 + safeMargin / 100)).toFixed(2));
    }
    return Number((safeBase + safeMargin).toFixed(2));
  };

  const setProductFormSizes = (sizes: string[]) => {
    setProductForm((prev) => ({
      ...prev,
      available_sizes: sizes,
    }));
  };

  // Variant management handlers for product variants with different prices
  const addVariantToForm = () => {
    const size = formVariantInput.size.trim();
    const baseCost = Math.max(0, Number(formVariantInput.price || 0)); // Using 'price' field as temporary input, will rename
    
    if (!size) {
      toast({
        title: 'Size required',
        description: 'Please enter a size (e.g., 330ml, 500ml)',
        variant: 'destructive',
      });
      return;
    }
    
    if (baseCost <= 0) {
      toast({
        title: 'Base cost required',
        description: 'Please enter a base cost greater than 0',
        variant: 'destructive',
      });
      return;
    }
    
    // Calculate selling price using margin
    const calculatedPrice = computeSellingPrice(baseCost, productForm.margin_type, productForm.margin_value);
    
    const newVariant: VariantFormRow = {
      tempId: `temp-${Date.now()}-${Math.random()}`,
      size,
      price: calculatedPrice,  // Store the calculated selling price
    };
    
    setFormVariants([...formVariants, newVariant]);
    setFormVariantInput({ size: '', price: '' });
  };
  
  const removeVariantFromForm = (tempId: string) => {
    setFormVariants(formVariants.filter(v => v.tempId !== tempId));
  };

  const toggleManageFamilySize = (size: string) => {
    const normalized = normalizeSizeLabel(size);
    if (!normalized) return;
    setManageFamilySizes((prev) => {
      const current = normalizeSizeList(prev);
      const exists = current.some((item) => item.toLowerCase() === normalized.toLowerCase());
      return exists
        ? current.filter((item) => item.toLowerCase() !== normalized.toLowerCase())
        : [...current, normalized];
    });
  };

  const addCustomManageFamilySize = () => {
    const normalized = normalizeSizeLabel(manageCustomSizeInput);
    if (!normalized) return;
    setManageFamilySizes((prev) => normalizeSizeList([...prev, normalized]));
    setManageCustomSizeInput('');
  };

  const loadAll = async () => {
    const [w, d, o, t, p, s, off, a, owed, income, settlementDetails] = await Promise.all([
      fetchAdminWholesalers(),
      fetchAdminDriverProfiles(),
      fetchAdminOrders(),
      fetchProductTypes(),
      fetchAdminProducts(),
      fetchSalesSummary(),
      fetchAllOffers(),
      fetchAdminAnalytics(14),
      fetchWholesalerAmountsOwed(),
      fetchThengaIncomeSummary(),
      fetchWholesalerSettlementDetails(),
    ]);

    setWholesalers(w);
    setDrivers(d);
    setOrders(o);
    setProductTypes(t);
    setProducts(p);
    setSales(s);
    setOffers(off);
    setAnalytics(a);
    setWholesalerOwed(owed);
    setThengaIncome(income);
    setWholesalerSettlementDetails(settlementDetails);

    const drafts: Record<string, string> = {};
    p.forEach((prod) => {
      drafts[prod.id] = prod.price.toFixed(2);
    });
    setPriceDrafts(drafts);

    const assignmentDrafts: Record<string, string> = {};
    o.forEach((order) => {
      assignmentDrafts[order.id] = order.driver_id ?? '';
    });
    setOrderDriverDrafts(assignmentDrafts);
  };

  useEffect(() => {
    const init = async () => {
      try {
        if (TEST_ADMIN_MODE) {
          setAdminName('Admin (Test Mode)');
        } else {
          const user = await getUser();
          const role = String(user.user_metadata?.role || '').toLowerCase();
          if (role !== 'admin') {
            throw new Error('Unauthorized: this page is only available to admin accounts.');
          }
          setAdminName((user.user_metadata?.first_name as string) || user.email || 'Admin');
        }

        await loadAll();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load admin dashboard');
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, []);

  const handleWholesalerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (wholesalerEditId) {
        await updateWholesaler(wholesalerEditId, wholesalerForm);
        toast({ title: 'Wholesaler updated' });
      } else {
        await createWholesaler(wholesalerForm);
        toast({ title: 'Wholesaler created' });
      }

      setWholesalerEditId(null);
      setWholesalerForm(emptyWholesalerForm);
      await loadAll();
    } catch (err) {
      toast({
        title: 'Wholesaler save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const normalizedBaseCost = Math.max(0, Number(productForm.base_cost ?? 0));
      const normalizedMarginValue = Math.max(0, Number(productForm.margin_value ?? 0));
      const computedSellingPrice =
        productForm.margin_type === 'percent'
          ? normalizedBaseCost * (1 + normalizedMarginValue / 100)
          : normalizedBaseCost + normalizedMarginValue;
      const normalizedPrice =
        Number(productForm.price ?? 0) > 0 ? Number(productForm.price) : computedSellingPrice;

      if (!productForm.image || productForm.image.trim().length === 0) {
        toast({
          title: 'Image required',
          description: 'Add an image URL or upload an image from your PC before saving.',
          variant: 'destructive',
        });
        return;
      }

      // If variants exist, create a separate product for each variant
      if (formVariants.length > 0) {
        for (const variant of formVariants) {
          await upsertProduct({
            ...productForm,
            family_name: String(productForm.family_name || productForm.name || '').trim(),
            brand_name: String(productForm.brand_name || '').trim(),
            available_sizes: normalizeSizeList(productForm.available_sizes),
            variant_name: variant.size,  // Use size as variant name
            volume_ml: productForm.volume_ml,  // Keep existing volume if set
            description: productForm.description,
            price: Number(variant.price.toFixed(2)),  // Use variant price
            base_cost: Number(normalizedBaseCost.toFixed(2)),
            margin_value: 0,  // No margin calculation for variants
            margin_type: 'fixed',
            id: undefined,  // Always create as new product
          });
        }
        toast({ title: 'Product variants created' });
      } else {
        // Create single product if no variants
        await upsertProduct({
          ...productForm,
          family_name: String(productForm.family_name || productForm.name || '').trim(),
          brand_name: String(productForm.brand_name || '').trim(),
          price: Number(normalizedPrice.toFixed(2)),
          base_cost: Number(normalizedBaseCost.toFixed(2)),
          margin_value: Number(normalizedMarginValue.toFixed(2)),
          id: productEditId || undefined,
        });
        toast({ title: productEditId ? 'Product updated' : 'Product created' });
      }

      setProductEditId(null);
      setProductForm(emptyProductForm);
      setProductPricingMode('margin');
      setFormVariants([]);
      setFormVariantInput({ size: '', price: '' });
      await loadAll();
    } catch (err) {
      toast({
        title: 'Product save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await upsertDriverProfile({
        ...driverForm,
        id: driverEditId || undefined,
      });

      toast({ title: driverEditId ? 'Driver updated' : 'Driver created' });
      setDriverEditId(null);
      setDriverForm(emptyDriverForm);
      await loadAll();
    } catch (err) {
      toast({
        title: 'Driver save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleProductPriceSave = async (productId: string) => {
    const raw = priceDrafts[productId] ?? '';
    const parsed = Number(raw);

    if (!Number.isFinite(parsed) || parsed < 0) {
      toast({
        title: 'Invalid price',
        description: 'Enter a valid positive number.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateProductPrice(productId, parsed);
      toast({ title: 'Price updated' });
      await loadAll();
    } catch (err) {
      toast({
        title: 'Price update failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleAssignOrderDriver = async (orderDbId: string) => {
    try {
      setAssigningOrderId(orderDbId);
      const selectedDriverUserId = orderDriverDrafts[orderDbId] || null;
      await assignOrderDriver(orderDbId, selectedDriverUserId);
      toast({ title: selectedDriverUserId ? 'Driver assigned' : 'Driver unassigned' });
      await loadAll();
    } catch (err) {
      toast({
        title: 'Assignment failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setAssigningOrderId(null);
    }
  };

  const handleOpenDeliveredDetails = async (order: AdminOrder) => {
    if (selectedDeliveredOrderId === order.id) {
      setSelectedDeliveredOrderId(null);
      setDeliveredOrderDetails(null);
      return;
    }

    try {
      setLoadingDeliveredDetails(true);
      setSelectedDeliveredOrderId(order.id);
      const details = await fetchDeliveredOrderDetails(order.id);
      setDeliveredOrderDetails(details);
    } catch (err) {
      setSelectedDeliveredOrderId(null);
      setDeliveredOrderDetails(null);
      toast({
        title: 'Failed to load delivered details',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoadingDeliveredDetails(false);
    }
  };

  const handleOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await upsertOffer({
        ...offerForm,
        id: offerEditId || undefined,
      });
      toast({ title: offerEditId ? 'Offer updated' : 'Offer created' });
      setOfferEditId(null);
      setOfferForm(emptyOfferForm);
      await loadAll();
    } catch (err) {
      toast({
        title: 'Offer save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleOfferImageFileChange = async (file?: File | null) => {
    if (!file) return;

    try {
      setUploadingOfferImage(true);

      try {
        const imageUrl = await uploadOfferImage(file);
        setOfferForm((prev) => ({ ...prev, image_url: imageUrl }));
        toast({ title: 'Offer banner uploaded', description: 'Stored in Supabase Storage.' });
      } catch {
        const dataUrl = await offerFileToDataUrl(file);
        setOfferForm((prev) => ({ ...prev, image_url: dataUrl }));
        toast({
          title: 'Offer image loaded from your PC',
          description: 'Storage upload failed, using embedded image instead.',
        });
      }
    } catch (err) {
      toast({
        title: 'Offer image upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setUploadingOfferImage(false);
    }
  };

  const handleImageFileChange = async (file?: File | null) => {
    if (!file) return;

    try {
      setUploadingImage(true);

      try {
        const imageUrl = await uploadProductImage(file);
        setProductForm((prev) => ({ ...prev, image: imageUrl }));
        toast({ title: 'Image uploaded', description: 'Stored in Supabase Storage.' });
      } catch {
        const dataUrl = await fileToDataUrl(file);
        setProductForm((prev) => ({ ...prev, image: dataUrl }));
        toast({
          title: 'Image loaded from your PC',
          description: 'Storage upload failed, using local embedded image instead.',
        });
      }
    } catch (err) {
      toast({
        title: 'Image import failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const startEditWholesaler = (w: AdminWholesaler) => {
    setWholesalerEditId(w.id);
    setWholesalerForm({
      name: w.name,
      area: w.area,
      city: w.city,
      is_active: w.is_active,
    });
  };

  const startEditProduct = (p: AdminProduct) => {
    setProductEditId(p.id);
    setProductPricingMode('margin');
    setFormVariants([]);
    setFormVariantInput({ size: '', price: '' });
    setProductForm({
      name: p.name,
      family_name: p.family_name ?? p.name,
      brand_name: p.brand_name ?? '',
      description: p.description,
      image: p.image,
      price: p.price,
      stock: p.stock,
      unit: p.unit,
      isactive: p.isactive,
      wholesaler_id: p.wholesaler_id,
      product_type_id: p.product_type_id,
      base_cost: Number(p.base_cost ?? p.price ?? 0),
      margin_type: p.margin_type ?? 'fixed',
      margin_value: Number(p.margin_value ?? 0),
    } as ProductUpsertInput);
  };

  const startCreateVariantFromProduct = (p: AdminProduct) => {
    setProductEditId(null);
    setProductPricingMode('variant');
    setFormVariants([]);
    setFormVariantInput({ size: '', price: '' });
    setProductForm({
      ...emptyProductForm,
      name: p.name,
      family_name: p.family_name ?? p.name,
      brand_name: p.brand_name ?? '',
      description: p.description,
      image: p.image,
      stock: p.stock,
      unit: p.unit,
      isactive: p.isactive,
      wholesaler_id: p.wholesaler_id,
      product_type_id: p.product_type_id,
      base_cost: Number(p.base_cost ?? p.price ?? 0),
      margin_type: p.margin_type ?? 'fixed',
      margin_value: Number(p.margin_value ?? 0),
      price: Number(p.price ?? 0),
    } as ProductUpsertInput);
  };

  const openManageSizes = (p: AdminProduct) => {
    const familyKey = String(p.family_name || p.name || '').trim().toLowerCase();
    setManageSizesFamilyKey(familyKey);
    setManageSizesFamilyLabel(String(p.family_name || p.name || 'Product'));
    setManageSizesWholesalerId(p.wholesaler_id ?? null);
    const fallbackSizes = familySizeMap.get(familyKey) ?? [];
    setManageFamilySizes(normalizeSizeList((p.available_sizes ?? []).length > 0 ? p.available_sizes : fallbackSizes));
    setManageCustomSizeInput('');
    setSizeRows(buildSizeRowsForFamily(familyKey, p.wholesaler_id ?? null));
    setIsManageSizesOpen(true);
  };

  const addSizeRow = () => {
    if (sizeRows.length === 0) {
      setSizeRows([
        {
          ...emptyProductForm,
          family_name: manageSizesFamilyLabel,
          wholesaler_id: manageSizesWholesalerId,
          available_sizes: normalizeSizeList(manageFamilySizes),
        },
      ]);
      return;
    }

    const base = sizeRows[0];
    setSizeRows((prev) => [
      ...prev,
      {
        ...base,
        id: undefined,
        available_sizes: normalizeSizeList(manageFamilySizes),
        variant_name: '',
        volume_ml: null,
        stock: 0,
      },
    ]);
  };

  const updateSizeRow = (index: number, patch: Partial<ProductUpsertInput>) => {
    setSizeRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const saveSizeRow = async (index: number) => {
    const row = sizeRows[index];
    if (!row) return;

    try {
      setSavingSizeIndex(index);
      await upsertProduct({
        ...row,
        family_name: String(row.family_name || manageSizesFamilyLabel || row.name || '').trim(),
        brand_name: String(row.brand_name || '').trim(),
        available_sizes: normalizeSizeList(manageFamilySizes),
        variant_name: String(row.variant_name || '').trim(),
        volume_ml:
          row.volume_ml === null || row.volume_ml === undefined || Number(row.volume_ml) <= 0
            ? null
            : Math.floor(Number(row.volume_ml)),
        price: Number(row.price ?? 0),
        base_cost: Number(row.base_cost ?? 0),
        margin_value: Number(row.margin_value ?? 0),
        id: row.id || undefined,
      });

      toast({ title: row.id ? 'Size updated' : 'Size added' });
      await loadAll();
      const latestProducts = await fetchAdminProducts();
      setProducts(latestProducts);
      setSizeRows(buildSizeRowsForFamily(manageSizesFamilyKey, manageSizesWholesalerId, latestProducts));
    } catch (err) {
      toast({
        title: 'Failed saving size',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingSizeIndex(null);
    }
  };

  const startEditDriver = (d: AdminDriverProfile) => {
    setDriverEditId(d.id);
    setDriverForm({
      user_id: d.user_id,
      full_name: d.full_name,
      contact_number: d.contact_number,
      car_model: d.car_model,
      reg_number: d.reg_number,
      area: d.area,
      city: d.city,
      is_active: d.is_active,
    });
  };

  const startEditOffer = (offer: Offer) => {
    setOfferEditId(offer.id);
    setOfferForm({
      id: offer.id,
      title: offer.title,
      subtitle: offer.subtitle,
      image_url: offer.image_url,
      bg_color: offer.bg_color,
      text_color: offer.text_color,
      cta_text: offer.cta_text,
      cta_link: offer.cta_link,
      bonus_points: Number(offer.bonus_points ?? 0),
      min_order_total: offer.min_order_total ?? null,
      campaign_priority: Number(offer.campaign_priority ?? 100),
      is_stackable: Boolean(offer.is_stackable),
      area: offer.area,
      wholesaler_id: offer.wholesaler_id,
      is_active: offer.is_active,
      start_at: offer.start_at,
      end_at: offer.end_at,
    });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading admin dashboard...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Admin Dashboard Unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">{error}</p>
            <Button asChild>
              <Link to="/">Back to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-thenga-blue">Admin Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome, {adminName}</p>
            {TEST_ADMIN_MODE && (
              <p className="text-xs text-amber-600 mt-1">Test mode is ON (auth and role checks bypassed).</p>
            )}
          </div>
          <Button asChild variant="outline">
            <Link to="/">Back to App</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Total Sales</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">R {sales.totalSales.toFixed(2)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Total Orders</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{sales.totalOrders}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Completed Orders</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{sales.completedOrders}</CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales Trend (Last 14 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.salesTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="sales" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="sales" type="monotone" dataKey="sales" stroke="#0f3b74" name="Sales (R)" strokeWidth={2} />
                    <Line yAxisId="orders" type="monotone" dataKey="orders" stroke="#f4bf23" name="Orders" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Status Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.statusFunnel}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#0f3b74" name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Top Products by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.topProductRevenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#0f3b74" name="Revenue (R)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Wholesalers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {analytics.wholesalerRevenue.length === 0 ? (
                <p className="text-sm text-gray-600">No wholesaler revenue data yet.</p>
              ) : (
                analytics.wholesalerRevenue.map((item) => (
                  <div key={item.wholesalerName} className="border rounded p-2 bg-white text-sm">
                    <p className="font-medium truncate">{item.wholesalerName}</p>
                    <p className="text-gray-600">Revenue: R {item.revenue.toFixed(2)} | Orders: {item.orders}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Area Revenue Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.areaRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="area" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#0f3b74" name="Revenue (R)" />
                  <Bar dataKey="orders" fill="#f4bf23" name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detailed Wholesaler Settlement Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {wholesalerSettlementDetails.length === 0 ? (
              <p className="text-sm text-gray-600">No settlement data available. Complete orders with delivered status to see settlement details.</p>
            ) : (
              wholesalerSettlementDetails.map((settlement) => (
                <div key={settlement.wholesaler_id} className="border rounded-lg p-4 bg-white">
                  {/* Wholesaler Header */}
                  <div className="mb-4 pb-3 border-b border-gray-200">
                    <h3 className="font-bold text-lg text-thenga-blue">{settlement.wholesaler_name}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 text-xs">
                      <div>
                        <p className="text-gray-600">Orders</p>
                        <p className="font-semibold">{settlement.delivered_orders_count}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Stock Qty</p>
                        <p className="font-semibold">{settlement.inventory_items.reduce((sum, item) => sum + item.quantity_sold, 0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Sales Revenue</p>
                        <p className="font-semibold text-green-700">R {settlement.total_sales_revenue.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Your Margin</p>
                        <p className="font-semibold text-blue-700">R {settlement.total_margin_earned.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Amount Owed</p>
                        <p className="font-bold text-red-700 text-lg">R {settlement.amount_owed_to_wholesaler.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Inventory Breakdown */}
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Stock Breakdown</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left p-2 font-semibold">Product</th>
                            <th className="text-center p-2 font-semibold">Qty</th>
                            <th className="text-right p-2 font-semibold">Unit Price</th>
                            <th className="text-right p-2 font-semibold">Base Cost</th>
                            <th className="text-right p-2 font-semibold">Margin/Unit</th>
                            <th className="text-right p-2 font-semibold">Total Sales</th>
                            <th className="text-right p-2 font-semibold">Total Cost</th>
                            <th className="text-right p-2 font-semibold">Total Margin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {settlement.inventory_items.map((item, idx) => (
                            <tr key={item.product_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="p-2 text-left">{item.product_name}</td>
                              <td className="p-2 text-center font-semibold">{item.quantity_sold}</td>
                              <td className="p-2 text-right">R {item.unit_price.toFixed(2)}</td>
                              <td className="p-2 text-right">R {item.base_cost.toFixed(2)}</td>
                              <td className="p-2 text-right text-blue-700">R {item.margin_per_unit.toFixed(2)}</td>
                              <td className="p-2 text-right font-semibold">R {item.unit_total_sold.toFixed(2)}</td>
                              <td className="p-2 text-right font-semibold">R {item.unit_total_cost.toFixed(2)}</td>
                              <td className="p-2 text-right font-semibold text-blue-700">R {item.total_margin_on_product.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Settlement Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs border-t pt-3">
                    <div className="border-r pr-2">
                      <p className="text-gray-600">Total Sold Value</p>
                      <p className="font-bold text-green-700">R {settlement.total_sales_revenue.toFixed(2)}</p>
                    </div>
                    <div className="border-r pr-2">
                      <p className="text-gray-600">Cost to Wholesaler</p>
                      <p className="font-bold text-orange-700">R {settlement.total_base_cost.toFixed(2)}</p>
                    </div>
                    <div className="border-r pr-2">
                      <p className="text-gray-600">Thenga Margin</p>
                      <p className="font-bold text-blue-700">R {settlement.total_margin_earned.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Delivery Fees (30% to Thenga)</p>
                      <p className="font-bold text-purple-700">R {(settlement.total_delivery_fees_collected * 0.3).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-200 bg-gray-50 p-3 rounded">
                    <p className="text-sm font-bold text-gray-700 mb-2">Settlement Calculation:</p>
                    <p className="text-xs text-gray-600">
                      What you owe: <span className="font-semibold">R {settlement.total_base_cost.toFixed(2)}</span>
                      {' '} (cost of goods sold)
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Your income: <span className="font-semibold text-blue-700">R {settlement.total_margin_earned.toFixed(2)}</span>
                      {' '} (margin retained)
                      {' '} +{' '}
                      <span className="font-semibold text-purple-700">R {(settlement.total_delivery_fees_collected * 0.3).toFixed(2)}</span>
                      {' '} (30% delivery share)
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wholesaler Amounts Owed (Delivered Orders)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {wholesalerOwed.length === 0 ? (
              <p className="text-sm text-gray-600">No settlement data yet. Run the wholesaler settlement SQL/view.</p>
            ) : (
              wholesalerOwed.map((row) => (
                <div key={row.wholesaler_id} className="border rounded p-3 bg-white text-sm">
                  <p className="font-medium">{row.wholesaler_name}</p>
                  <p className="text-gray-700">Amount owed: <span className="font-semibold">R {row.amount_owed.toFixed(2)}</span></p>
                  <p className="text-gray-600">
                    Gross sales: R {row.gross_sales.toFixed(2)} | Margin: R {row.total_margin.toFixed(2)} | Delivered orders: {row.delivered_orders}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thenga Income & Driver Payouts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="border rounded p-3 bg-white">
                <p className="text-xs text-gray-600">Margin Income</p>
                <p className="text-lg font-semibold text-thenga-blue">R {thengaIncome.margin_income.toFixed(2)}</p>
              </div>
              <div className="border rounded p-3 bg-white">
                <p className="text-xs text-gray-600">Delivery Share (30%)</p>
                <p className="text-lg font-semibold text-thenga-blue">R {thengaIncome.delivery_share_income.toFixed(2)}</p>
              </div>
              <div className="border rounded p-3 bg-white">
                <p className="text-xs text-gray-600">Total Thenga Income</p>
                <p className="text-lg font-semibold text-thenga-blue">R {thengaIncome.total_income.toFixed(2)}</p>
              </div>
              <div className="border rounded p-3 bg-white">
                <p className="text-xs text-gray-600">Drivers Total Owed (70%)</p>
                <p className="text-lg font-semibold text-amber-700">R {thengaIncome.drivers_total_owed.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-thenga-blue">Driver Owed Breakdown</p>
              {thengaIncome.drivers_owed_breakdown.length === 0 ? (
                <p className="text-sm text-gray-600">No completed driver deliveries yet.</p>
              ) : (
                thengaIncome.drivers_owed_breakdown.map((row) => (
                  <div key={row.driver_id} className="border rounded p-2 bg-white text-sm">
                    <p className="font-medium">
                      {row.driver_name}
                      {row.driver_reg_number ? ` (${row.driver_reg_number})` : ''}
                    </p>
                    <p className="text-gray-600">Orders: {row.orders_count} | Amount owed: R {row.amount_owed.toFixed(2)}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top Selling Products</CardTitle></CardHeader>
          <CardContent>
            {sales.topProducts.length === 0 ? (
              <p className="text-sm text-gray-600">No sales data yet.</p>
            ) : (
              <div className="space-y-2">
                {sales.topProducts.map((item) => (
                  <div key={item.name} className="flex justify-between border rounded p-2 bg-white text-sm">
                    <span>{item.name}</span>
                    <span>{item.quantitySold} sold</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Order Assignment</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOrderAssignmentCollapsed((prev) => !prev)}
            >
              {isOrderAssignmentCollapsed ? 'Expand' : 'Collapse'}
            </Button>
          </CardHeader>
          {!isOrderAssignmentCollapsed && (
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-sm text-gray-600">No orders yet.</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded p-3 bg-white text-sm">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <p className="font-medium">Order: {order.order_id}</p>
                          <p className="text-gray-600">{order.customer_name} | {order.contact_number}</p>
                          <p className="text-gray-600 truncate">{order.location}</p>
                          <p className="text-gray-600">
                            Status: {order.status} | Total: R {order.total.toFixed(2)} | {new Date(order.date).toLocaleString()}
                          </p>
                        </div>
                        <div className="w-full md:w-auto flex flex-col md:flex-row gap-2 md:items-center">
                          <select
                            className="p-2 border rounded min-w-[220px]"
                            value={orderDriverDrafts[order.id] ?? ''}
                            onChange={(e) =>
                              setOrderDriverDrafts((prev) => ({ ...prev, [order.id]: e.target.value }))
                            }
                          >
                            <option value="">Unassigned</option>
                            {assignableDrivers.map((driver) => (
                              <option key={driver.id} value={driver.user_id ?? ''}>
                                {driver.full_name} ({driver.reg_number})
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            onClick={() => void handleAssignOrderDriver(order.id)}
                            disabled={assigningOrderId === order.id}
                          >
                            {assigningOrderId === order.id ? 'Saving...' : 'Save Assignment'}
                          </Button>
                          {order.status === 'Completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleOpenDeliveredDetails(order)}
                            >
                              {selectedDeliveredOrderId === order.id ? 'Hide Delivered Details' : 'Delivered Details'}
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Assigned: {order.driver_id ? (driverNameByUserId.get(order.driver_id) || order.driver_id) : 'None'}
                      </p>
                      {order.status === 'Completed' && selectedDeliveredOrderId === order.id && (
                        <div className="mt-3 border rounded p-3 bg-blue-50 space-y-1">
                          {loadingDeliveredDetails ? (
                            <p className="text-sm text-gray-600">Loading delivered order details...</p>
                          ) : deliveredOrderDetails ? (
                            <>
                              <p className="text-sm font-semibold text-thenga-blue">Delivered Order Details</p>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Tavern:</span> {deliveredOrderDetails.tavernName}
                              </p>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Location:</span> {deliveredOrderDetails.tavernLocation}
                              </p>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Contact:</span> {deliveredOrderDetails.tavernContact}
                              </p>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Driver:</span>{' '}
                                {deliveredOrderDetails.driverName || deliveredOrderDetails.driverId || 'Unassigned'}
                                {deliveredOrderDetails.driverRegNumber ? ` (${deliveredOrderDetails.driverRegNumber})` : ''}
                              </p>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Wholesaler(s):</span>{' '}
                                {deliveredOrderDetails.wholesalerNames.length > 0
                                  ? deliveredOrderDetails.wholesalerNames.join(', ')
                                  : 'Unknown'}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-gray-600">No details available.</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>{offerEditId ? 'Edit Offer Banner' : 'Create Offer Banner'}</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleOfferSubmit}>
              <input
                className="w-full p-2 border rounded"
                placeholder="Offer title"
                value={offerForm.title}
                onChange={(e) => setOfferForm((p) => ({ ...p, title: e.target.value }))}
                required
              />
              <input
                className="w-full p-2 border rounded"
                placeholder="Offer subtitle"
                value={offerForm.subtitle}
                onChange={(e) => setOfferForm((p) => ({ ...p, subtitle: e.target.value }))}
              />
              <input
                className="w-full p-2 border rounded"
                placeholder="Image URL (optional)"
                value={offerForm.image_url}
                onChange={(e) => setOfferForm((p) => ({ ...p, image_url: e.target.value }))}
              />
              <div>
                <label className="text-sm text-gray-700">Upload Banner Image (from your PC)</label>
                <input
                  className="w-full p-2 border rounded mt-1"
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleOfferImageFileChange(e.target.files?.[0])}
                  disabled={uploadingOfferImage}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tries Supabase Storage first, then falls back to embedded local image.
                </p>
              </div>
              {uploadingOfferImage && <p className="text-sm text-amber-600">Uploading banner image...</p>}
              {offerForm.image_url && (
                <div className="border rounded p-2 bg-white">
                  <p className="text-xs text-gray-600 mb-2 break-all">{offerForm.image_url}</p>
                  <img
                    src={offerForm.image_url}
                    alt="Offer preview"
                    className="h-28 w-full object-cover rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  className="w-full p-2 border rounded"
                  placeholder="CTA text"
                  value={offerForm.cta_text}
                  onChange={(e) => setOfferForm((p) => ({ ...p, cta_text: e.target.value }))}
                />
                <input
                  className="w-full p-2 border rounded"
                  placeholder="CTA link"
                  value={offerForm.cta_link}
                  onChange={(e) => setOfferForm((p) => ({ ...p, cta_link: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  className="w-full p-2 border rounded"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Bonus points (e.g. 20)"
                  value={offerForm.bonus_points}
                  onChange={(e) =>
                    setOfferForm((p) => ({ ...p, bonus_points: Math.max(0, Math.floor(Number(e.target.value || 0))) }))
                  }
                />
                <input
                  className="w-full p-2 border rounded"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Min order total for bonus (optional)"
                  value={offerForm.min_order_total ?? ''}
                  onChange={(e) =>
                    setOfferForm((p) => ({
                      ...p,
                      min_order_total: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                />
                <input
                  className="w-full p-2 border rounded"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="Campaign priority (lower = higher priority)"
                  value={offerForm.campaign_priority}
                  onChange={(e) =>
                    setOfferForm((p) => ({
                      ...p,
                      campaign_priority: Math.max(0, Math.floor(Number(e.target.value || 0))),
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <input
                  className="w-full p-2 border rounded"
                  type="color"
                  value={offerForm.bg_color}
                  onChange={(e) => setOfferForm((p) => ({ ...p, bg_color: e.target.value }))}
                  title="Background color"
                />
                <input
                  className="w-full p-2 border rounded"
                  type="color"
                  value={offerForm.text_color}
                  onChange={(e) => setOfferForm((p) => ({ ...p, text_color: e.target.value }))}
                  title="Text color"
                />
                <input
                  className="w-full p-2 border rounded"
                  placeholder="Area (optional)"
                  value={offerForm.area ?? ''}
                  onChange={(e) => setOfferForm((p) => ({ ...p, area: e.target.value || null }))}
                />
                <select
                  className="w-full p-2 border rounded"
                  value={offerForm.wholesaler_id ?? ''}
                  onChange={(e) => setOfferForm((p) => ({ ...p, wholesaler_id: e.target.value || null }))}
                >
                  <option value="">All wholesalers</option>
                  {wholesalers.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  className="w-full p-2 border rounded"
                  type="datetime-local"
                  value={offerForm.start_at ? offerForm.start_at.slice(0, 16) : ''}
                  onChange={(e) =>
                    setOfferForm((p) => ({ ...p, start_at: e.target.value ? new Date(e.target.value).toISOString() : null }))
                  }
                />
                <input
                  className="w-full p-2 border rounded"
                  type="datetime-local"
                  value={offerForm.end_at ? offerForm.end_at.slice(0, 16) : ''}
                  onChange={(e) =>
                    setOfferForm((p) => ({ ...p, end_at: e.target.value ? new Date(e.target.value).toISOString() : null }))
                  }
                />
              </div>
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={offerForm.is_active}
                  onChange={(e) => setOfferForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                Active
              </label>
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={offerForm.is_stackable}
                  onChange={(e) => setOfferForm((p) => ({ ...p, is_stackable: e.target.checked }))}
                />
                Stackable with other campaigns
              </label>
              <div className="flex gap-2">
                <Button type="submit">{offerEditId ? 'Update Offer' : 'Create Offer'}</Button>
                {offerEditId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOfferEditId(null);
                      setOfferForm(emptyOfferForm);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-5 space-y-2">
              {offers.length === 0 ? (
                <p className="text-sm text-gray-600">No offers created yet.</p>
              ) : (
                offers.map((offer) => (
                  <div key={offer.id} className="border rounded p-2 bg-white text-sm flex items-center justify-between">
                    <div>
                      <p className="font-medium">{offer.title}</p>
                      <p className="text-gray-600">
                        {offer.is_active ? 'Active' : 'Inactive'} | Area: {offer.area || 'All'} | Wholesaler: {offer.wholesaler_id || 'All'} | Bonus: {Number(offer.bonus_points ?? 0)} pts | Priority: {Number(offer.campaign_priority ?? 100)} | {offer.is_stackable ? 'Stackable' : 'Exclusive'}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => startEditOffer(offer)}>
                      Edit
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>{wholesalerEditId ? 'Edit Wholesaler' : 'Add Wholesaler'}</CardTitle></CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleWholesalerSubmit}>
                <input
                  className="w-full p-2 border rounded"
                  placeholder="Name"
                  value={wholesalerForm.name}
                  onChange={(e) => setWholesalerForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
                <input
                  className="w-full p-2 border rounded"
                  placeholder="Area"
                  value={wholesalerForm.area}
                  onChange={(e) => setWholesalerForm((p) => ({ ...p, area: e.target.value }))}
                  required
                />
                <input
                  className="w-full p-2 border rounded"
                  placeholder="City"
                  value={wholesalerForm.city}
                  onChange={(e) => setWholesalerForm((p) => ({ ...p, city: e.target.value }))}
                  required
                />
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={wholesalerForm.is_active}
                    onChange={(e) => setWholesalerForm((p) => ({ ...p, is_active: e.target.checked }))}
                  />
                  Active
                </label>
                <div className="flex gap-2">
                  <Button type="submit">{wholesalerEditId ? 'Update' : 'Create'}</Button>
                  {wholesalerEditId && (
                    <Button type="button" variant="outline" onClick={() => {
                      setWholesalerEditId(null);
                      setWholesalerForm(emptyWholesalerForm);
                    }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>

              <div className="mt-5 space-y-2">
                {wholesalers.map((w) => (
                  <div key={w.id} className="border rounded p-2 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{w.name}</p>
                      <p className="text-gray-600">{w.area} | {w.city} | {w.is_active ? 'Active' : 'Inactive'}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => startEditWholesaler(w)}>Edit</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{productEditId ? 'Edit Product' : 'Add Product'}</CardTitle></CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleProductSubmit}>
                <p className="text-xs text-gray-500">Fill in product details, then choose pricing mode below.</p>
                
                {/* Product Name & Family */}
                <input
                  className="w-full p-2 border rounded"
                  placeholder="Product name"
                  value={productForm.name}
                  onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    className="w-full p-2 border rounded"
                    placeholder="Family name (e.g. Castle Lager)"
                    value={productForm.family_name ?? ''}
                    onChange={(e) => setProductForm((p) => ({ ...p, family_name: e.target.value }))}
                    required
                  />
                  <input
                    className="w-full p-2 border rounded"
                    placeholder="Brand name (optional)"
                    value={productForm.brand_name ?? ''}
                    onChange={(e) => setProductForm((p) => ({ ...p, brand_name: e.target.value }))}
                  />
                </div>

                {/* Description */}
                <input
                  className="w-full p-2 border rounded"
                  placeholder="Description"
                  value={productForm.description}
                  onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))}
                />

                {/* Wholesaler & Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <select
                    className="w-full p-2 border rounded"
                    value={productForm.wholesaler_id ?? ''}
                    onChange={(e) => setProductForm((p) => ({ ...p, wholesaler_id: e.target.value || null }))}
                    required
                  >
                    <option value="">Select wholesaler *</option>
                    {wholesalers.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  <select
                    className="w-full p-2 border rounded"
                    value={productForm.product_type_id ?? ''}
                    onChange={(e) => setProductForm((p) => ({ ...p, product_type_id: e.target.value || null }))}
                    required
                  >
                    <option value="">Select product type *</option>
                    {productTypes.map((pt) => (
                      <option key={pt.id} value={pt.id}>{pt.name}</option>
                    ))}
                  </select>
                </div>

                {/* Image */}
                <input
                  className="w-full p-2 border rounded"
                  placeholder="Image URL"
                  value={productForm.image}
                  onChange={(e) => setProductForm((p) => ({ ...p, image: e.target.value }))}
                />
                <div>
                  <label className="text-sm text-gray-700">Upload Image (from your PC)</label>
                  <input
                    className="w-full p-2 border rounded mt-1"
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleImageFileChange(e.target.files?.[0])}
                    disabled={uploadingImage}
                  />
                </div>
                {uploadingImage && <p className="text-sm text-amber-600">Uploading image...</p>}
                {productForm.image && (
                  <div className="border rounded p-2 bg-white">
                    <img
                      src={productForm.image}
                      alt="Preview"
                      className="h-20 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* PRICING MODE SELECTOR */}
                <div className="border-2 border-thenga-blue rounded p-3 bg-blue-50 space-y-3">
                  <p className="font-semibold text-thenga-blue text-sm">Pricing Mode</p>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={productPricingMode === 'margin'}
                        onChange={() => {
                          setProductPricingMode('margin');
                          setFormVariants([]);
                          setFormVariantInput({ size: '', price: '' });
                        }}
                      />
                      <span className="text-sm">📊 Single Price (Base Cost + Margin)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={productPricingMode === 'variant'}
                        onChange={() => setProductPricingMode('variant')}
                      />
                      <span className="text-sm">✨ Multi-Variant (Different Sizes & Prices)</span>
                    </label>
                  </div>
                </div>

                {/* MODE 1: MARGIN PRICING */}
                {productPricingMode === 'margin' && (
                  <div className="border rounded p-3 bg-gray-50 space-y-3">
                    <p className="font-medium text-gray-700 text-sm">Single Product Pricing</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <select
                        className="w-full p-2 border rounded"
                        value={productForm.unit}
                        onChange={(e) => setProductForm((p) => ({ ...p, unit: e.target.value }))}
                      >
                        <option value="case">📦 Case</option>
                        <option value="unit">🔢 Unit</option>
                        <option value="pack">📫 Pack</option>
                        <option value="bottle">🍾 Bottle</option>
                        <option value="crate">📦 Crate</option>
                      </select>
                      <input
                        className="w-full p-2 border rounded"
                        type="number"
                        min={0}
                        step="1"
                        placeholder="Stock quantity"
                        value={productForm.stock}
                        onChange={(e) =>
                          setProductForm((p) => ({
                            ...p,
                            stock: Math.max(0, Math.floor(Number(e.target.value || 0))),
                          }))
                        }
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Base Cost (R) *</label>
                        <input
                          className="w-full p-2 border rounded"
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="What wholesaler charges you"
                          value={productForm.base_cost}
                          onChange={(e) =>
                            setProductForm((p) => {
                              const baseCost = Math.max(0, Number(e.target.value || 0));
                              return {
                                ...p,
                                base_cost: baseCost,
                                price: computeSellingPrice(baseCost, p.margin_type, p.margin_value),
                              };
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Margin Type *</label>
                        <select
                          className="w-full p-2 border rounded bg-white font-semibold text-thenga-blue"
                          value={productForm.margin_type}
                          onChange={(e) =>
                            setProductForm((p) => {
                              const marginType = e.target.value === 'percent' ? 'percent' : 'fixed';
                              return {
                                ...p,
                                margin_type: marginType,
                                price: computeSellingPrice(p.base_cost, marginType, p.margin_value),
                              };
                            })
                          }
                        >
                          <option value="fixed">Fixed Amount (R)</option>
                          <option value="percent">Percentage (%)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">
                          {productForm.margin_type === 'percent' ? 'Margin (%)' : 'Margin (R)'} *
                        </label>
                        <input
                          className="w-full p-2 border rounded"
                          type="number"
                          min={0}
                          step={productForm.margin_type === 'percent' ? '0.1' : '0.01'}
                          placeholder={productForm.margin_type === 'percent' ? 'e.g., 20 for 20%' : 'e.g., 5 for R5'}
                          value={productForm.margin_value}
                          onChange={(e) =>
                            setProductForm((p) => {
                              const marginValue = Math.max(0, Number(e.target.value || 0));
                              return {
                                ...p,
                                margin_value: marginValue,
                                price: computeSellingPrice(p.base_cost, p.margin_type, marginValue),
                              };
                            })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-thenga-blue rounded p-3">
                      <p className="text-sm font-bold text-thenga-blue mb-2">💰 Price Calculation:</p>
                      <div className="text-sm space-y-1">
                        <p className="text-gray-700">
                          Base Cost: <span className="font-semibold text-orange-700">R {productForm.base_cost.toFixed(2)}</span>
                        </p>
                        {productForm.margin_type === 'percent' ? (
                          <>
                            <p className="text-gray-700">
                              + Margin: <span className="font-semibold text-blue-700">{productForm.margin_value}%</span>
                            </p>
                            <p className="text-gray-600 text-xs">
                              = R {productForm.base_cost.toFixed(2)} × (1 + {productForm.margin_value}/100)
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-gray-700">
                              + Margin: <span className="font-semibold text-blue-700">R {productForm.margin_value.toFixed(2)}</span>
                            </p>
                            <p className="text-gray-600 text-xs">
                              = R {productForm.base_cost.toFixed(2)} + R {productForm.margin_value.toFixed(2)}
                            </p>
                          </>
                        )}
                        <p className="pt-2 border-t border-blue-200 font-bold text-lg text-green-700">
                          Final Selling Price: R {(
                            productForm.margin_type === 'percent'
                              ? productForm.base_cost * (1 + productForm.margin_value / 100)
                              : productForm.base_cost + productForm.margin_value
                          ).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* MODE 2: VARIANT PRICING */}
                {productPricingMode === 'variant' && (
                  <div className="border rounded p-3 bg-blue-50 space-y-3">
                    <p className="font-medium text-gray-700 text-sm">📊 Add Product Variants (Sizes with Different Prices)</p>
                    <p className="text-xs text-gray-600">Example: Castle Lager 330ml @ R18, 500ml @ R22, 750ml @ R30</p>
                    
                    {/* Margin Calculator for Variants */}
                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-300 rounded p-3 space-y-3">
                      <p className="font-semibold text-indigo-900 text-sm">💰 Base Cost & Margin (Applied to Each Variant)</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs font-semibold text-gray-700 block mb-1">Base Cost (R) *</label>
                          <input
                            className="w-full p-2 border rounded text-sm"
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Wholesaler cost"
                            value={productForm.base_cost}
                            onChange={(e) =>
                              setProductForm((p) => ({
                                ...p,
                                base_cost: Math.max(0, Number(e.target.value || 0)),
                              }))
                            }
                            required
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700 block mb-1">Margin Type *</label>
                          <select
                            className="w-full p-2 border rounded text-sm bg-white font-semibold text-indigo-700"
                            value={productForm.margin_type}
                            onChange={(e) =>
                              setProductForm((p) => ({
                                ...p,
                                margin_type: e.target.value === 'percent' ? 'percent' : 'fixed',
                              }))
                            }
                          >
                            <option value="fixed">Fixed Amount (R)</option>
                            <option value="percent">Percentage (%)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700 block mb-1">
                            {productForm.margin_type === 'percent' ? 'Margin (%)' : 'Margin (R)'} *
                          </label>
                          <input
                            className="w-full p-2 border rounded text-sm"
                            type="number"
                            min={0}
                            step={productForm.margin_type === 'percent' ? '0.1' : '0.01'}
                            placeholder={productForm.margin_type === 'percent' ? 'e.g., 20' : 'e.g., 5'}
                            value={productForm.margin_value}
                            onChange={(e) =>
                              setProductForm((p) => ({
                                ...p,
                                margin_value: Math.max(0, Number(e.target.value || 0)),
                              }))
                            }
                            required
                          />
                        </div>
                      </div>

                      <div className="bg-white border rounded p-2 text-xs space-y-1">
                        <p className="text-gray-600">
                          <strong>Formula:</strong> When you enter variant prices, multiply by: <span className="font-mono font-bold text-indigo-700">
                            {productForm.margin_type === 'percent'
                              ? `1 + ${productForm.margin_value}%`
                              : `Base + R${productForm.margin_value}`}
                          </span>
                        </p>
                        <p className="text-gray-500">
                          <strong>Example:</strong> If 330ml base cost is {productForm.base_cost ? `R${productForm.base_cost}` : 'R0'}, 
                          selling price = R{(
                            productForm.margin_type === 'percent'
                              ? (productForm.base_cost * (1 + productForm.margin_value / 100)).toFixed(2)
                              : (productForm.base_cost + productForm.margin_value).toFixed(2)
                          )}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-white border rounded p-2 space-y-2">
                      {formVariants.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No variants added yet</p>
                      ) : (
                        formVariants.map((variant) => (
                          <div key={variant.tempId} className="flex items-center justify-between text-sm bg-gradient-to-r from-blue-50 to-indigo-50 p-2 rounded border border-blue-200">
                            <div className="flex-1">
                              <p className="font-bold text-gray-800">{variant.size}</p>
                              <p className="text-xs text-gray-600">
                                Selling Price: <span className="font-semibold text-green-700">R {variant.price.toFixed(2)}</span>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeVariantFromForm(variant.tempId)}
                              className="text-red-500 hover:text-red-700 font-bold text-lg ml-2"
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Size Name *</label>
                        <input
                          className="w-full p-2 border rounded text-sm"
                          placeholder="e.g., 330ml Dumpy"
                          value={formVariantInput.size}
                          onChange={(e) => setFormVariantInput(prev => ({ ...prev, size: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Base Cost (R) *</label>
                        <input
                          className="w-full p-2 border rounded text-sm"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Wholesaler cost for this size"
                          value={formVariantInput.price}
                          onChange={(e) => setFormVariantInput(prev => ({ ...prev, price: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Show calculated price preview */}
                    {formVariantInput.price && Number(formVariantInput.price) > 0 && (
                      <div className="bg-green-50 border-l-4 border-green-500 p-2 text-sm">
                        <p className="text-gray-700">
                          Base Cost: <span className="font-semibold">R {Number(formVariantInput.price).toFixed(2)}</span>
                        </p>
                        <p className="text-gray-700">
                          {productForm.margin_type === 'percent' 
                            ? `+ Margin: ${productForm.margin_value}%`
                            : `+ Margin: R ${productForm.margin_value.toFixed(2)}`}
                        </p>
                        <p className="text-green-700 font-bold">
                          = Selling Price: R {computeSellingPrice(Number(formVariantInput.price), productForm.margin_type, productForm.margin_value).toFixed(2)}
                        </p>
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="default"
                      onClick={addVariantToForm}
                      className="w-full text-sm"
                    >
                      + Add Variant
                    </Button>

                    <input
                      className="w-full p-2 border rounded text-sm"
                      type="number"
                      min={0}
                      step="1"
                      placeholder="Stock (total for all variants)"
                      value={productForm.stock}
                      onChange={(e) =>
                        setProductForm((p) => ({
                          ...p,
                          stock: Math.max(0, Math.floor(Number(e.target.value || 0))),
                        }))
                      }
                      required
                    />

                    {formVariants.length === 0 && (
                      <p className="text-xs text-red-600 bg-red-50 p-2 rounded">⚠️ Add at least one variant before saving</p>
                    )}
                  </div>
                )}

                {/* Active Status */}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={productForm.isactive}
                    onChange={(e) => setProductForm((p) => ({ ...p, isactive: e.target.checked }))}
                  />
                  <span className="text-sm">Active</span>
                </label>

                {/* Submit Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={productPricingMode === 'variant' && formVariants.length === 0}>
                    {productEditId ? 'Update Product' : 'Create Product'}
                  </Button>
                  {productEditId && (
                    <Button type="button" variant="outline" onClick={() => {
                      setProductEditId(null);
                      setProductForm(emptyProductForm);
                      setProductPricingMode('margin');
                      setFormVariants([]);
                      setFormVariantInput({ size: '', price: '' });
                    }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Products (Quick Price Edit)</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQuickProductEditCollapsed((prev) => !prev)}
            >
              {isQuickProductEditCollapsed ? 'Expand' : 'Collapse'}
            </Button>
          </CardHeader>
          {!isQuickProductEditCollapsed && (
            <CardContent>
              <div className="space-y-2">
                {products.map((p) => (
                  <div key={p.id} className="border rounded p-2 flex flex-col gap-3 text-sm bg-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{p.name} | Stock {p.stock}</p>
                        <p className="text-gray-600">
                          {wholesalerNameById.get(p.wholesaler_id || '') || 'No wholesaler'} | {p.product_type_name} | {p.isactive ? 'Active' : 'Inactive'}
                        </p>
                        {(p.category_name || p.variant_name || p.packaging_name || p.volume_ml) && (
                          <p className="text-gray-500">
                            {p.category_name || 'Uncategorized'}
                            {p.variant_name ? ` | ${p.variant_name}` : ''}
                            {p.packaging_name ? ` | ${p.packaging_name}` : ''}
                            {p.volume_ml ? ` | ${p.volume_ml}ml` : ''}
                          </p>
                        )}
                        <p className="text-gray-500">
                          Family sizes:{' '}
                          {(familySizeMap.get(String(p.family_name || p.name || '').trim().toLowerCase()) ?? [])
                            .join(', ') || 'None'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => openManageSizes(p)}>
                          Manage Sizes
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startEditProduct(p)}>Edit Full</Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-600">Price</label>
                      <input
                        className="w-28 p-1 border rounded"
                        type="number"
                        min={0}
                        step="0.01"
                        value={priceDrafts[p.id] ?? p.price.toFixed(2)}
                        onChange={(e) => setPriceDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      />
                      <Button size="sm" onClick={() => void handleProductPriceSave(p.id)}>Save Price</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
        <Card>
          <CardHeader><CardTitle>{driverEditId ? 'Edit Driver Profile' : 'Add Driver Profile'}</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleDriverSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  className="w-full p-2 border rounded"
                  placeholder="Driver full name"
                  value={driverForm.full_name}
                  onChange={(e) => setDriverForm((p) => ({ ...p, full_name: e.target.value }))}
                  required
                />
                <input
                  className="w-full p-2 border rounded"
                  placeholder="Contact number"
                  value={driverForm.contact_number}
                  onChange={(e) => setDriverForm((p) => ({ ...p, contact_number: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  className="w-full p-2 border rounded"
                  placeholder="Car model"
                  value={driverForm.car_model}
                  onChange={(e) => setDriverForm((p) => ({ ...p, car_model: e.target.value }))}
                  required
                />
                <input
                  className="w-full p-2 border rounded"
                  placeholder="Reg number"
                  value={driverForm.reg_number}
                  onChange={(e) => setDriverForm((p) => ({ ...p, reg_number: e.target.value }))}
                  required
                />
                <input
                  className="w-full p-2 border rounded"
                  placeholder="Auth user_id (optional)"
                  value={driverForm.user_id ?? ''}
                  onChange={(e) => setDriverForm((p) => ({ ...p, user_id: e.target.value || null }))}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  className="w-full p-2 border rounded"
                  placeholder="Driver area (for auto-assign)"
                  value={driverForm.area}
                  onChange={(e) => setDriverForm((p) => ({ ...p, area: e.target.value }))}
                />
                <input
                  className="w-full p-2 border rounded"
                  placeholder="Driver city (for auto-assign)"
                  value={driverForm.city}
                  onChange={(e) => setDriverForm((p) => ({ ...p, city: e.target.value }))}
                />
              </div>
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={driverForm.is_active}
                  onChange={(e) => setDriverForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                Active
              </label>
              <div className="flex gap-2">
                <Button type="submit">{driverEditId ? 'Update Driver' : 'Create Driver'}</Button>
                {driverEditId && (
                  <Button type="button" variant="outline" onClick={() => {
                    setDriverEditId(null);
                    setDriverForm(emptyDriverForm);
                  }}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-5 space-y-2">
              {drivers.length === 0 ? (
                <p className="text-sm text-gray-600">No driver profiles yet. Add your first driver above.</p>
              ) : (
                drivers.map((d) => (
                  <div key={d.id} className="border rounded p-2 flex items-center justify-between text-sm bg-white">
                    <div>
                      <p className="font-medium">{d.full_name}</p>
                      <p className="text-gray-600">
                        {d.car_model} | {d.reg_number} | {d.contact_number || 'No phone'} | {d.is_active ? 'Active' : 'Inactive'}
                      </p>
                      {(d.area || d.city) && (
                        <p className="text-gray-500 text-xs">
                          Area: {d.area || '-'} | City: {d.city || '-'}
                        </p>
                      )}
                      {d.user_id && <p className="text-gray-500 text-xs">user_id: {d.user_id}</p>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => startEditDriver(d)}>Edit</Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

      </div>

      <Dialog open={isManageSizesOpen} onOpenChange={setIsManageSizesOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Manage Sizes - {manageSizesFamilyLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">Add or update size variants for this product family.</p>
              <Button type="button" variant="outline" size="sm" onClick={addSizeRow}>
                Add Size Row
              </Button>
            </div>
            <div className="border rounded p-3 bg-gray-50 space-y-2">
              <p className="text-sm font-medium text-gray-700">Family Size Options</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_SIZE_OPTIONS.map((size) => {
                  const selected = manageFamilySizes.some((item) => item.toLowerCase() === size.toLowerCase());
                  return (
                    <button
                      key={size}
                      type="button"
                      className={`px-2 py-1 text-xs rounded border ${
                        selected
                          ? 'bg-thenga-blue text-white border-thenga-blue'
                          : 'bg-white text-gray-700 border-thenga-lightgray'
                      }`}
                      onClick={() => toggleManageFamilySize(size)}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  className="w-full p-2 border rounded"
                  placeholder="Add custom family size"
                  value={manageCustomSizeInput}
                  onChange={(e) => setManageCustomSizeInput(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={addCustomManageFamilySize}>
                  Add
                </Button>
              </div>
              <p className="text-xs text-gray-600">
                Active family sizes: {manageFamilySizes.join(', ') || 'None'}
              </p>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {sizeRows.length === 0 ? (
                <p className="text-sm text-gray-600">No variants yet for this family.</p>
              ) : (
                sizeRows.map((row, idx) => (
                  <div key={`${row.id || 'new'}-${idx}`} className="border rounded p-3 bg-white space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <input
                        className="w-full p-2 border rounded"
                        placeholder="Variant label (e.g. 750ml)"
                        value={row.variant_name ?? ''}
                        onChange={(e) => updateSizeRow(idx, { variant_name: e.target.value })}
                      />
                      <input
                        className="w-full p-2 border rounded"
                        type="number"
                        min={0}
                        step="1"
                        placeholder="Volume ml"
                        value={row.volume_ml ?? ''}
                        onChange={(e) =>
                          updateSizeRow(idx, {
                            volume_ml:
                              e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value || 0))),
                          })
                        }
                      />
                      <input
                        className="w-full p-2 border rounded"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Price (R)"
                        value={row.price}
                        onChange={(e) => updateSizeRow(idx, { price: Math.max(0, Number(e.target.value || 0)) })}
                      />
                      <input
                        className="w-full p-2 border rounded"
                        type="number"
                        min={0}
                        step="1"
                        placeholder="Stock"
                        value={row.stock}
                        onChange={(e) => updateSizeRow(idx, { stock: Math.max(0, Math.floor(Number(e.target.value || 0))) })}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        className="w-full p-2 border rounded"
                        placeholder="Product name/SKU title"
                        value={row.name}
                        onChange={(e) => updateSizeRow(idx, { name: e.target.value })}
                      />
                      <select
                        className="w-full p-2 border rounded"
                        value={row.unit}
                        onChange={(e) => updateSizeRow(idx, { unit: e.target.value })}
                      >
                        <option value="case">Case</option>
                        <option value="unit">Unit</option>
                        <option value="pack">Pack</option>
                        <option value="bottle">Bottle</option>
                        <option value="crate">Crate</option>
                      </select>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveSizeRow(idx)}
                        disabled={savingSizeIndex === idx}
                      >
                        {savingSizeIndex === idx ? 'Saving...' : row.id ? 'Update Size' : 'Create Size'}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ProductCard from '../components/ProductCard';
import Header from '../components/Header';
import CheckoutForm from '../components/CheckoutForm';
import OrderSuccess from '../components/OrderSuccess';
import { ScrollArea } from "@/components/ui/scroll-area";
import { InstallPWA } from '../components/InstallPWA';
import { fetchProductsByWholesaler } from '@/services/productService';
import { supabase } from '@/lib/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { UserRegistration } from '@/data/userRegistration';
import { fetchWholesalers, type Wholesaler } from '@/services/wholesalerService';
import { useCartStore } from '@/store/useCartStore';
import { Product } from '@/data/products';
import { fetchActiveOffersForCustomer, type Offer } from '@/services/offersService';
import { sendOrderEmail } from '@/services/orderService';
import { Order } from '@/types/cart';
import { useToast } from '@/components/ui/use-toast';
import html2pdf from 'html2pdf.js';
import { InvoicePreview } from './InvoicePreview';

const Index = () => {
  const [view, setView] = useState<'products' | 'checkout' | 'success' | 'track'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingWholesalers, setLoadingWholesalers] = useState(true);
  const [wholesalers, setWholesalers] = useState<Wholesaler[]>([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedWholesalerId, setSelectedWholesalerId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [wholesalerError, setWholesalerError] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [activeOfferIndex, setActiveOfferIndex] = useState(0);
  const [orderId, setOrderId] = useState<string>('');
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [user, setUser] = useState<UserRegistration | null>(null);
  const navigate = useNavigate();
  const { clearCart } = useCartStore();
  const { toast } = useToast();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const areas = useMemo(() => {
    const unique = Array.from(new Set(wholesalers.map((w) => w.area).filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [wholesalers]);

  const filteredWholesalers = useMemo(
    () => wholesalers.filter((w) => w.area === selectedArea),
    [wholesalers, selectedArea]
  );

  useEffect(() => {
    const loadWholesalers = async () => {
      try {
        setLoadingWholesalers(true);
        const data = await fetchWholesalers();
        setWholesalers(data);

        if (data.length > 0) {
          const firstArea = data[0].area;
          setSelectedArea(firstArea);
          const firstWholesaler = data.find((w) => w.area === firstArea);
          setSelectedWholesalerId(firstWholesaler?.id || '');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load wholesalers';
        setWholesalerError(message);
      } finally {
        setLoadingWholesalers(false);
      }
    };

    loadWholesalers();
  }, []);

  useEffect(() => {
    if (!user?.address?.city || !areas.length) return;

    const cityMatch = areas.find(
      (area) => area.toLowerCase() === user.address.city.toLowerCase()
    );

    if (cityMatch) {
      setSelectedArea(cityMatch);
      const firstWholesaler = wholesalers.find((w) => w.area === cityMatch);
      if (firstWholesaler) {
        setSelectedWholesalerId(firstWholesaler.id);
      }
    }
  }, [user, areas, wholesalers]);

  useEffect(() => {
    const loadProducts = async () => {
      if (!selectedWholesalerId) {
        setProducts([]);
        return;
      }

      try {
        setLoadingProducts(true);
        const data = await fetchProductsByWholesaler(selectedWholesalerId);
        setProducts(data);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoadingProducts(false);
      }
    };

    void loadProducts();
  }, [selectedWholesalerId]);

  useEffect(() => {
    setSelectedCategory('all');
  }, [selectedWholesalerId]);

  useEffect(() => {
    const loadOffers = async () => {
      try {
        const data = await fetchActiveOffersForCustomer(selectedArea, selectedWholesalerId);
        setOffers(data);
      } catch (error) {
        console.error('Error loading offers:', error);
      }
    };

    void loadOffers();
  }, [selectedArea, selectedWholesalerId]);

  useEffect(() => {
    setActiveOfferIndex(0);
  }, [offers.length, selectedArea, selectedWholesalerId]);

  useEffect(() => {
    if (offers.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveOfferIndex((prev) => (prev + 1) % offers.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [offers.length]);

  useEffect(() => {
    const subscription = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Products' },
        async () => {
          if (!selectedWholesalerId) return;
          const data = await fetchProductsByWholesaler(selectedWholesalerId);
          setProducts(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [selectedWholesalerId]);

  const categoryOptions = useMemo(() => {
    const categoryMap = new Map<string, string>();
    for (const product of products) {
      const key = String(product.category_slug || product.type || '').trim().toLowerCase();
      if (!key) continue;
      const label = String(product.category_name || product.type || 'Other').trim();
      if (!categoryMap.has(key)) {
        categoryMap.set(key, label);
      }
    }

    return Array.from(categoryMap.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') return products;
    return products.filter((product) => {
      const key = String(product.category_slug || product.type || '').trim().toLowerCase();
      return key === selectedCategory;
    });
  }, [products, selectedCategory]);

  const familyCards = useMemo(() => {
    const groups = new Map<string, Product[]>();
    for (const product of filteredProducts) {
      const key = String(product.family_name || product.name || product.id).trim().toLowerCase();
      const current = groups.get(key) ?? [];
      current.push(product);
      groups.set(key, current);
    }

    return Array.from(groups.values())
      .map((variants) => {
        const sortedVariants = variants.slice().sort((a, b) => {
          const aVol = Number(a.volume_ml ?? 0);
          const bVol = Number(b.volume_ml ?? 0);
          if (aVol !== bVol) return bVol - aVol;
          return a.name.localeCompare(b.name);
        });
        return {
          product: sortedVariants[0],
          variants: sortedVariants,
        };
      })
      .sort((a, b) => (a.product.family_name || a.product.name).localeCompare(b.product.family_name || b.product.name));
  }, [filteredProducts]);

  const handleCheckout = () => {
    setView('checkout');
  };

  const handleBackToProducts = () => {
    setView('products');
  };

  const handleOrderSuccess = (order: Order) => {
    setOrderId(order.orderId);
    setLastOrder(order);
    setView('success');
  };

  const handleBackToHome = () => {
    setView('products');
  };

  const handlesUserInfo = (userIfo: UserRegistration) => {
    setUser(userIfo);
  };

  const handleTrackOrder = () => {
    navigate(`/track-order/${orderId}`);
  };

  const handleDownloadInvoice = async () => {
    if (!orderId) return;
    try {
      await sendOrderEmail(orderId, user?.first_name || 'Customer');
    } catch (error) {
      if (lastOrder && invoiceRef.current) {
        const opt = {
          margin: 0.5,
          filename: `invoice-${lastOrder.orderId}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        };
        await html2pdf().set(opt).from(invoiceRef.current).save();
        toast({
          title: 'Invoice downloaded',
          description: 'Used local invoice fallback because server invoice is unavailable.',
        });
        return;
      }

      toast({
        title: 'Invoice download failed',
        description: error instanceof Error ? error.message : 'Could not download invoice right now.',
        variant: 'destructive',
      });
    }
  };

  const handleAreaChange = (nextArea: string) => {
    setSelectedArea(nextArea);
    const firstWholesaler = wholesalers.find((w) => w.area === nextArea);
    setSelectedWholesalerId(firstWholesaler?.id || '');
    clearCart();
  };

  const handleWholesalerChange = (nextWholesalerId: string) => {
    setSelectedWholesalerId(nextWholesalerId);
    clearCart();
  };

  return (
    <div className="min-h-screen flex flex-col bg-white pb-20">
      <Header onCheckout={handleCheckout} onUserInfo={handlesUserInfo} onLogout={handleBackToHome} />

      <main className="flex-1 container mx-auto px-4 py-6">
        {view === 'products' && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-thenga-blue mb-2">Welcome to Thenga Lite</h2>
              <p className="text-gray-600">Select your area, wholesaler, and products</p>
              <InstallPWA />
            </div>

            {offers.length > 0 && (
              <div className="mb-6">
                {(() => {
                  const safeIndex = Math.min(activeOfferIndex, Math.max(offers.length - 1, 0));
                  const offer = offers[safeIndex];
                  if (!offer) return null;

                  return (
                    <div
                      className="rounded-lg p-4 border overflow-hidden"
                      style={{ background: offer.bg_color, color: offer.text_color }}
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-lg font-bold">{offer.title}</p>
                          {offer.subtitle && <p className="text-sm opacity-95 mt-1">{offer.subtitle}</p>}
                          {offer.cta_text && (
                            <div className="mt-3">
                              {offer.cta_link ? (
                                <a
                                  href={offer.cta_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-block px-3 py-1 rounded border text-xs font-semibold"
                                  style={{ color: offer.text_color, borderColor: offer.text_color }}
                                >
                                  {offer.cta_text}
                                </a>
                              ) : (
                                <span
                                  className="inline-block px-3 py-1 rounded border text-xs font-semibold"
                                  style={{ borderColor: offer.text_color }}
                                >
                                  {offer.cta_text}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {offer.image_url && (
                          <img
                            src={offer.image_url}
                            alt={offer.title}
                            className="h-24 w-full md:w-56 object-cover rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                      </div>

                      {offers.length > 1 && (
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {offers.map((item, idx) => (
                              <button
                                key={item.id}
                                type="button"
                                aria-label={`Show offer ${idx + 1}`}
                                onClick={() => setActiveOfferIndex(idx)}
                                className="h-2.5 rounded-full transition-all"
                                style={{
                                  width: idx === safeIndex ? 22 : 10,
                                  backgroundColor: idx === safeIndex ? offer.text_color : `${offer.text_color}88`,
                                }}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="px-2 py-1 text-xs rounded border"
                              style={{ borderColor: offer.text_color }}
                              onClick={() =>
                                setActiveOfferIndex((prev) =>
                                  (prev - 1 + offers.length) % offers.length
                                )
                              }
                            >
                              Prev
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 text-xs rounded border"
                              style={{ borderColor: offer.text_color }}
                              onClick={() => setActiveOfferIndex((prev) => (prev + 1) % offers.length)}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-sm font-medium text-gray-700">Your Area</label>
                <select
                  value={selectedArea}
                  onChange={(e) => handleAreaChange(e.target.value)}
                  className="w-full mt-1 p-2 border border-gray-300 rounded"
                  disabled={loadingWholesalers || areas.length === 0}
                >
                  {areas.length === 0 ? (
                    <option value="">No areas available</option>
                  ) : (
                    areas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Wholesaler</label>
                <select
                  value={selectedWholesalerId}
                  onChange={(e) => handleWholesalerChange(e.target.value)}
                  className="w-full mt-1 p-2 border border-gray-300 rounded"
                  disabled={filteredWholesalers.length === 0}
                >
                  {filteredWholesalers.length === 0 ? (
                    <option value="">No wholesalers in this area</option>
                  ) : (
                    filteredWholesalers.map((wholesaler) => (
                      <option key={wholesaler.id} value={wholesaler.id}>
                        {wholesaler.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {wholesalerError && (
              <div className="mb-4 p-3 border border-red-200 bg-red-50 text-red-700 rounded">
                {wholesalerError}
              </div>
            )}

            {!selectedWholesalerId ? (
              <div className="p-4 border border-thenga-lightgray rounded bg-gray-50 text-gray-600">
                Select an area and wholesaler to view products.
              </div>
            ) : (
              <div className="w-full">
                <div className="mb-4 overflow-x-auto">
                  <div className="flex items-center gap-2 min-w-max">
                    <button
                      type="button"
                      className={`px-3 py-2 text-sm rounded border ${
                        selectedCategory === 'all'
                          ? 'bg-thenga-blue text-white border-thenga-blue'
                          : 'bg-white text-gray-700 border-thenga-lightgray'
                      }`}
                      onClick={() => setSelectedCategory('all')}
                    >
                      All Products
                    </button>
                    {categoryOptions.map((category) => (
                      <button
                        key={category.key}
                        type="button"
                        className={`px-3 py-2 text-sm rounded border whitespace-nowrap ${
                          selectedCategory === category.key
                            ? 'bg-thenga-blue text-white border-thenga-blue'
                            : 'bg-white text-gray-700 border-thenga-lightgray'
                        }`}
                        onClick={() => setSelectedCategory(category.key)}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                </div>

                <ScrollArea className="h-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
                    {familyCards.map(({ product, variants }) => (
                      <ProductCard
                        key={product.family_name || product.id}
                        product={product}
                        variants={variants}
                      />
                    ))}
                  </div>
                  {!loadingProducts && familyCards.length === 0 && (
                    <p className="text-sm text-gray-600 mt-4">No products available for this selection.</p>
                  )}
                </ScrollArea>
              </div>
            )}
          </>
        )}

        {view === 'checkout' && (
          <div className="max-w-md mx-auto">
            <CheckoutForm
              onBack={handleBackToProducts}
              onSuccess={handleOrderSuccess}
              user={user}
            />
          </div>
        )}

        {view === 'success' && (
          <div className="max-w-md mx-auto">
            <OrderSuccess
              orderId={orderId}
              loyaltyPointsRedeemed={lastOrder?.loyaltyPointsRedeemed}
              loyaltyRedemptionValue={lastOrder?.loyaltyRedemptionValue}
              loyaltyPointsEarned={lastOrder?.loyaltyPointsEarned}
              loyaltyBonusPointsEarned={lastOrder?.loyaltyBonusPointsEarned}
              loyaltyPointsTotal={lastOrder?.loyaltyPointsTotal ?? null}
              onBackToHome={handleBackToHome}
              onTrackOrder={handleTrackOrder}
              onDownloadInvoice={handleDownloadInvoice}
            />
            {lastOrder && (
              <div className="hidden">
                <InvoicePreview orderData={lastOrder} invoiceRef={invoiceRef} />
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-4 px-4 bg-white border-t">
        <div className="container mx-auto text-center">
          <p className="text-sm text-gray-500">© {new Date().getFullYear()} Thenga Lite. All rights reserved.</p>
          <p className="text-xs text-gray-400 mt-1">A simple stock ordering app for tavern owners</p>
          <p className="mt-3 text-[11px] text-gray-400">
            <span className="inline-flex gap-3">
              <Link to="/driver-dashboard" className="hover:text-gray-600 underline underline-offset-2">Driver Portal</Link>
              <Link to="/admin-dashboard" className="hover:text-gray-600 underline underline-offset-2">Admin Portal</Link>
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;


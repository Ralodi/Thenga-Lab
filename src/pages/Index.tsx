
import React, { useEffect, useState } from 'react';
// import { products } from '../data/products';
import ProductCard from '../components/ProductCard';
import Header from '../components/Header';
import CheckoutForm from '../components/CheckoutForm';
import OrderSuccess from '../components/OrderSuccess';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InstallPWA } from '../components/InstallPWA';
import { fetchProducts } from '@/services/productService';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { UserRegistration } from '@/data/userRegistration';

const Index = () => {
  const [view, setView] = useState<'products' | 'checkout' | 'success' | 'track'>('products');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderId, setOrderId] = useState<string>('');
  const [user, setUser] = useState<UserRegistration | null>(null);
  const navigate = useNavigate();

  // Fetch products
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await fetchProducts();
        setProducts(data);
      }
      catch (error) {
        console.error('Error fetching products: ', error);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  // Listen for real-time updates
  useEffect(() => {
    const subscription = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Products' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProducts((prev) => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setProducts((prev) =>
              prev.map((p) => (p.id === payload.new.id ? payload.new : p))
            );
          } else if (payload.eventType === 'DELETE') {
            setProducts((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);


  const beers = products.filter(product => product.type === 'beer');
  const ciders = products.filter(product => product.type === 'cider');

  const handleCheckout = () => {
    setView('checkout');
  };

  const handleBackToProducts = () => {
    setView('products');
  };

  const handleOrderSuccess = (orderId: string) => {
    setOrderId(orderId);
    setView('success');
  };

  const handleBackToHome = () => {
    setView('products');
  };

  const handlesUserInfo = (userIfo: UserRegistration) => {
    setUser(userIfo);
  }

  const handleTrackOrder = () => {
    navigate(`/track-order/${orderId}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white pb-20">
      <Header onCheckout={handleCheckout} onUserInfo={handlesUserInfo} onLogout={handleBackToHome} />

      <main className="flex-1 container mx-auto px-4 py-6">
        {view === 'products' && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-thenga-blue mb-2">Welcome to Thenga Lite</h2>
              <p className="text-gray-600">Select your tavern supplies and place your order</p>
              <InstallPWA />
            </div>

            <Tabs defaultValue="all" className="w-full">
              <TabsList className="w-full mb-6 bg-white border border-thenga-lightgray">
                <TabsTrigger value="all" className="flex-1">All Products</TabsTrigger>
                <TabsTrigger value="beer" className="flex-1">Beer</TabsTrigger>
                <TabsTrigger value="cider" className="flex-1">Cider</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-0">
                <ScrollArea className="h-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
                    {products.map(product => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="beer" className="mt-0">
                <ScrollArea className="h-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
                    {beers.map(product => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="cider" className="mt-0">
                <ScrollArea className="h-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
                    {ciders.map(product => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
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
              onBackToHome={handleBackToHome} onTrackOrder={handleTrackOrder} />
          </div>
        )}
      </main>

      <footer className="py-4 px-4 bg-white border-t">
        <div className="container mx-auto text-center">
          <p className="text-sm text-gray-500">© {new Date().getFullYear()} Thenga Lite. All rights reserved.</p>
          <p className="text-xs text-gray-400 mt-1">A simple stock ordering app for tavern owners</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
